package com.cuemark.screenmark;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

// Clears temporary response/share files without touching the library, backups,
// preferences, or the user's saved folder permission.
@CapacitorPlugin(name = "CacheManager")
public class CacheManagerPlugin extends Plugin {
    @PluginMethod
    public void clearWebViewCache(PluginCall call) {
        try {
            getBridge().getWebView().clearCache(true);
        } catch (Exception e) {
            // Continue with app-owned temporary files if WebView clearing fails.
        }
        deleteTree(new File(getContext().getCacheDir(), "shared-images"));
        call.resolve();
    }

    private static void deleteTree(File file) {
        if (!file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteTree(child);
        file.delete();
    }
}
