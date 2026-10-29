package com.cuemark.screenmark;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupFolderPlugin.class);
        registerPlugin(CacheManagerPlugin.class);
        registerPlugin(EncryptedStorePlugin.class);
        registerPlugin(BackupSchedulerPlugin.class);
        registerPlugin(ShareIntentPlugin.class);
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

}
