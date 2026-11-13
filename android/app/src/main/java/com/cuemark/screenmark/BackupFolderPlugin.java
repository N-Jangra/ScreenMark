package com.cuemark.screenmark;

import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.database.Cursor;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.util.Base64;

import com.getcapacitor.JSArray;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;

// Lets the user pick a folder (via Android's Storage Access Framework tree picker)
// to store ScreenMark backups in, and persists access to it across app restarts so
// exports/imports never need to re-prompt once a folder has been chosen.
@CapacitorPlugin(name = "BackupFolder")
public class BackupFolderPlugin extends Plugin {
    // SAF providers can be slow (especially cloud-backed folders). Keep all
    // file work serialized on one background thread so the WebView and Android
    // main thread remain responsive while preserving operation ordering.
    private final ExecutorService storageExecutor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "ScreenMark-Storage");
        thread.setDaemon(true);
        return thread;
    });

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, "pickFolderResult");
    }

    @ActivityCallback
    private void pickFolderResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.reject("User cancelled folder selection");
            return;
        }

        Uri treeUri = result.getData().getData();
        if (treeUri == null) {
            call.reject("No folder was returned");
            return;
        }

        getContext().getContentResolver().takePersistableUriPermission(
            treeUri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        );

        JSObject result_ = new JSObject();
        result_.put("uri", treeUri.toString());
        call.resolve(result_);
    }

    // ---- Chunked export: "Save as" picker or backup folder, then many small writes (no giant bridge message). ----
    // Own thread so an export is never stuck behind a long folder sync.
    private final ExecutorService exportExecutor = Executors.newSingleThreadExecutor(runnable -> { Thread t = new Thread(runnable, "ScreenMark-Export"); t.setDaemon(true); return t; });
    private OutputStream exportStream;

    private synchronized void closeExportStream() {
        OutputStream stream = exportStream;
        exportStream = null;
        if (stream != null) {
            try { stream.flush(); } catch (Exception ignored) {}
            try { stream.close(); } catch (Exception ignored) {}
        }
    }

    @PluginMethod
    public void createDocument(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mimeType", "application/json"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("fileName", "screenmark-backup.json"));
        startActivityForResult(call, intent, "createDocumentResult");
    }

    @ActivityCallback
    private void createDocumentResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("cancelled");
            return;
        }
        Uri uri = result.getData().getData();
        exportExecutor.execute(() -> {
            try {
                closeExportStream();
                exportStream = getContext().getContentResolver().openOutputStream(uri, "wt");
                if (exportStream == null) throw new Exception("Could not open the chosen file");
                // Small text exports pass their content up front, so saving still completes if
                // Android discards the WebView while the system picker is open.
                String inline = call.getString("content");
                if (inline != null) {
                    exportStream.write(inline.getBytes(StandardCharsets.UTF_8));
                    closeExportStream();
                }
                JSObject out = new JSObject();
                out.put("uri", uri.toString());
                call.resolve(out);
            } catch (Exception e) { closeExportStream(); call.reject("Could not create the file: " + e.getMessage(), e); }
        });
    }

    @PluginMethod
    public void beginFolderExport(PluginCall call) {
        exportExecutor.execute(() -> {
            try {
                closeExportStream();
                String treeUriStr = call.getString("uri"), fileName = call.getString("fileName");
                if (treeUriStr == null || fileName == null) { call.reject("Missing 'uri' or 'fileName'"); return; }
                Uri treeUri = Uri.parse(treeUriStr);
                Uri dirUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, DocumentsContract.getTreeDocumentId(treeUri));
                Uri existing = findChildDocument(treeUri, dirUri, fileName);
                Uri target = existing != null ? existing : DocumentsContract.createDocument(getContext().getContentResolver(), dirUri, fileName.toLowerCase().endsWith(".gz") ? "application/gzip" : "application/json", fileName);
                if (target == null) throw new Exception("Failed to create the file in the backup folder");
                exportStream = getContext().getContentResolver().openOutputStream(target, "wt");
                if (exportStream == null) throw new Exception("Could not open the file for writing");
                JSObject out = new JSObject();
                out.put("uri", target.toString());
                call.resolve(out);
            } catch (Exception e) { closeExportStream(); call.reject("Could not start the export: " + e.getMessage(), e); }
        });
    }

    @PluginMethod
    public void writeDocumentChunk(PluginCall call) {
        String content = call.getString("content");
        // base64 chunks carry binary data (gzip-compressed backups); plain chunks are UTF-8 text.
        boolean base64 = Boolean.TRUE.equals(call.getBoolean("base64", false));
        exportExecutor.execute(() -> {
            try {
                if (exportStream == null) throw new Exception("No export file is open");
                byte[] bytes = content == null ? new byte[0] : base64 ? android.util.Base64.decode(content, android.util.Base64.DEFAULT) : content.getBytes(StandardCharsets.UTF_8);
                exportStream.write(bytes);
                call.resolve();
            } catch (Exception e) { closeExportStream(); call.reject("Write failed: " + e.getMessage(), e); }
        });
    }

    @PluginMethod
    public void closeDocument(PluginCall call) {
        exportExecutor.execute(() -> { closeExportStream(); call.resolve(); });
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        storageExecutor.execute(() -> doWriteFile(call));
    }

    private void doWriteFile(PluginCall call) {
        String treeUriStr = call.getString("uri");
        String fileName = call.getString("fileName");
        String content = call.getString("content");

        if (treeUriStr == null || fileName == null || content == null) {
            call.reject("Missing 'uri', 'fileName', or 'content' parameter");
            return;
        }

        try {
            Uri treeUri = Uri.parse(treeUriStr);
            Uri dirUri = DocumentsContract.buildDocumentUriUsingTree(
                treeUri,
                DocumentsContract.getTreeDocumentId(treeUri)
            );

            Uri existing = findChildDocument(treeUri, dirUri, fileName);
            Uri targetUri = existing != null
                ? existing
                : DocumentsContract.createDocument(getContext().getContentResolver(), dirUri, "application/json", fileName);

            if (targetUri == null) {
                call.reject("Failed to create backup file in the selected folder");
                return;
            }

            OutputStream stream = getContext().getContentResolver().openOutputStream(targetUri, "wt");
            if (stream == null) throw new Exception("Failed to open backup file for writing");
            try (OutputStream out = stream) { out.write(content.getBytes(StandardCharsets.UTF_8)); }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("uri", targetUri.toString());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to write backup file: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        storageExecutor.execute(() -> doReadFile(call));
    }

    private void doReadFile(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) {
            call.reject("Missing 'uri' parameter");
            return;
        }

        try {
            Uri uri = Uri.parse(uriStr);
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            InputStream stream = getContext().getContentResolver().openInputStream(uri);
            if (stream == null) throw new Exception("Failed to open file for reading");
            try (InputStream in = stream) {
                int bytesRead;
                while ((bytesRead = in.read(chunk)) != -1) buffer.write(chunk, 0, bytesRead);
            }

            JSObject result = new JSObject();
            result.put("content", buffer.toString("UTF-8"));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read backup file: " + e.getMessage(), e);
        }
    }

    // Reads an arbitrary file's raw bytes as base64 — unlike readFile (which decodes
    // as UTF-8 text), this is safe for binary formats like the .tar backup archive.
    @PluginMethod
    public void readBinaryFile(PluginCall call) {
        storageExecutor.execute(() -> doReadBinaryFile(call));
    }

    private void doReadBinaryFile(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) {
            call.reject("Missing 'uri' parameter");
            return;
        }

        try {
            Uri uri = Uri.parse(uriStr);
            int maxBytes = Math.max(0, call.getInt("maxBytes", 0));
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            long totalBytes = 0;
            InputStream stream = getContext().getContentResolver().openInputStream(uri);
            if (stream == null) throw new Exception("Failed to open file for reading");
            try (InputStream in = stream) {
                int bytesRead;
                while ((bytesRead = in.read(chunk)) != -1) {
                    totalBytes += bytesRead;
                    if (maxBytes > 0 && totalBytes > maxBytes) throw new Exception("Binary file exceeds the requested size limit");
                    buffer.write(chunk, 0, bytesRead);
                }
            }

            JSObject result = new JSObject();
            result.put("base64Content", Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read binary file: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void listFiles(PluginCall call) {
        storageExecutor.execute(() -> doListFiles(call));
    }

    private void doListFiles(PluginCall call) {
        String treeUriStr = call.getString("uri");
        if (treeUriStr == null) {
            call.reject("Missing 'uri' parameter");
            return;
        }

        try {
            Uri treeUri = Uri.parse(treeUriStr);
            String documentId;
            try {
                documentId = DocumentsContract.getDocumentId(treeUri);
            } catch (IllegalArgumentException treeRootUri) {
                // A picked SAF tree URI has no /document/<id> segment; its tree ID is
                // the directory to list. Nested URIs have both segments and use their
                // document ID so listing screenmark-db does not list the selected root.
                documentId = DocumentsContract.getTreeDocumentId(treeUri);
            }
            Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
                treeUri,
                documentId
            );

            JSObject result = new JSObject();
            com.getcapacitor.JSArray files = new com.getcapacitor.JSArray();

            Cursor cursor = getContext().getContentResolver().query(
                childrenUri,
                new String[] {
                    DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_SIZE,
                    DocumentsContract.Document.COLUMN_LAST_MODIFIED
                },
                null, null, null
            );

            if (cursor != null) {
                while (cursor.moveToNext()) {
                String docId = cursor.getString(0);
                String name = cursor.getString(1);
                Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);

                JSObject file = new JSObject();
                file.put("name", name);
                file.put("uri", docUri.toString());
                if (!cursor.isNull(2)) file.put("size", cursor.getLong(2));
                if (!cursor.isNull(3)) file.put("lastModified", cursor.getLong(3));
                files.put(file);
                }
                cursor.close();
            }

            result.put("files", files);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to list files: " + e.getMessage(), e);
        }
    }

    // Deletes a single file by its own document URI. Used only for rotating old
    // auto-backup archives — never called on a folder, so this can't cascade into
    // deleting screenmark-db/ or any of its contents.
    @PluginMethod
    public void deleteFile(PluginCall call) {
        storageExecutor.execute(() -> doDeleteFile(call));
    }

    private void doDeleteFile(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) {
            call.reject("Missing 'uri' parameter");
            return;
        }

        try {
            Uri uri = Uri.parse(uriStr);
            boolean deleted = DocumentsContract.deleteDocument(getContext().getContentResolver(), uri);
            JSObject result = new JSObject();
            result.put("success", deleted);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to delete file: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void hasPersistedFolder(PluginCall call) {
        storageExecutor.execute(() -> doHasPersistedFolder(call));
    }

    @PluginMethod
    public void rememberFolder(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null || uri.isEmpty()) {
            call.reject("Missing folder URI");
            return;
        }
        getContext().getSharedPreferences("screenmark_backup_location", android.content.Context.MODE_PRIVATE)
            .edit().putString("uri", uri).apply();
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void getRememberedFolder(PluginCall call) {
        String uri = getContext().getSharedPreferences("screenmark_backup_location", android.content.Context.MODE_PRIVATE)
            .getString("uri", "");
        call.resolve(new JSObject().put("uri", uri));
    }

    private void doHasPersistedFolder(PluginCall call) {
        String treeUriStr = call.getString("uri");
        boolean valid = false;

        if (treeUriStr != null && !treeUriStr.isEmpty()) {
            try {
                Uri treeUri = Uri.parse(treeUriStr);
                for (android.content.UriPermission perm : getContext().getContentResolver().getPersistedUriPermissions()) {
                    if (perm.getUri().equals(treeUri) && perm.isWritePermission()) {
                        Uri rootUri = DocumentsContract.buildDocumentUriUsingTree(
                            treeUri,
                            DocumentsContract.getTreeDocumentId(treeUri)
                        );
                        try (Cursor cursor = getContext().getContentResolver().query(
                            rootUri,
                            new String[] {
                                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                                DocumentsContract.Document.COLUMN_MIME_TYPE
                            },
                            null, null, null
                        )) {
                            if (cursor != null && cursor.moveToFirst()) {
                                String mimeType = cursor.getString(1);
                                boolean isDirectory = DocumentsContract.Document.MIME_TYPE_DIR.equals(mimeType);
                                // Some SAF providers report zero flags for a writable
                                // tree. The persisted write grant is the authoritative
                                // permission; querying the directory proves the location
                                // is still reachable.
                                valid = isDirectory;
                            }
                        }
                        break;
                    }
                }
            } catch (Exception ignored) {
                // A revoked grant, removed SD card, or unavailable cloud provider
                // is reported to JavaScript as an invalid storage location.
                valid = false;
            }
        }

        JSObject result = new JSObject();
        result.put("valid", valid);
        call.resolve(result);
    }

    private Uri findChildDocument(Uri treeUri, Uri parentDocUri, String childName) {
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            treeUri,
            DocumentsContract.getDocumentId(parentDocUri)
        );

        Cursor cursor = getContext().getContentResolver().query(
            childrenUri,
            new String[] {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME
            },
            null, null, null
        );

        Uri found = null;
        if (cursor != null) {
            while (cursor.moveToNext()) {
                String docId = cursor.getString(0);
                String name = cursor.getString(1);
                if (childName.equals(name)) {
                    found = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);
                    break;
                }
            }
            cursor.close();
        }
        return found;
    }

    // Resolves dirPath (e.g. ["screenmark-db", "series", "cobra_kai"]) under the tree root,
    // creating any missing folder along the way. Each segment requires its own SAF
    // round-trip since there is no path-based lookup or recursive mkdir in DocumentsContract.
    private Uri getOrCreateDir(Uri treeUri, String[] pathSegments) throws Exception {
        Uri currentDir = DocumentsContract.buildDocumentUriUsingTree(
            treeUri,
            DocumentsContract.getTreeDocumentId(treeUri)
        );

        for (String segment : pathSegments) {
            Uri existing = findChildDocument(treeUri, currentDir, segment);
            if (existing != null) {
                currentDir = existing;
                continue;
            }
            Uri created = DocumentsContract.createDocument(
                getContext().getContentResolver(),
                currentDir,
                DocumentsContract.Document.MIME_TYPE_DIR,
                segment
            );
            if (created == null) {
                throw new Exception("Failed to create folder: " + segment);
            }
            currentDir = created;
        }

        return currentDir;
    }

    private Uri getOrCreateFile(Uri treeUri, Uri parentDirUri, String fileName, String mimeType) throws Exception {
        Uri existing = findChildDocument(treeUri, parentDirUri, fileName);
        if (existing != null) return existing;

        Uri created = DocumentsContract.createDocument(
            getContext().getContentResolver(),
            parentDirUri,
            mimeType,
            fileName
        );
        if (created == null) {
            throw new Exception("Failed to create file: " + fileName);
        }
        return created;
    }

    // Writes textContent to <root>/<dirPath...>/<fileName>, creating any missing folders.
    // Used by the screenmark-db/ category/item folder-tree mirror.
    @PluginMethod
    public void writeNestedFile(PluginCall call) {
        storageExecutor.execute(() -> doWriteNestedFile(call));
    }

    private void doWriteNestedFile(PluginCall call) {
        String treeUriStr = call.getString("uri");
        JSArray dirPathArr = call.getArray("dirPath");
        String fileName = call.getString("fileName");
        String content = call.getString("content");

        if (treeUriStr == null || dirPathArr == null || fileName == null || content == null) {
            call.reject("Missing 'uri', 'dirPath', 'fileName', or 'content' parameter");
            return;
        }

        try {
            Uri treeUri = Uri.parse(treeUriStr);
            String[] dirPath = jsArrayToStringArray(dirPathArr);
            Uri dirUri = getOrCreateDir(treeUri, dirPath);
            Uri fileUri = getOrCreateFile(treeUri, dirUri, fileName, "application/json");

            OutputStream stream = getContext().getContentResolver().openOutputStream(fileUri, "wt");
            if (stream == null) throw new Exception("Failed to open file for writing");
            try (OutputStream out = stream) { out.write(content.getBytes(StandardCharsets.UTF_8)); }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("uri", fileUri.toString());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to write nested file: " + e.getMessage(), e);
        }
    }

    // Writes base64Content (decoded to raw bytes) to <root>/<dirPath...>/<fileName>.
    // Used for .thumbnail files in the screenmark-db/ folder-tree mirror.
    // ---- Streamed file writes (large library database) -------------------------------------------------------------------
    // The portable database is written title by title instead of as one giant string: open, write chunks, close. Everything runs on
    // the single storage thread, so chunks arrive in order and never interleave with other folder writes.
    private final java.util.HashMap<String, OutputStream> folderStreams = new java.util.HashMap<>();
    private final java.util.HashMap<String, InputStream> folderReadStreams = new java.util.HashMap<>();

    @PluginMethod
    public void openFolderReadStream(PluginCall call) {
        storageExecutor.execute(() -> {
            try {
                String uri = call.getString("uri"), id = call.getString("id");
                if (uri == null || id == null) throw new Exception("Missing 'uri' or 'id'");
                InputStream input = getContext().getContentResolver().openInputStream(Uri.parse(uri));
                if (input == null) throw new Exception("Failed to open file for streaming");
                synchronized (folderReadStreams) {
                    InputStream old = folderReadStreams.put(id, input);
                    if (old != null) try { old.close(); } catch (Exception ignored) {}
                }
                call.resolve();
            } catch (Exception e) { call.reject("Could not open the file stream: " + e.getMessage(), e); }
        });
    }

    @PluginMethod
    public void readFolderStream(PluginCall call) {
        storageExecutor.execute(() -> {
            try {
                String id = call.getString("id");
                int length = Math.max(1024, Math.min(512 * 1024, call.getInt("length", 256 * 1024)));
                InputStream input; synchronized (folderReadStreams) { input = folderReadStreams.get(id); }
                if (input == null) throw new Exception("No open file stream");
                byte[] bytes = new byte[length];
                int total = 0;
                while (total < length) {
                    int read = input.read(bytes, total, length - total);
                    if (read < 0) break;
                    total += read;
                }
                JSObject result = new JSObject();
                result.put("base64Content", Base64.encodeToString(total == length ? bytes : java.util.Arrays.copyOf(bytes, total), Base64.NO_WRAP));
                result.put("bytesRead", total);
                result.put("done", total < length);
                call.resolve(result);
            } catch (Exception e) { closeFolderReadStreamQuietly(call.getString("id")); call.reject("File stream read failed: " + e.getMessage(), e); }
        });
    }

    @PluginMethod
    public void closeFolderReadStream(PluginCall call) {
        storageExecutor.execute(() -> {
            String id = call.getString("id");
            InputStream input; synchronized (folderReadStreams) { input = folderReadStreams.remove(id); }
            try { if (input != null) input.close(); call.resolve(); }
            catch (Exception e) { call.reject("Could not close the file stream: " + e.getMessage(), e); }
        });
    }

    private void closeFolderReadStreamQuietly(String id) {
        InputStream input; synchronized (folderReadStreams) { input = folderReadStreams.remove(id); }
        if (input != null) try { input.close(); } catch (Exception ignored) {}
    }

    @PluginMethod
    public void openFolderStream(PluginCall call) {
        storageExecutor.execute(() -> {
            try {
                String treeUriStr = call.getString("uri"), fileName = call.getString("fileName"), id = call.getString("id");
                if (treeUriStr == null || fileName == null || id == null) { call.reject("Missing 'uri', 'fileName' or 'id'"); return; }
                Uri treeUri = Uri.parse(treeUriStr);
                JSArray dirPathArr = call.getArray("dirPath");
                Uri dirUri = dirPathArr != null && dirPathArr.length() > 0
                    ? getOrCreateDir(treeUri, jsArrayToStringArray(dirPathArr))
                    : DocumentsContract.buildDocumentUriUsingTree(treeUri, DocumentsContract.getTreeDocumentId(treeUri));
                Uri fileUri = getOrCreateFile(treeUri, dirUri, fileName, "application/json");
                OutputStream stream = getContext().getContentResolver().openOutputStream(fileUri, "wt");
                if (stream == null) throw new Exception("Failed to open file for writing");
                synchronized (folderStreams) { OutputStream old = folderStreams.put(id, new java.io.BufferedOutputStream(stream, 64 * 1024)); if (old != null) { try { old.close(); } catch (Exception ignored) {} } }
                call.resolve();
            } catch (Exception e) { call.reject("Could not open the file for streaming: " + e.getMessage(), e); }
        });
    }

    @PluginMethod
    public void writeFolderStream(PluginCall call) {
        storageExecutor.execute(() -> {
            try {
                String id = call.getString("id"), content = call.getString("content");
                OutputStream stream; synchronized (folderStreams) { stream = folderStreams.get(id); }
                if (stream == null) throw new Exception("No open stream");
                if (content != null) stream.write(content.getBytes(StandardCharsets.UTF_8));
                call.resolve();
            } catch (Exception e) { closeFolderStreamQuietly(call.getString("id")); call.reject("Stream write failed: " + e.getMessage(), e); }
        });
    }

    @PluginMethod
    public void closeFolderStream(PluginCall call) {
        storageExecutor.execute(() -> {
            try {
                String id = call.getString("id");
                OutputStream stream; synchronized (folderStreams) { stream = folderStreams.remove(id); }
                if (stream != null) { stream.flush(); stream.close(); }
                call.resolve();
            } catch (Exception e) { call.reject("Could not finish the file: " + e.getMessage(), e); }
        });
    }

    @PluginMethod
    public void renameFolderFile(PluginCall call) {
        storageExecutor.execute(() -> {
            Uri previous = null;
            try {
                String treeUriStr = call.getString("uri"), fromName = call.getString("fromName"), toName = call.getString("toName");
                if (treeUriStr == null || fromName == null || toName == null) throw new Exception("Missing folder or file name");
                Uri treeUri = Uri.parse(treeUriStr);
                JSArray dirPath = call.getArray("dirPath");
                Uri directory = dirPath != null && dirPath.length() > 0
                    ? getOrCreateDir(treeUri, jsArrayToStringArray(dirPath))
                    : DocumentsContract.buildDocumentUriUsingTree(treeUri, DocumentsContract.getTreeDocumentId(treeUri));
                Uri source = findChildDocument(treeUri, directory, fromName);
                if (source == null) throw new Exception("Temporary database file is missing");
                Uri old = findChildDocument(treeUri, directory, toName);
                String previousName = toName + ".previous";
                Uri stalePrevious = findChildDocument(treeUri, directory, previousName);
                if (stalePrevious != null) DocumentsContract.deleteDocument(getContext().getContentResolver(), stalePrevious);
                if (old != null) {
                    previous = DocumentsContract.renameDocument(getContext().getContentResolver(), old, previousName);
                    if (previous == null) throw new Exception("Could not preserve the previous database");
                }
                Uri renamed = DocumentsContract.renameDocument(getContext().getContentResolver(), source, toName);
                if (renamed == null) throw new Exception("Could not publish the completed database");
                if (previous != null) DocumentsContract.deleteDocument(getContext().getContentResolver(), previous);
                call.resolve();
            } catch (Exception e) {
                try {
                    if (previous != null) {
                        Uri treeUri = Uri.parse(call.getString("uri"));
                        JSArray dirPath = call.getArray("dirPath");
                        Uri directory = dirPath != null && dirPath.length() > 0
                            ? getOrCreateDir(treeUri, jsArrayToStringArray(dirPath))
                            : DocumentsContract.buildDocumentUriUsingTree(treeUri, DocumentsContract.getTreeDocumentId(treeUri));
                        Uri target = findChildDocument(treeUri, directory, call.getString("toName"));
                        if (target == null) DocumentsContract.renameDocument(getContext().getContentResolver(), previous, call.getString("toName"));
                    }
                } catch (Exception ignored) {}
                call.reject("Could not publish the completed database: " + e.getMessage(), e);
            }
        });
    }

    private void closeFolderStreamQuietly(String id) {
        OutputStream stream; synchronized (folderStreams) { stream = folderStreams.remove(id); }
        if (stream != null) { try { stream.close(); } catch (Exception ignored) {} }
    }


    @PluginMethod
    public void writeNestedBinaryFile(PluginCall call) {
        storageExecutor.execute(() -> doWriteNestedBinaryFile(call));
    }

    private void doWriteNestedBinaryFile(PluginCall call) {
        String treeUriStr = call.getString("uri");
        JSArray dirPathArr = call.getArray("dirPath");
        String fileName = call.getString("fileName");
        String base64Content = call.getString("base64Content");

        if (treeUriStr == null || dirPathArr == null || fileName == null || base64Content == null) {
            call.reject("Missing 'uri', 'dirPath', 'fileName', or 'base64Content' parameter");
            return;
        }

        try {
            Uri treeUri = Uri.parse(treeUriStr);
            String[] dirPath = jsArrayToStringArray(dirPathArr);
            Uri dirUri = getOrCreateDir(treeUri, dirPath);
            Uri fileUri = getOrCreateFile(treeUri, dirUri, fileName, "application/octet-stream");

            byte[] bytes = Base64.decode(base64Content, Base64.DEFAULT);

            OutputStream stream = getContext().getContentResolver().openOutputStream(fileUri, "wt");
            if (stream == null) throw new Exception("Failed to open file for writing");
            try (OutputStream out = stream) { out.write(bytes); }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("uri", fileUri.toString());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to write nested binary file: " + e.getMessage(), e);
        }
    }

    private String[] jsArrayToStringArray(JSArray arr) throws Exception {
        java.util.List<Object> list = arr.toList();
        String[] out = new String[list.size()];
        for (int i = 0; i < list.size(); i++) {
            out[i] = String.valueOf(list.get(i));
        }
        return out;
    }

    // Recursively archives everything under <root>/<sourceDirPath...> (i.e. screenmark-db/)
    // into a POSIX tar, and writes it as <root>/<tarFileName> — a sibling of the
    // source folder, not inside it. Walking + tarring natively avoids round-tripping
    // every file's bytes through the JS bridge twice (once to read, once to re-write).
    @PluginMethod
    public void exportTarArchive(PluginCall call) {
        storageExecutor.execute(() -> doExportTarArchive(call));
    }

    // Reads both the legacy root-level database.json entry and the current
    // screenmark-db/database.json entry. SAF stream reading stays off the UI thread.
    @PluginMethod
    public void readTarEntry(PluginCall call) {
        storageExecutor.execute(() -> doReadTarEntry(call));
    }

    private void doReadTarEntry(PluginCall call) {
        String uriStr = call.getString("uri");
        String requested = call.getString("entryName");
        if (uriStr == null || requested == null) {
            call.reject("Missing 'uri' or 'entryName' parameter");
            return;
        }
        try (InputStream raw = getContext().getContentResolver().openInputStream(Uri.parse(uriStr))) {
            if (raw == null) throw new IOException("Failed to open archive");
            try (TarArchiveInputStream tar = new TarArchiveInputStream(raw)) {
                TarArchiveEntry entry;
                while ((entry = tar.getNextTarEntry()) != null) {
                    String name = entry.getName();
                    boolean databaseAlias = requested.endsWith("_database.json") && name.endsWith("/database.json");
                    if (!entry.isDirectory() && (requested.equals(name) ||
                        ("database.json".equals(requested) && name.endsWith("/database.json")) || databaseAlias)) {
                        // Avoid unbounded allocation from a damaged or malicious archive.
                        final int maxBytes = 256 * 1024 * 1024;
                        if (entry.getSize() < 0 || entry.getSize() > maxBytes) {
                            throw new IOException("Archive database entry is too large");
                        }
                        ByteArrayOutputStream bytes = new ByteArrayOutputStream(
                            (int) Math.min(entry.getSize(), 1024 * 1024));
                        byte[] chunk = new byte[8192];
                        int count;
                        while ((count = tar.read(chunk)) != -1) {
                            if (bytes.size() + count > maxBytes) throw new IOException("Archive database entry is too large");
                            bytes.write(chunk, 0, count);
                        }
                        JSObject result = new JSObject();
                        result.put("content", bytes.toString("UTF-8"));
                        call.resolve(result);
                        return;
                    }
                }
            }
            call.reject("Database entry was not found in the archive");
        } catch (Exception e) {
            call.reject("Failed to read TAR archive: " + e.getMessage(), e);
        }
    }

    private void doExportTarArchive(PluginCall call) {
        String treeUriStr = call.getString("uri");
        JSArray sourceDirPathArr = call.getArray("sourceDirPath");
        String tarFileName = call.getString("tarFileName");

        if (treeUriStr == null || sourceDirPathArr == null || tarFileName == null) {
            call.reject("Missing 'uri', 'sourceDirPath', or 'tarFileName' parameter");
            return;
        }

        try {
            Uri treeUri = Uri.parse(treeUriStr);
            String[] sourceDirPath = jsArrayToStringArray(sourceDirPathArr);
            String extraJsonFileName = call.getString("extraJsonFileName");
            Uri sourceDirUri = getOrCreateDir(treeUri, sourceDirPath);
            String rootFolderName = sourceDirPath[sourceDirPath.length - 1];

            Uri rootDir = DocumentsContract.buildDocumentUriUsingTree(
                treeUri,
                DocumentsContract.getTreeDocumentId(treeUri)
            );
            Uri tarUri = getOrCreateFile(treeUri, rootDir, tarFileName, "application/x-tar");

            OutputStream stream = getContext().getContentResolver().openOutputStream(tarUri, "wt");
            if (stream == null) throw new Exception("Failed to open tar file for writing");
            try (TarArchiveOutputStream tar = new TarArchiveOutputStream(stream, "UTF-8")) {
                tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX);
                tar.setBigNumberMode(TarArchiveOutputStream.BIGNUMBER_POSIX);
                tar.setAddPaxHeadersForNonAsciiNames(true);
                // Keep the historical root entry so old restore clients continue
                // to work; its source is the already-written folder database, not
                // a large duplicate JSON string passed over the JS bridge.
                Uri databaseUri = findChildDocument(treeUri, sourceDirUri, "database.json");
                if (databaseUri != null && extraJsonFileName != null) {
                    addFileToTar(treeUri, databaseUri, extraJsonFileName, tar);
                }
                addDirToTar(treeUri, sourceDirUri, rootFolderName, tar);
                tar.finish();
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("uri", tarUri.toString());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to export tar archive: " + e.getMessage(), e);
        }
    }

    private void addDirToTar(Uri treeUri, Uri dirUri, String archivePathPrefix, TarArchiveOutputStream tar) throws Exception {
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            treeUri,
            DocumentsContract.getDocumentId(dirUri)
        );

        Cursor cursor = getContext().getContentResolver().query(
            childrenUri,
            new String[] {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE
            },
            null, null, null
        );

        if (cursor == null) return;

        try (Cursor rows = cursor) {
            while (rows.moveToNext()) {
                String docId = rows.getString(0);
                String name = rows.getString(1);
                String mimeType = rows.getString(2);
                Uri childUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);
                String archivePath = archivePathPrefix + "/" + name;

                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mimeType)) {
                    addDirToTar(treeUri, childUri, archivePath, tar);
                } else {
                    addFileToTar(treeUri, childUri, archivePath, tar);
                }
            }
        }
    }

    private void addFileToTar(Uri treeUri, Uri fileUri, String archivePath, TarArchiveOutputStream tar) throws Exception {
        long size = queryDocumentSize(treeUri, fileUri);
        File staged = null;
        if (size < 0) {
            // SAF usually reports file sizes. If a cloud provider does not, stage
            // one file at a time so TAR can still write a known-size entry without
            // retaining the library or file contents in heap memory.
            staged = File.createTempFile("screenmark-tar-", ".part", getContext().getCacheDir());
            try (InputStream in = getContext().getContentResolver().openInputStream(fileUri);
                 OutputStream out = new FileOutputStream(staged)) {
                if (in == null) throw new IOException("Failed to open backup item");
                size = copy(in, out);
            }
        }
        try {
            TarArchiveEntry entry = new TarArchiveEntry(archivePath);
            entry.setSize(size);
            tar.putArchiveEntry(entry);
            try (InputStream in = staged == null
                    ? getContext().getContentResolver().openInputStream(fileUri)
                    : new FileInputStream(staged)) {
                if (in == null) throw new IOException("Failed to open backup item");
                long copied = copy(in, tar);
                if (copied != size) throw new IOException("Backup item changed while it was being archived");
            }
            tar.closeArchiveEntry();
        } finally {
            if (staged != null && staged.exists()) staged.delete();
        }
    }

    private long queryDocumentSize(Uri treeUri, Uri fileUri) {
        try (Cursor cursor = getContext().getContentResolver().query(fileUri,
                new String[] { DocumentsContract.Document.COLUMN_SIZE }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) return cursor.getLong(0);
        } catch (Exception ignored) {}
        return -1;
    }

    private long copy(InputStream in, OutputStream out) throws IOException {
        byte[] chunk = new byte[32 * 1024];
        long total = 0;
        int count;
        while ((count = in.read(chunk)) != -1) {
            out.write(chunk, 0, count);
            total += count;
        }
        return total;
    }

}
