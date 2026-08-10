import type { Request, RequestHandler } from 'express';
import { ApiError } from '../lib/errors.js';

interface Bucket {
  hits: number[];
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Defaults to user id when signed in, otherwise the client IP. */
  keyOf?: (req: Request) => string;
  message?: string;
}

/**
 * In-memory sliding-window limiter. Sufficient for a single-node deployment;
 * swap for a shared store when the API is scaled horizontally.
 */
export function rateLimit(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  const keyOf = options.keyOf ?? ((req: Request) => req.user?.id ?? req.ip ?? 'unknown');

  return (req, res, next) => {
    const now = Date.now();
    if (now - lastSweep > options.windowMs) {
      for (const [key, bucket] of buckets) {
        bucket.hits = bucket.hits.filter((t) => now - t < options.windowMs);
        if (bucket.hits.length === 0) buckets.delete(key);
      }
      lastSweep = now;
    }

    const key = `${req.method}:${keyOf(req)}`;
    const bucket = buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((t) => now - t < options.windowMs);

    if (bucket.hits.length >= options.max) {
      const retryAfter = Math.ceil((options.windowMs - (now - bucket.hits[0])) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));
      buckets.set(key, bucket);
      next(
        new ApiError(429, 'RATE_LIMITED', options.message ?? 'Too many requests. Please slow down and try again shortly.', {
          retryable: true,
        }),
      );
      return;
    }

    bucket.hits.push(now);
    buckets.set(key, bucket);
    next();
  };
}
