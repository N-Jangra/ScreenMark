package com.cuemark.screenmark;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.system.Os;
import android.security.keystore.KeyGenParameterSpec;
import android.security.KeyPairGeneratorSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.security.MessageDigest;
import java.math.BigInteger;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Calendar;
import java.util.Map;
import java.util.LinkedHashMap;
import org.json.JSONArray;
import org.json.JSONObject;
import javax.crypto.KeyGenerator;
import javax.crypto.spec.SecretKeySpec;
import javax.security.auth.x500.X500Principal;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Stores the main ScreenMark state encrypted with an Android Keystore key. */
@CapacitorPlugin(name = "EncryptedStore")
public class EncryptedStorePlugin extends Plugin {
    private static final String PREFS = "screenmark_encrypted_store";
    private static final String VALUE = "state";
    private static final String ITEM_PREFIX = "item_";
    private static final String META_VALUE = "meta";
    private static final String KEY_ALIAS = "screenmark_state_key";
    private static final String LEGACY_RSA_ALIAS = "screenmark_state_rsa_key";
    private static final String LEGACY_WRAPPED_KEY = "legacy_wrapped_key";
    private final Object mirrorLock = new Object();

    // Redundant encrypted snapshot under Android/data/<package>/files. IndexedDB
    // remains Chromium's live database; this mirror is only a native recovery copy.
    private File mirrorDirectory() throws Exception {
        File external = getContext().getExternalFilesDir(null);
        if (external == null) throw new IllegalStateException("App-specific external storage is unavailable");
        File directory = new File(external, "CueMark/ScreenMark/records");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IllegalStateException("Could not create app data mirror");
        return directory;
    }

    private String safeRecordName(String id) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(id.getBytes(StandardCharsets.UTF_8));
        StringBuilder name = new StringBuilder();
        for (byte value : digest) name.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
        return name.toString() + ".enc";
    }

    private File recordFile(File directory, String id) throws Exception { return new File(directory, safeRecordName(id)); }
    private File deletionFile(File directory, String id) throws Exception { return new File(directory, safeRecordName(id).replace(".enc", ".deleted")); }
    private long deletionTime(File file) {
        try { return Long.parseLong(readMirror(file)); } catch (Exception ignored) { return 0; }
    }

    private void writeMirror(File target, String value) throws Exception {
        File temporary = new File(target.getParentFile(), target.getName() + ".tmp");
        try (FileOutputStream output = new FileOutputStream(temporary)) {
            output.write(value.getBytes(StandardCharsets.UTF_8));
            output.getFD().sync();
        }
        try { Os.rename(temporary.getAbsolutePath(), target.getAbsolutePath()); }
        catch (Exception error) { temporary.delete(); throw new IllegalStateException("Could not publish mirrored record", error); }
    }

    private String readMirror(File target) throws Exception {
        if (!target.isFile()) return null;
        try (FileInputStream input = new FileInputStream(target); java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString("UTF-8");
        }
    }

    private void deleteMirror() {
        File external = getContext().getExternalFilesDir(null);
        deleteRecursively(external == null ? null : new File(external, "CueMark/ScreenMark"));
    }

    private void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteRecursively(child);
        file.delete();
    }

    @PluginMethod
    public void getMirrorLocation(PluginCall call) {
        try { call.resolve(new JSObject().put("path", mirrorDirectory().getParentFile().getAbsolutePath())); }
        catch (Exception e) { call.reject("App data mirror is unavailable", e); }
    }

    @PluginMethod
    public void ensureMirror(PluginCall call) {
        new Thread(() -> {
            try {
                synchronized (mirrorLock) {
                    File records = mirrorDirectory(), root = records.getParentFile();
                    File marker = new File(root, "mirror-v1.ready");
                    if (!marker.isFile()) {
                        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                        for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
                            if (!(entry.getValue() instanceof String)) continue;
                            String key = entry.getKey(), packed = (String) entry.getValue();
                            if (key.startsWith(ITEM_PREFIX)) {
                                try {
                                    String id = new JSONObject(decrypt(packed)).optString("id", "");
                                    if (!id.isEmpty()) writeMirror(new File(records, safeRecordName(id)), packed);
                                } catch (Exception ignored) { }
                            } else if (key.equals(META_VALUE) || key.equals(VALUE)) {
                                writeMirror(new File(root, key.equals(META_VALUE) ? "meta.enc" : "state.enc"), packed);
                            }
                        }
                        writeMirror(marker, "1");
                    }
                }
                call.resolve(new JSObject().put("success", true));
            } catch (Exception e) { call.reject("Could not prepare app data recovery mirror", e); }
        }, "ScreenMark-AppDataMirror").start();
    }

    @PluginMethod
    public void isLibraryMirrorReady(PluginCall call) {
        try {
            File records = mirrorDirectory();
            JSONArray ids = call.getArray("ids");
            int count = 0;
            if (ids != null) {
                for (int index = 0; index < ids.length(); index++) {
                    String id = ids.optString(index, "");
                    if (!id.isEmpty() && recordFile(records, id).isFile()) count++;
                }
                call.resolve(new JSObject().put("ready", count == ids.length()).put("count", count));
            } else {
                String saved = readMirror(new File(records.getParentFile(), "library-v1.ready"));
                call.resolve(new JSObject().put("ready", saved != null).put("count", saved == null ? -1 : Integer.parseInt(saved)));
            }
        }
        catch (Exception e) { call.reject("Could not inspect app data mirror", e); }
    }

    @PluginMethod
    public void syncMirrorBatch(PluginCall call) {
        JSONArray items = call.getArray("items");
        if (items == null) { call.reject("Missing mirror item batch"); return; }
        try {
            synchronized (mirrorLock) {
                File records = mirrorDirectory();
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.optJSONObject(i);
                    if (item == null || item.isNull("id")) continue;
                    String id = item.optString("id", "");
                    if (id.isEmpty()) continue;
                    File deleted = deletionFile(records, id), target = recordFile(records, id);
                    if (deletionTime(deleted) >= item.optLong("updatedAt")) continue;
                    if (target.isFile()) try {
                        JSONObject previous = new JSONObject(decrypt(readMirror(target)));
                        if (previous.optLong("updatedAt") > item.optLong("updatedAt")) continue;
                    } catch (Exception ignored) { }
                    deleted.delete();
                    writeMirror(target, encrypt(item.toString()));
                }
            }
            call.resolve(new JSObject().put("written", items.length()));
        } catch (Exception e) { call.reject("Could not mirror library records", e); }
    }

    @PluginMethod
    public void finishLibraryMirrorSync(PluginCall call) {
        try {
            synchronized (mirrorLock) {
                int count = call.getInt("count", 0);
                writeMirror(new File(mirrorDirectory().getParentFile(), "library-v1.ready"), Integer.toString(count));
            }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) { call.reject("Could not finalize app data mirror", e); }
    }

    public static String readPackedState(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONObject records = new JSONObject();
        try {
            for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
                if (entry.getValue() instanceof String) records.put(entry.getKey(), entry.getValue());
            }
            if (records.length() == 0) return null;
            JSONObject backup = new JSONObject();
            backup.put("format", "screenmark-encrypted-store-v2");
            backup.put("records", records);
            return backup.toString();
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void getState(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String packed = prefs.getString(VALUE, null);
            if (packed == null) try { packed = readMirror(new File(mirrorDirectory().getParentFile(), "state.enc")); } catch (Exception ignored) { }
            JSObject result = new JSObject();
            result.put("exists", packed != null && !packed.isEmpty());
            if (packed != null && !packed.isEmpty()) result.put("data", decrypt(packed));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not decrypt local database", e);
        }
    }

    @PluginMethod
    public void setState(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Missing state data");
            return;
        }
        try {
            String packed = encrypt(data);
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(VALUE, packed).apply();
            try { synchronized (mirrorLock) { writeMirror(new File(mirrorDirectory().getParentFile(), "state.enc"), packed); } } catch (Exception ignored) { }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.reject("Could not encrypt local database", e);
        }
    }

    /** Reads the item-level store used by current app versions. */
    @PluginMethod
    public void getItems(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            Map<String, JSONObject> byId = new LinkedHashMap<>();
            File records = null;
            try { records = mirrorDirectory(); } catch (Exception ignored) { }
            for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
                if (!entry.getKey().startsWith(ITEM_PREFIX) || !(entry.getValue() instanceof String)) continue;
                try {
                    JSONObject item = new JSONObject(decrypt((String) entry.getValue()));
                    String id = item.optString("id", entry.getKey().substring(ITEM_PREFIX.length()));
                    if (records == null || deletionTime(deletionFile(records, id)) < item.optLong("updatedAt")) byId.put(id, item);
                } catch (Exception ignored) {
                    // A damaged item should not prevent the rest of the library from opening.
                }
            }
            File[] recordFiles = records == null ? null : records.listFiles((directory, name) -> name.endsWith(".enc"));
            if (recordFiles != null) for (File record : recordFiles) try {
                JSONObject item = new JSONObject(decrypt(readMirror(record)));
                String id = item.optString("id", ""); JSONObject previous = byId.get(id);
                if (!id.isEmpty() && deletionTime(deletionFile(records, id)) < item.optLong("updatedAt")
                    && (previous == null || item.optLong("updatedAt") >= previous.optLong("updatedAt"))) byId.put(id, item);
            } catch (Exception ignored) { }
            JSONArray items = new JSONArray();
            for (JSONObject item : byId.values()) items.put(item);
            JSObject result = new JSObject();
            result.put("exists", items.length() > 0);
            result.put("data", items.toString());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read encrypted items", e);
        }
    }

    @PluginMethod
    public void setItem(PluginCall call) {
        String id = call.getString("id");
        String data = call.getString("data");
        if (id == null || id.isEmpty() || data == null) {
            call.reject("Missing item data");
            return;
        }
        try {
            // Validate before writing so malformed calls cannot create unusable records.
            new JSONObject(data);
            String packed = encrypt(data);
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(ITEM_PREFIX + id, packed).apply();
            try { synchronized (mirrorLock) { File records = mirrorDirectory(); deletionFile(records, id).delete(); writeMirror(recordFile(records, id), packed); } } catch (Exception ignored) { }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.reject("Could not encrypt item", e);
        }
    }

    @PluginMethod
    public void deleteItem(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("Missing item id");
            return;
        }
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(ITEM_PREFIX + id).apply();
        try { synchronized (mirrorLock) { File records = mirrorDirectory(); recordFile(records, id).delete(); writeMirror(deletionFile(records, id), Long.toString(System.currentTimeMillis())); } } catch (Exception ignored) { }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void getMeta(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String packed = prefs.getString(META_VALUE, null);
            if (packed == null) try { packed = readMirror(new File(mirrorDirectory().getParentFile(), "meta.enc")); } catch (Exception ignored) { }
            JSObject result = new JSObject();
            result.put("exists", packed != null && !packed.isEmpty());
            if (packed != null && !packed.isEmpty()) result.put("data", decrypt(packed));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read encrypted metadata", e);
        }
    }

    @PluginMethod
    public void setMeta(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Missing metadata");
            return;
        }
        try {
            new JSONObject(data);
            String packed = encrypt(data);
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(META_VALUE, packed).apply();
            try { synchronized (mirrorLock) { writeMirror(new File(mirrorDirectory().getParentFile(), "meta.enc"), packed); } } catch (Exception ignored) { }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.reject("Could not encrypt metadata", e);
        }
    }

    /** Removes only the pre-item-level snapshot after a verified migration. */
    @PluginMethod
    public void clearLegacyState(PluginCall call) {
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().remove(VALUE).apply();
            File external = getContext().getExternalFilesDir(null);
            if (external != null) new File(external, "CueMark/ScreenMark/state.enc").delete();
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void importPackedState(PluginCall call) {
        String packed = call.getString("packed");
        if (packed == null || packed.isEmpty()) {
            call.reject("Missing encrypted state");
            return;
        }
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONObject backup = new JSONObject(packed);
            JSONObject restoredState = null;
            if ("screenmark-encrypted-store-v2".equals(backup.optString("format"))) {
                JSONObject records = backup.getJSONObject("records");
                JSONArray items = new JSONArray();
                JSONObject meta = new JSONObject();
                JSONObject verifiedRecords = new JSONObject();
                boolean metaFound = false;
                for (java.util.Iterator<String> it = records.keys(); it.hasNext();) {
                    String key = it.next();
                    if (!(key.equals(VALUE) || key.equals(META_VALUE) || key.startsWith(ITEM_PREFIX) || key.equals(LEGACY_WRAPPED_KEY))) continue;
                    String value = records.getString(key);
                    if (key.equals(LEGACY_WRAPPED_KEY)) verifiedRecords.put(key, value);
                    else {
                        String clear = decrypt(value);
                        verifiedRecords.put(key, value);
                        if (key.startsWith(ITEM_PREFIX)) items.put(new JSONObject(clear));
                        else if (key.equals(META_VALUE)) { meta = new JSONObject(clear); metaFound = true; }
                        else if (key.equals(VALUE)) restoredState = new JSONObject(clear);
                    }
                }
                if (items.length() > 0 || metaFound) {
                    restoredState = new JSONObject();
                    restoredState.put("items", items);
                    restoredState.put("history", meta.optJSONArray("history") != null ? meta.optJSONArray("history") : new JSONArray());
                    restoredState.put("preferences", meta.optJSONObject("preferences") != null ? meta.optJSONObject("preferences") : new JSONObject());
                }
                if (restoredState == null) throw new IllegalArgumentException("Backup contains no restorable library records");
                // Replace the encrypted snapshot as a whole. Keeping keys that are
                // absent from the backup would resurrect titles deleted earlier.
                SharedPreferences.Editor editor = prefs.edit().clear();
                for (java.util.Iterator<String> it = verifiedRecords.keys(); it.hasNext();) {
                    String key = it.next();
                    editor.putString(key, verifiedRecords.getString(key));
                }
                if (!editor.commit()) throw new IllegalStateException("Could not write encrypted backup records");
                deleteMirror();
                File mirror = mirrorDirectory(), parent = mirror.getParentFile();
                for (java.util.Iterator<String> it = verifiedRecords.keys(); it.hasNext();) {
                    String key = it.next(), value = verifiedRecords.getString(key);
                    if (key.startsWith(ITEM_PREFIX)) {
                        String id = new JSONObject(decrypt(value)).optString("id", "");
                        if (!id.isEmpty()) writeMirror(new File(mirror, safeRecordName(id)), value);
                    } else if (key.equals(META_VALUE)) writeMirror(new File(parent, "meta.enc"), value);
                    else if (key.equals(VALUE)) writeMirror(new File(parent, "state.enc"), value);
                }
            } else {
                // Backward compatibility with the original single-blob .sqdb format.
                restoredState = new JSONObject(decrypt(packed));
                if (!prefs.edit().putString(VALUE, packed).commit()) throw new IllegalStateException("Could not write encrypted backup state");
                writeMirror(new File(mirrorDirectory().getParentFile(), "state.enc"), packed);
            }
            if (restoredState == null) throw new IllegalArgumentException("Backup contains no restorable library records");
            call.resolve(new JSObject().put("success", true).put("data", restoredState));
        } catch (Exception e) {
            call.reject("Could not restore encrypted local database", e);
        }
    }

    @PluginMethod
    public void clearState(PluginCall call) {
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        deleteMirror();
        call.resolve(new JSObject().put("success", true));
    }

    private SecretKey getKey() throws Exception {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return getLegacyWrappedKey();
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
             .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
             .build());
            generator.generateKey();
        }
        return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
    }

    // API 22 does not provide AndroidKeyStore AES key generation. Keep the AES
    // key encrypted by an RSA key whose private key remains in Android Keystore.
    private SecretKey getLegacyWrappedKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (!keyStore.containsAlias(LEGACY_RSA_ALIAS)) {
            Calendar start = Calendar.getInstance();
            Calendar end = Calendar.getInstance();
            end.add(Calendar.YEAR, 30);
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA", "AndroidKeyStore");
            generator.initialize(new KeyPairGeneratorSpec.Builder(getContext())
                .setAlias(LEGACY_RSA_ALIAS)
                .setSubject(new X500Principal("CN=ScreenMark Local State"))
                .setSerialNumber(BigInteger.ONE)
                .setStartDate(start.getTime())
                .setEndDate(end.getTime())
                .build());
            generator.generateKeyPair();
        }

        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String wrapped = prefs.getString(LEGACY_WRAPPED_KEY, null);
        if (wrapped == null) {
            byte[] raw = new byte[32];
            new SecureRandom().nextBytes(raw);
            Cipher wrap = Cipher.getInstance("RSA/ECB/PKCS1Padding");
            wrap.init(Cipher.ENCRYPT_MODE, keyStore.getCertificate(LEGACY_RSA_ALIAS).getPublicKey());
            wrapped = Base64.encodeToString(wrap.doFinal(raw), Base64.NO_WRAP);
            prefs.edit().putString(LEGACY_WRAPPED_KEY, wrapped).apply();
            return new SecretKeySpec(raw, "AES");
        }

        Cipher unwrap = Cipher.getInstance("RSA/ECB/PKCS1Padding");
        unwrap.init(Cipher.DECRYPT_MODE, ((KeyStore.PrivateKeyEntry) keyStore.getEntry(LEGACY_RSA_ALIAS, null)).getPrivateKey());
        return new SecretKeySpec(unwrap.doFinal(Base64.decode(wrapped, Base64.DEFAULT)), "AES");
    }

    private String encrypt(String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getKey());
        String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
        String body = Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        return iv + "." + body;
    }

    private String decrypt(String packed) throws Exception {
        String[] parts = packed.split("\\.", 2);
        if (parts.length != 2) throw new IllegalArgumentException("Invalid encrypted state");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.DEFAULT)));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.DEFAULT)), StandardCharsets.UTF_8);
    }
}
