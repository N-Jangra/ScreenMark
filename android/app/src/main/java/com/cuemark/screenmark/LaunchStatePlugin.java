package com.cuemark.screenmark;

import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LaunchState")
public class LaunchStatePlugin extends Plugin {
    static final String PREFS_NAME = "screenmark_launch_state";
    static final String RESET_HOME_KEY = "reset_home_on_next_launch";

    @PluginMethod
    public void consumeResetHome(PluginCall call) {
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS_NAME, 0);
        boolean resetHome = preferences.getBoolean(RESET_HOME_KEY, false);
        if (resetHome) preferences.edit().remove(RESET_HOME_KEY).apply();
        JSObject result = new JSObject();
        result.put("resetHome", resetHome);
        call.resolve(result);
    }
}
