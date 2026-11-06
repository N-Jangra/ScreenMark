package com.cuemark.screenmark;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.MimeTypeMap;

import androidx.core.content.FileProvider;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "ShareIntent", permissions = {
    @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" })
})
public class ShareIntentPlugin extends Plugin {
    private final ExecutorService imageExecutor = Executors.newSingleThreadExecutor();
    private static final String DOWNLOAD_CHANNEL_ID = "image-downloads";

    @PluginMethod
    public void getInitialShare(PluginCall call) {
        Intent intent = getActivity().getIntent();
        JSObject result = new JSObject();
        String text = extractText(intent);
        if (text != null && !text.isEmpty()) {
            result.put("text", text);
            result.put("type", intent.getType() == null ? "" : intent.getType());
            call.resolve(result);
        } else {
            result.put("text", "");
            result.put("type", "");
            call.resolve(result);
        }
    }

    private String extractText(Intent intent) {
        if (intent == null) return "";
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text != null && !text.isEmpty()) return text;
        Uri data = intent.getData();
        return data == null ? "" : data.toString();
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        String text = call.getString("text", "");
        String title = call.getString("title", "Share");
        if (text.isEmpty()) { call.reject("Nothing to share."); return; }
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, text);
        Intent chooser = Intent.createChooser(send, title);
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(chooser);
        call.resolve();
    }

    @PluginMethod
    public void shareImage(PluginCall call) { withImage(call, "share"); }

    // Large files cross the WebView bridge slowly in one piece, so they are sent in small chunks.
    private File chunkFile;
    private FileOutputStream chunkOut;

    @PluginMethod
    public void beginFile(PluginCall call) {
        String ext = call.getString("extension", "pdf").replaceAll("[^A-Za-z0-9]", "");
        String name = call.getString("filename", "ScreenMark").replaceAll("[^A-Za-z0-9._-]", "-").replaceAll("\\.+$", "");
        final String safeName = name.isEmpty() ? "ScreenMark" : name;
        imageExecutor.execute(() -> {
            try {
                synchronized (this) {
                    if (chunkOut != null) { try { chunkOut.close(); } catch (Exception ignored) {} chunkOut = null; }
                    File directory = new File(getContext().getCacheDir(), "shared-images");
                    if (!directory.exists() && !directory.mkdirs()) throw new Exception("Could not prepare the file.");
                    chunkFile = new File(directory, UUID.randomUUID() + "-" + safeName + "." + ext);
                    chunkOut = new FileOutputStream(chunkFile);
                }
                call.resolve();
            } catch (Exception error) { call.reject(error.getMessage() == null ? "Could not start the file." : error.getMessage(), error); }
        });
    }

    @PluginMethod
    public void appendFileChunk(PluginCall call) {
        String data = call.getString("data", "");
        imageExecutor.execute(() -> {
            try {
                synchronized (this) {
                    if (chunkOut == null) throw new Exception("No file is open.");
                    chunkOut.write(android.util.Base64.decode(data, android.util.Base64.DEFAULT));
                }
                call.resolve();
            } catch (Exception error) { call.reject(error.getMessage() == null ? "Could not write the file." : error.getMessage(), error); }
        });
    }

    @PluginMethod
    public void saveChunkedFile(PluginCall call) {
        String mime = call.getString("mimeType", "application/pdf");
        String name = call.getString("filename", "ScreenMark").replaceAll("[^A-Za-z0-9._-]", "-").replaceAll("\\.+$", "");
        final String safeName = name.isEmpty() ? "ScreenMark" : name;
        imageExecutor.execute(() -> {
            try {
                File source;
                synchronized (this) {
                    if (chunkOut == null || chunkFile == null) throw new Exception("No file to save.");
                    chunkOut.close(); chunkOut = null;
                    source = chunkFile;
                }
                byte[] bytes = java.nio.file.Files.readAllBytes(source.toPath());
                String location = saveDownload(safeName, new ImageData(bytes, mime));
                String actualName = location.substring(location.lastIndexOf('/') + 1);
                boolean notified = postDownloadNotification(actualName, location);
                JSObject result = new JSObject(); result.put("location", location); result.put("notification", notified);
                call.resolve(result);
            } catch (Exception error) { call.reject(error.getMessage() == null ? "Could not save the file." : error.getMessage(), error); }
        });
    }

    @PluginMethod
    public void shareChunkedFile(PluginCall call) {
        String mime = call.getString("mimeType", "application/pdf");
        String title = call.getString("title", "ScreenMark");
        imageExecutor.execute(() -> {
            try {
                final Uri uri;
                synchronized (this) {
                    if (chunkOut == null || chunkFile == null) throw new Exception("No file to share.");
                    chunkOut.close(); chunkOut = null;
                    uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", chunkFile);
                }
                getActivity().runOnUiThread(() -> {
                    try {
                        Intent send = new Intent(Intent.ACTION_SEND);
                        send.setType(mime);
                        send.putExtra(Intent.EXTRA_STREAM, uri);
                        send.putExtra(Intent.EXTRA_SUBJECT, title);
                        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        Intent chooser = Intent.createChooser(send, "Share");
                        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        getActivity().startActivity(chooser);
                        call.resolve();
                    } catch (Exception error) { call.reject("Could not open Android sharing.", error); }
                });
            } catch (Exception error) { call.reject(error.getMessage() == null ? "Could not share the file." : error.getMessage(), error); }
        });
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        String data = call.getString("data", "");
        String mime = call.getString("mimeType", "application/pdf");
        String ext = call.getString("extension", "pdf").replaceAll("[^A-Za-z0-9]", "");
        String name = call.getString("filename", "ScreenMark").replaceAll("[^A-Za-z0-9._-]", "-").replaceAll("\\.+$", "");
        String title = call.getString("title", "ScreenMark");
        if (data.isEmpty()) { call.reject("Nothing to share."); return; }
        final String safeName = name.isEmpty() ? "ScreenMark" : name;
        imageExecutor.execute(() -> {
            try {
                byte[] bytes = android.util.Base64.decode(data, android.util.Base64.DEFAULT);
                File directory = new File(getContext().getCacheDir(), "shared-images");
                if (!directory.exists() && !directory.mkdirs()) throw new Exception("Could not prepare the file.");
                File file = new File(directory, UUID.randomUUID() + "-" + safeName + "." + ext);
                try (FileOutputStream output = new FileOutputStream(file)) { output.write(bytes); }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                getActivity().runOnUiThread(() -> {
                    try {
                        Intent send = new Intent(Intent.ACTION_SEND);
                        send.setType(mime);
                        send.putExtra(Intent.EXTRA_STREAM, uri);
                        send.putExtra(Intent.EXTRA_SUBJECT, title);
                        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        Intent chooser = Intent.createChooser(send, "Share");
                        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        getActivity().startActivity(chooser);
                        call.resolve();
                    } catch (Exception error) { call.reject("Could not open Android sharing.", error); }
                });
            } catch (Exception error) { call.reject(error.getMessage() == null ? "Could not process this file." : error.getMessage(), error); }
        });
    }

    // Multi-image share: images are staged one at a time (keeps each bridge call small), then sent together.
    private final java.util.ArrayList<Uri> stagedImages = new java.util.ArrayList<>();

    @PluginMethod
    public void clearStagedImages(PluginCall call) { synchronized (stagedImages) { stagedImages.clear(); } call.resolve(); }

    @PluginMethod
    public void stageImage(PluginCall call) {
        String source = call.getString("src", "");
        String name = call.getString("filename", "ScreenMark-image").replaceAll("[^A-Za-z0-9._-]", "-").replaceAll("\\.+$", "");
        if (source.isEmpty()) { call.reject("The image source is empty."); return; }
        final String safeName = name.isEmpty() ? "ScreenMark-image" : name;
        imageExecutor.execute(() -> {
            try {
                ImageData image = readImage(source);
                File cached = cacheImage(safeName, image);
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", cached);
                synchronized (stagedImages) { stagedImages.add(uri); }
                call.resolve();
            } catch (Exception error) { call.reject(error.getMessage() == null ? "Could not process this image." : error.getMessage(), error); }
        });
    }

    @PluginMethod
    public void shareStagedImages(PluginCall call) {
        final java.util.ArrayList<Uri> uris;
        synchronized (stagedImages) { uris = new java.util.ArrayList<>(stagedImages); stagedImages.clear(); }
        if (uris.isEmpty()) { call.reject("No images to share."); return; }
        String title = call.getString("title", "ScreenMark images");
        getActivity().runOnUiThread(() -> {
            try {
                Intent send = new Intent(uris.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
                send.setType("image/*");
                if (uris.size() == 1) send.putExtra(Intent.EXTRA_STREAM, uris.get(0)); else send.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
                send.putExtra(Intent.EXTRA_SUBJECT, title);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, "Share images");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().startActivity(chooser);
                JSObject result = new JSObject(); result.put("shared", uris.size()); call.resolve(result);
            } catch (Exception error) { call.reject("Could not open Android sharing.", error); }
        });
    }

    @PluginMethod
    public void copyImage(PluginCall call) { withImage(call, "copy"); }

    @PluginMethod
    public void downloadImage(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "downloadNotificationPermissionResult");
            return;
        }
        withImage(call, "download");
    }

    @PermissionCallback
    private void downloadNotificationPermissionResult(PluginCall call) { withImage(call, "download"); }

    private void withImage(PluginCall call, String action) {
        String source = call.getString("src", "");
        String requestedName = call.getString("filename", "ScreenMark-image");
        String title = call.getString("title", "ScreenMark image");
        if (source.isEmpty()) { call.reject("The image source is empty."); return; }
        String filename = requestedName.replaceAll("[^A-Za-z0-9._-]", "-").replaceAll("\\.+$", "");
        if (filename.isEmpty()) filename = "ScreenMark-image";
        final String safeFilename = filename;
        imageExecutor.execute(() -> {
            try {
                ImageData image = readImage(source);
                if ("download".equals(action)) {
                    String location = saveDownload(safeFilename, image);
                    String actualName = location.substring(location.lastIndexOf('/') + 1);
                    boolean notified = postDownloadNotification(actualName, location);
                    JSObject result = new JSObject(); result.put("location", location); result.put("notification", notified); call.resolve(result);
                    return;
                }
                File cached = cacheImage(safeFilename, image);
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", cached);
                if ("copy".equals(action)) {
                    getActivity().runOnUiThread(() -> {
                        try {
                            ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
                            clipboard.setPrimaryClip(ClipData.newUri(getContext().getContentResolver(), title, uri));
                            JSObject result = new JSObject(); result.put("copied", true); call.resolve(result);
                        } catch (Exception error) { call.reject("Could not copy the image.", error); }
                    });
                } else {
                    getActivity().runOnUiThread(() -> {
                        try {
                            Intent send = new Intent(Intent.ACTION_SEND);
                            send.setType(image.mimeType);
                            send.putExtra(Intent.EXTRA_STREAM, uri);
                            send.putExtra(Intent.EXTRA_SUBJECT, title);
                            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            Intent chooser = Intent.createChooser(send, "Share image");
                            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            getActivity().startActivity(chooser);
                            JSObject result = new JSObject(); result.put("shared", true); call.resolve(result);
                        } catch (Exception error) { call.reject("Could not open Android sharing.", error); }
                    });
                }
            } catch (Exception error) {
                call.reject(error.getMessage() == null ? "Could not process this image." : error.getMessage(), error);
            }
        });
    }

    private ImageData readImage(String source) throws Exception {
        byte[] bytes;
        String mime = "";
        if (source.startsWith("data:")) {
            int comma = source.indexOf(',');
            if (comma < 0) throw new Exception("Invalid image data.");
            String header = source.substring(5, comma);
            int semicolon = header.indexOf(';');
            mime = (semicolon < 0 ? header : header.substring(0, semicolon)).toLowerCase(Locale.ROOT);
            String payload = source.substring(comma + 1);
            bytes = header.contains("base64")
                ? android.util.Base64.decode(payload, android.util.Base64.DEFAULT)
                : URLDecoder.decode(payload, StandardCharsets.UTF_8.name()).getBytes(StandardCharsets.UTF_8);
        } else {
            URLConnection connection = new URL(source).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setRequestProperty("User-Agent", "ScreenMark Android");
            if (connection instanceof HttpURLConnection) ((HttpURLConnection) connection).setInstanceFollowRedirects(true);
            mime = connection.getContentType() == null ? "" : connection.getContentType().split(";")[0].trim().toLowerCase(Locale.ROOT);
            try (InputStream input = connection.getInputStream()) { bytes = readLimited(input); }
            finally { if (connection instanceof HttpURLConnection) ((HttpURLConnection) connection).disconnect(); }
        }
        if (bytes.length == 0) throw new Exception("The image is empty.");
        if (bytes.length > 25 * 1024 * 1024) throw new Exception("This image is too large to process.");
        if (!mime.startsWith("image/")) {
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            mime = options.outMimeType == null ? "image/jpeg" : options.outMimeType;
        }
        return new ImageData(bytes, mime);
    }

    private byte[] readLimited(InputStream input) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int total = 0, count;
        while ((count = input.read(buffer)) != -1) {
            total += count;
            if (total > 25 * 1024 * 1024) throw new Exception("This image is too large to process.");
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }

    private String extension(String mime) {
        String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
        return extension == null || extension.isEmpty() ? "jpg" : extension;
    }

    private File cacheImage(String baseName, ImageData image) throws Exception {
        File directory = new File(getContext().getCacheDir(), "shared-images");
        if (!directory.exists() && !directory.mkdirs()) throw new Exception("Could not prepare the image.");
        File file = new File(directory, UUID.randomUUID() + "-" + baseName + "." + extension(image.mimeType));
        try (FileOutputStream output = new FileOutputStream(file)) { output.write(image.bytes); }
        return file;
    }

    private String saveDownload(String baseName, ImageData image) throws Exception {
        String filename = baseName.replaceAll("\\.[A-Za-z0-9]{2,5}$", "") + "." + extension(image.mimeType);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, image.mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new Exception("Could not save the image to Downloads.");
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri)) {
                if (output == null) throw new Exception("Could not write the downloaded image.");
                output.write(image.bytes);
            } catch (Exception error) {
                getContext().getContentResolver().delete(uri, null, null);
                throw error;
            }
            ContentValues ready = new ContentValues(); ready.put(MediaStore.Downloads.IS_PENDING, 0);
            getContext().getContentResolver().update(uri, ready, null, null);
            return "Downloads/" + filename;
        }
        File directory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null) throw new Exception("Downloads storage is unavailable.");
        if (!directory.exists() && !directory.mkdirs()) throw new Exception("Could not prepare Downloads.");
        File target = new File(directory, filename);
        try (FileOutputStream output = new FileOutputStream(target)) { output.write(image.bytes); }
        return target.getAbsolutePath();
    }

    private boolean postDownloadNotification(String filename, String location) {
        try {
            Context context = getContext();
            if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false;
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(DOWNLOAD_CHANNEL_ID, "Image downloads", NotificationManager.IMPORTANCE_DEFAULT);
                channel.setDescription("Shows when an image has finished saving to Downloads.");
                manager.createNotificationChannel(channel);
            }
            NotificationCompat.Builder notification = new NotificationCompat.Builder(context, DOWNLOAD_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("Download complete")
                .setContentText(filename)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(filename + " saved to " + location))
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (launch != null) {
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
                PendingIntent pendingIntent = PendingIntent.getActivity(context, (int) System.currentTimeMillis(), launch, flags);
                notification.setContentIntent(pendingIntent);
            }
            manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), notification.build());
            return true;
        } catch (SecurityException denied) {
            return false;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static class ImageData {
        final byte[] bytes;
        final String mimeType;
        ImageData(byte[] bytes, String mimeType) { this.bytes = bytes; this.mimeType = mimeType; }
    }
}
