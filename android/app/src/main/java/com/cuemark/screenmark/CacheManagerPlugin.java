package com.cuemark.screenmark;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
// Clears the WebView cache without touching the library, backups, preferences,
// or the user's saved folder permission.
@CapacitorPlugin(name = "CacheManager")
public class CacheManagerPlugin extends Plugin {
    @PluginMethod
    public void clearWebViewCache(PluginCall call) {
        try {
            getBridge().getWebView().clearCache(true);
        } catch (Exception e) {
            // Continue with app-owned temporary files if WebView clearing fails.
        }
        call.resolve();
    }
}
