package com.cuemark.screenmark;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.ArrayList;
import java.util.Comparator;

/** Periodically copies the already encrypted local state into the chosen SAF folder. */
public class EncryptedBackupWorker extends Worker {
    public EncryptedBackupWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            Context context = getApplicationContext();
            android.content.SharedPreferences settings = context.getSharedPreferences("screenmark_backup_location", Context.MODE_PRIVATE);
            String treeUriString = settings.getString("uri", null);
            String packedState = EncryptedStorePlugin.readPackedState(context);
            if (treeUriString == null || packedState == null || packedState.isEmpty()) return Result.success();

            Uri treeUri = Uri.parse(treeUriString);
            Uri root = DocumentsContract.buildDocumentUriUsingTree(treeUri, DocumentsContract.getTreeDocumentId(treeUri));
            String date = new SimpleDateFormat("yyyy-MM-dd_HH-mm", Locale.US).format(new Date());
            String fileName = "screenmark_background_" + date + ".sqdb";
            Uri target = DocumentsContract.createDocument(
                context.getContentResolver(), root, "application/octet-stream", fileName
            );
            if (target == null) return Result.retry();
            try (OutputStream output = context.getContentResolver().openOutputStream(target, "wt")) {
                if (output == null) return Result.retry();
                output.write(packedState.getBytes(StandardCharsets.UTF_8));
            }
            pruneBackups(context, treeUri, root, Math.max(3, Math.min(20, settings.getInt("retention", 10))));
            return Result.success();
        } catch (SecurityException e) {
            return Result.failure();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private static void pruneBackups(Context context, Uri treeUri, Uri root, int retention) {
        try {
            Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
                treeUri, DocumentsContract.getDocumentId(root)
            );
            ArrayList<BackupFile> backups = new ArrayList<>();
            String[] columns = {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED
            };
            try (Cursor cursor = context.getContentResolver().query(childrenUri, columns, null, null, null)) {
                if (cursor == null) return;
                int idColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
                int nameColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
                int modifiedColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED);
                while (cursor.moveToNext()) {
                    String name = cursor.getString(nameColumn);
                    if (name == null || !name.startsWith("screenmark_background_") || !name.endsWith(".sqdb")) continue;
                    backups.add(new BackupFile(cursor.getString(idColumn), name, cursor.getLong(modifiedColumn)));
                }
            }
            backups.sort(Comparator.comparingLong((BackupFile file) -> file.modified).reversed().thenComparing(file -> file.name, Comparator.reverseOrder()));
            for (int i = retention; i < backups.size(); i++) {
                Uri file = DocumentsContract.buildDocumentUriUsingTree(treeUri, backups.get(i).documentId);
                DocumentsContract.deleteDocument(context.getContentResolver(), file);
            }
        } catch (Exception ignored) {
            // A backup remains successful if the provider does not support listing/deleting.
        }
    }

    private static final class BackupFile {
        final String documentId;
        final String name;
        final long modified;

        BackupFile(String documentId, String name, long modified) {
            this.documentId = documentId;
            this.name = name;
            this.modified = modified;
        }
    }
}
