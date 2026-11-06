package com.cuemark.screenmark;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScrollbarControl")
public class ScrollbarControlPlugin extends Plugin {
    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        getBridge().getWebView().post(() -> {
            getBridge().getWebView().setVerticalScrollBarEnabled(enabled);
            getBridge().getWebView().setHorizontalScrollBarEnabled(enabled);
        });
        call.resolve();
    }
}
