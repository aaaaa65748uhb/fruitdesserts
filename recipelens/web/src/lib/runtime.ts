/**
 * Runtime differences between the browser build and the Android (Capacitor)
 * build — kept in one place so the rest of the app never branches on platform.
 *
 * Browser: same-origin `/api`, session lives in an HttpOnly cookie.
 * Android: the APK has no origin to share cookies with, so it talks to a
 *          backend address and carries a bearer token in Capacitor Preferences.
 *          The address is entered once on the device (or baked in at build time
 *          with VITE_API_BASE_URL), which means one APK works with any server.
 *          The APK never holds an AI key or any database credential.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

const buildTimeBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
const BASE_URL_KEY = 'recipelens.apiBaseUrl';

/** Resolved once at start-up; '' means "same origin" (browser build). */
let resolvedBase: string | null = null;

/**
 * Tidy up whatever the user typed: add https:// when the scheme is missing,
 * drop a trailing slash and a pasted /api suffix.
 */
export function normalizeBaseUrl(input: string): string | null {
  let text = input.trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
  const path = url.pathname.replace(/\/+$/, '').replace(/\/api$/i, '');
  return `${url.origin}${path}`;
}

/** Reads the stored address. Call once before the app makes any request. */
export async function initApiBaseUrl(): Promise<string | null> {
  if (!isNative) {
    resolvedBase = buildTimeBase;
    return resolvedBase;
  }
  try {
    const { value } = await Preferences.get({ key: BASE_URL_KEY });
    resolvedBase = value?.trim() || buildTimeBase || null;
  } catch {
    resolvedBase = buildTimeBase || null;
  }
  return resolvedBase;
}

let readyPromise: Promise<string | null> | null = null;

/**
 * Resolves once the stored address has been read. Everything that makes a
 * request awaits this, so a returning user's session is not thrown away just
 * because the API client ran a moment before Preferences answered.
 */
export function ensureRuntimeReady(): Promise<string | null> {
  readyPromise ??= initApiBaseUrl();
  return readyPromise;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const normalized = normalizeBaseUrl(url);
  if (!normalized) throw new Error('That does not look like a server address.');
  resolvedBase = normalized;
  if (isNative) await Preferences.set({ key: BASE_URL_KEY, value: normalized });
}

export async function clearApiBaseUrl(): Promise<void> {
  resolvedBase = buildTimeBase || null;
  if (isNative) await Preferences.remove({ key: BASE_URL_KEY });
}

export function currentApiBaseUrl(): string | null {
  return resolvedBase;
}

/** True when the app still needs to be told where its backend lives. */
export function needsServerSetup(): boolean {
  return isNative && !resolvedBase;
}

/**
 * Base URL for API calls. Empty string means "same origin" (browser build).
 * Throws rather than silently calling https://localhost from the APK.
 */
export function apiBaseUrl(): string {
  if (!isNative) return resolvedBase ?? buildTimeBase;
  if (!resolvedBase) {
    throw new Error('RecipeLens does not know where your server is yet. Add the address in Settings.');
  }
  return resolvedBase;
}

/**
 * Confirms an address really is a RecipeLens backend before we store it.
 * Uses the health endpoint, which needs no session.
 */
export interface ServerCheck {
  ok: boolean;
  baseUrl: string;
  aiConfigured?: boolean;
  aiProvider?: string | null;
  aiModel?: string | null;
  message?: string;
}

export async function checkServer(input: string, timeoutMs = 20000): Promise<ServerCheck> {
  const baseUrl = normalizeBaseUrl(input);
  if (!baseUrl) return { ok: false, baseUrl: input, message: 'That does not look like a web address.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) {
      return { ok: false, baseUrl, message: `The server answered with an error (HTTP ${response.status}).` };
    }
    const payload = (await response.json()) as {
      status?: string;
      ai?: { configured?: boolean; provider?: string | null; model?: string | null };
    };
    if (!payload?.status) {
      return { ok: false, baseUrl, message: 'That address answered, but it is not a RecipeLens server.' };
    }
    return {
      ok: true,
      baseUrl,
      aiConfigured: payload.ai?.configured ?? false,
      aiProvider: payload.ai?.provider ?? null,
      aiModel: payload.ai?.model ?? null,
    };
  } catch {
    return {
      ok: false,
      baseUrl,
      message: 'Could not reach that address. Check the link, and that the server is awake.',
    };
  } finally {
    clearTimeout(timer);
  }
}

const TOKEN_KEY = 'recipelens.session';

/** Session token store. Preferences on device, cookie in the browser. */
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
