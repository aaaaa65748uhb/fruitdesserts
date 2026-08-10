/**
 * Runtime differences between the browser build and the Android (Capacitor)
 * build — kept in one place so the rest of the app never branches on platform.
 *
 * Browser: same-origin `/api`, session lives in an HttpOnly cookie.
 * Android: the APK has no origin to share cookies with, so it talks to the
 *          backend named by VITE_API_BASE_URL and carries a bearer token in
 *          Capacitor Preferences. The APK never holds an AI key or any
 *          database credential.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

const configuredBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

/**
 * Base URL for API calls. Empty string means "same origin" (browser build).
 * A native build without VITE_API_BASE_URL cannot reach a backend at all, so
 * it fails loudly here instead of silently calling https://localhost/api.
 */
export function apiBaseUrl(): string {
  if (!isNative) return configuredBase;
  if (!configuredBase) {
    throw new Error(
      'VITE_API_BASE_URL was not set when this app was built. The Android build needs the address of your RecipeLens backend.',
    );
  }
  return configuredBase;
}

export function nativeConfigError(): string | null {
  if (!isNative || configuredBase) return null;
  return 'This build has no backend address (VITE_API_BASE_URL). Rebuild the APK with VITE_API_BASE_URL set to your RecipeLens server.';
}

const TOKEN_KEY = 'recipelens.session';

/** Session token store. Preferences on device, localStorage in the browser. */
export const tokenStore = {
  async get(): Promise<string | null> {
    if (!isNative) return null; // the browser uses the HttpOnly cookie
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value ?? null;
  },
  async set(token: string | null): Promise<void> {
    if (!isNative) return;
    if (token) await Preferences.set({ key: TOKEN_KEY, value: token });
    else await Preferences.remove({ key: TOKEN_KEY });
  },
};

/* -------------------------------------------------------------------------- */
/* Android share target                                                       */
/* -------------------------------------------------------------------------- */

export interface SharedItem {
  type: 'url' | 'text';
  value: string;
  title?: string;
}

interface SharedIntentPlugin {
  getSharedItem(): Promise<{ hasItem: boolean; type?: string; value?: string; title?: string }>;
  clearSharedItem(): Promise<void>;
  addListener(
    event: 'sharedItemReceived',
    handler: (payload: { type: string; value: string; title?: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const SharedIntent = registerPlugin<SharedIntentPlugin>('SharedIntent');

function toSharedItem(payload: { type?: string; value?: string; title?: string }): SharedItem | null {
  const value = payload.value?.trim();
  if (!value) return null;
  return { type: payload.type === 'url' ? 'url' : 'text', value, title: payload.title || undefined };
}

/** Anything shared into RecipeLens before the web layer was ready. */
export async function consumePendingShare(): Promise<SharedItem | null> {
  if (!isNative) return null;
  try {
    const result = await SharedIntent.getSharedItem();
    if (!result.hasItem) return null;
    await SharedIntent.clearSharedItem();
    return toSharedItem(result);
  } catch {
    return null;
  }
}

/** Shares that arrive while the app is already open. */
export async function onShare(handler: (item: SharedItem) => void): Promise<() => void> {
  if (!isNative) return () => undefined;
  try {
    const subscription = await SharedIntent.addListener('sharedItemReceived', (payload) => {
      const item = toSharedItem(payload);
      if (item) {
        handler(item);
        void SharedIntent.clearSharedItem();
      }
    });
    return () => void subscription.remove();
  } catch {
    return () => undefined;
  }
}
