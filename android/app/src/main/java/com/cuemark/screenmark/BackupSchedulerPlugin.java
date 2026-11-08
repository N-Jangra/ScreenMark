package com.cuemark.screenmark;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "BackupScheduler")
public class BackupSchedulerPlugin extends Plugin {
    private static final String WORK_NAME = "screenmark-encrypted-background-backup";

    @PluginMethod
    public void schedule(PluginCall call) {
        int retention = Math.max(3, Math.min(20, call.getInt("retention", 10)));
        getContext().getSharedPreferences("screenmark_backup_location", android.content.Context.MODE_PRIVATE)
            .edit().putInt("retention", retention).apply();
        PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(
            EncryptedBackupWorker.class, 24, TimeUnit.HOURS
        ).build();
        WorkManager.getInstance(getContext()).enqueueUniquePeriodicWork(
            WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, work
        );
        call.resolve(new JSObject().put("scheduled", true));
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        WorkManager.getInstance(getContext()).cancelUniqueWork(WORK_NAME);
        call.resolve(new JSObject().put("scheduled", false));
    }
}
