package com.recipelens.app;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import com.getcapacitor.BridgeActivity;

/**
 * Entry point. Registers the SharedIntent plugin and forwards anything the
 * user shares into RecipeLens (TikTok, Instagram, YouTube, Chrome…).
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SharedIntentPlugin.class);
        super.onCreate(savedInstanceState);
        handleShare(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        if (Intent.ACTION_SEND.equals(action)) {
            String type = intent.getType();
            if (type != null && type.startsWith("text/")) {
                String text = intent.getStringExtra(Intent.EXTRA_TEXT);
                String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
                String url = firstUrl(text);
                SharedIntentPlugin.deliver(url != null ? "url" : "text", url != null ? url : text, subject);
            }
        } else if (Intent.ACTION_VIEW.equals(action) && intent.getData() != null) {
            SharedIntentPlugin.deliver("url", intent.getData().toString(), null);
        }
    }

    /**
     * Social apps share a sentence with the link inside it
     * ("Check out this video https://vm.tiktok.com/…"), so pull the link out.
     */
    private static String firstUrl(String text) {
        if (TextUtils.isEmpty(text)) return null;
        for (String token : text.split("\\s+")) {
            if (token.startsWith("http://") || token.startsWith("https://")) {
                return token;
            }
        }
        return null;
    }
}
