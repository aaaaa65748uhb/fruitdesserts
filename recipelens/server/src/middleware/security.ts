import type { RequestHandler } from 'express';
import { ApiError } from '../lib/errors.js';
import { getContext } from './context.js';

/** Conservative security headers (no external dependency needed). */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // The API only ever returns JSON, so nothing may be rendered or loaded.
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.removeHeader('X-Powered-By');
  next();
};

/** CORS limited to the configured web origins, with credentials enabled. */
export const cors: RequestHandler = (req, res, next) => {
  const ctx = getContext(req);
  const origin = req.get('origin');
  if (origin && ctx.config.webOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
};

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence: cookies are SameSite=Lax, and any state-changing request that
 * *does* carry a cross-site Origin header is rejected outright.
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const ctx = getContext(req);
  const origin = req.get('origin');
  if (origin && !ctx.config.webOrigins.includes(origin) && !isSameOrigin(req, origin)) {
    next(new ApiError(403, 'FORBIDDEN', 'Cross-site request blocked.'));
    return;
  }
  next();
};

/**
 * A request from the page this very server served is same-origin and therefore
 * not a cross-site request, whatever WEB_ORIGIN happens to say. Without this,
 * deploying behind any hostname other than the configured one would reject
 * every write from the app's own UI.
 */
function isSameOrigin(req: Parameters<RequestHandler>[0], origin: string): boolean {
  const host = req.get('host');
  if (!host) return false;
  // `req.protocol` already honours x-forwarded-proto when trust proxy is on.
  const forwarded = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const schemes = new Set([req.protocol, forwarded].filter(Boolean) as string[]);
  for (const scheme of schemes) {
    if (origin === `${scheme}://${host}`) return true;
  }
  return false;
}
