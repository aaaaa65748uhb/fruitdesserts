/** Small in-memory token bucket per client key. Good enough for a single instance; swap for Redis at scale. */
const buckets = new Map<string, { tokens: number; updated: number }>();

export function rateLimit(key: string, capacity = 60, refillPerSecond = 2): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, updated: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.updated) / 1000) * refillPerSecond);
  b.updated = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) buckets.clear();
  return true;
}
