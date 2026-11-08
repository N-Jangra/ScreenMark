package com.cuemark.screenmark;

import android.os.Bundle;
import android.view.View;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupFolderPlugin.class);
        registerPlugin(CacheManagerPlugin.class);
        registerPlugin(EncryptedStorePlugin.class);
        registerPlugin(BackupSchedulerPlugin.class);
        registerPlugin(ProviderSessionPlugin.class);
        registerPlugin(ScrollbarControlPlugin.class);
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            // Keep Android's edge-stretch overscroll from moving fixed WebView UI
            // such as the bottom navigation during the app's custom pull-to-refresh.
            getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        }
    }

}
