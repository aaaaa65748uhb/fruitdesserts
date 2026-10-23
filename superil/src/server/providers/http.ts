import { ProviderError } from "./types";

/**
 * Fetch helper for external providers: allow-listed hosts only (no arbitrary URL fetching),
 * HTTPS only, hard timeout, size cap and small TTL cache.
 */
const cache = new Map<string, { expires: number; value: unknown }>();
const MAX_BYTES = 5 * 1024 * 1024;

export async function fetchJsonFromAllowedHost<T>(
  providerId: string,
  url: string,
  allowedHosts: string[],
  init: RequestInit & { timeoutMs?: number; ttlMs?: number } = {},
): Promise<T> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ProviderError(providerId, "Invalid URL");
  }
  if (parsed.protocol !== "https:" || !allowedHosts.includes(parsed.hostname)) {
    throw new ProviderError(providerId, `Host not allowed: ${parsed.hostname}`);
  }
  const key = `${init.method ?? "GET"} ${parsed.toString()}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 8000);
  try {
    const res = await fetch(parsed, { ...init, signal: controller.signal, redirect: "error", cache: "no-store" });
    if (!res.ok) throw new ProviderError(providerId, `HTTP ${res.status}`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) throw new ProviderError(providerId, "Response too large");
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new ProviderError(providerId, "Response too large");
    const value = JSON.parse(text) as T;
    cache.set(key, { expires: Date.now() + (init.ttlMs ?? 5 * 60_000), value });
    return value;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(providerId, controller.signal.aborted ? "Request timed out" : "Request failed", e);
  } finally {
    clearTimeout(timer);
  }
}
