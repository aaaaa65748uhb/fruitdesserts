/**
 * Android shell behaviour: hardware back button, status bar, splash screen and
 * connectivity. All of it degrades to no-ops in the browser build.
 */
import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';
import { isNative } from './runtime.js';

/** Chrome that must be set up once, as early as possible. */
export async function initNativeShell(): Promise<void> {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#ffffff' });
  } catch {
    /* StatusBar is unavailable on some devices; not worth failing start-up. */
  }
  try {
    // Keep the focused input visible when the soft keyboard opens.
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
  } catch {
    /* optional */
  }
  try {
    await SplashScreen.hide();
  } catch {
    /* optional */
  }
}

/**
 * Android back button: step back through app history, and exit only from the
 * home screen — never strand the user on a blank WebView.
 */
export function useAndroidBackButton(canGoBack: () => boolean, goBack: () => void): void {
  useEffect(() => {
    if (!isNative) return undefined;
    let remove: (() => void) | undefined;

    void CapacitorApp.addListener('backButton', () => {
      if (canGoBack()) goBack();
      else void CapacitorApp.exitApp();
    }).then((handle) => {
      remove = () => void handle.remove();
    });

    return () => remove?.();
  }, [canGoBack, goBack]);
}

/** Online/offline, used to show an honest banner instead of silent failures. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    let remove: (() => void) | undefined;
    if (isNative) {
      // The WebView's navigator.onLine is unreliable on Android; ask the OS.
      void (async () => {
        try {
          const status = await Network.getStatus();
          setOnline(status.connected);
          const handle = await Network.addListener('networkStatusChange', (s) => setOnline(s.connected));
          remove = () => void handle.remove();
        } catch {
          /* Fall back to navigator.onLine. */
        }
      })();
    }

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      remove?.();
    };
  }, []);

  return online;
}
