package com.cuemark.screenmark;

import android.app.Dialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.atomic.AtomicBoolean;

/** Opens provider sites for user-driven browsing and exposes that WebView's session to requests. */
@CapacitorPlugin(name = "ProviderSession")
public class ProviderSessionPlugin extends Plugin {
    private String providerUrl(String provider) {
        if ("imdb".equals(provider)) return "https://www.imdb.com/";
        if ("rottentomatoes".equals(provider)) return "https://www.rottentomatoes.com/";
        return null;
    }

    @PluginMethod
    public void reviewProvider(PluginCall call) {
        String provider = call.getString("provider", "");
        String url = providerUrl(provider);
        if (url == null) { call.reject("Unsupported metadata provider."); return; }
        if (getActivity() == null) { call.reject("ScreenMark is not available to open the provider."); return; }
        getActivity().runOnUiThread(() -> showProvider(call, provider, url));
    }

    @PluginMethod
    public void getSession(PluginCall call) {
        String provider = call.getString("provider", "");
        String url = providerUrl(provider);
        if (url == null) { call.reject("Unsupported metadata provider."); return; }
        JSObject result = new JSObject();
        try {
            String cookies = CookieManager.getInstance().getCookie(url);
            result.put("cookie", cookies == null ? "" : cookies);
            result.put("userAgent", WebSettings.getDefaultUserAgent(getContext()));
        } catch (Exception error) {
            result.put("cookie", ""); result.put("userAgent", "");
        }
        call.resolve(result);
    }

    private void showProvider(PluginCall call, String provider, String url) {
        Dialog dialog = new Dialog(getActivity());
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setCancelable(true);
        dialog.setCanceledOnTouchOutside(false);

        LinearLayout root = new LinearLayout(getActivity());
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        LinearLayout header = new LinearLayout(getActivity());
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(16), 0, dp(8), 0);
        header.setBackgroundColor(Color.WHITE);
        TextView title = new TextView(getActivity());
        title.setText("Continue on " + ("imdb".equals(provider) ? "IMDb" : "Rotten Tomatoes"));
        title.setTextColor(Color.rgb(20, 24, 33)); title.setTextSize(18); title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        header.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1));
        Button close = new Button(getActivity()); close.setText("Done"); close.setAllCaps(false);
        header.addView(close, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(48)));

        WebView webView = new WebView(getActivity());
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager cookieManager = CookieManager.getInstance(); cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) cookieManager.setAcceptThirdPartyCookies(webView, false);
        webView.setWebChromeClient(new WebChromeClient()); webView.setWebViewClient(new WebViewClient());
        root.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)));
        root.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        dialog.setContentView(root);
        Window window = dialog.getWindow();
        if (window != null) { window.setBackgroundDrawableResource(android.R.color.white); window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT); }

        AtomicBoolean completed = new AtomicBoolean(false);
        Runnable finish = () -> {
            if (!completed.compareAndSet(false, true)) return;
            try { cookieManager.flush(); } catch (Exception ignored) {}
            try { webView.stopLoading(); webView.destroy(); } catch (Exception ignored) {}
            call.resolve();
        };
        close.setOnClickListener(view -> dialog.dismiss());
        dialog.setOnDismissListener(ignored -> finish.run());
        try {
            dialog.show();
            if (window != null) window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            webView.loadUrl(url);
        } catch (Exception error) {
            finish.run(); call.reject("Could not open the provider page.", error);
        }
    }

    private int dp(int value) { return Math.round(value * getActivity().getResources().getDisplayMetrics().density); }
}
