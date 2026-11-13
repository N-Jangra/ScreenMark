package com.cuemark.screenmark;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import androidx.lifecycle.Lifecycle;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "ScreenMark";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean rendererGone = false;
    private boolean recoveryScheduled = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupFolderPlugin.class);
        registerPlugin(CacheManagerPlugin.class);
        registerPlugin(EncryptedStorePlugin.class);
        registerPlugin(BackupSchedulerPlugin.class);
        registerPlugin(ProviderSessionPlugin.class);
        registerPlugin(ScrollbarControlPlugin.class);
        registerPlugin(WidgetPlugin.class);
        registerPlugin(LaunchStatePlugin.class);
        super.onCreate(savedInstanceState);
        // Android may kill the process when its task is dismissed from
        // Recents without calling onDestroy(). A task restored after ordinary
        // background process death receives savedInstanceState; a newly
        // created task does not. Let the web app reset its route only in the
        // latter case.
        getSharedPreferences(LaunchStatePlugin.PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putBoolean(LaunchStatePlugin.RESET_HOME_KEY, savedInstanceState == null)
                .apply();
        if (getBridge() != null && getBridge().getWebView() != null) {
            // Keep Android's edge-stretch overscroll from moving fixed WebView UI
            // such as the bottom navigation during the app's custom pull-to-refresh.
            getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                    rendererGone = true;
                    Log.w(TAG, "WebView renderer exited (crash=" + detail.didCrash() + ", url=" + webView.getUrl() + "); scheduling activity recovery");
                    recoverRendererWhenResumed();
                    return true;
                }
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (rendererGone) recoverRendererWhenResumed();
    }

    private void recoverRendererWhenResumed() {
        if (!rendererGone || recoveryScheduled || isFinishing()) return;
        if (!getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)) return;
        recoveryScheduled = true;
        mainHandler.postDelayed(() -> {
            recoveryScheduled = false;
            if (!rendererGone || isFinishing() || isChangingConfigurations()) return;
            if (!getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)) return;
            rendererGone = false;
            Log.w(TAG, "Recreating activity after WebView renderer exit");
            recreate();
        }, 300);
    }

}
