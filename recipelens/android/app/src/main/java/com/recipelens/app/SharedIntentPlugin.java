package com.recipelens.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges Android's ACTION_SEND ("Share to RecipeLens") into the web app.
 *
 * MainActivity hands every shared payload to {@link #deliver}; the web client
 * either picks it up with getSharedItem() on start-up, or receives the
 * "sharedItemReceived" event while it is already running.
 */
@CapacitorPlugin(name = "SharedIntent")
public class SharedIntentPlugin extends Plugin {

    /** Payload waiting to be collected by the web layer. */
    private static JSObject pending;
    private static SharedIntentPlugin instance;

    @Override
    public void load() {
        instance = this;
        // A share received before the web layer was ready fires as soon as it is.
        if (pending != null) {
            notifyListeners("sharedItemReceived", pending, true);
        }
    }

    /** Called from MainActivity on every ACTION_SEND / ACTION_VIEW intent. */
    static void deliver(String type, String value, String title) {
        JSObject payload = new JSObject();
        payload.put("type", type);
        payload.put("value", value == null ? "" : value);
        payload.put("title", title == null ? "" : title);
        pending = payload;
        if (instance != null) {
            instance.notifyListeners("sharedItemReceived", payload, true);
        }
    }

    @PluginMethod
    public void getSharedItem(PluginCall call) {
        JSObject result = new JSObject();
        if (pending == null) {
            result.put("hasItem", false);
        } else {
            result.put("hasItem", true);
            result.put("type", pending.getString("type", ""));
            result.put("value", pending.getString("value", ""));
            result.put("title", pending.getString("title", ""));
        }
        call.resolve(result);
    }

    /** The web layer calls this once it has consumed the payload. */
    @PluginMethod
    public void clearSharedItem(PluginCall call) {
        pending = null;
        call.resolve();
    }
}
