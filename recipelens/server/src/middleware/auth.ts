import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { unauthorized } from '../lib/errors.js';
import { createSessionToken, verifySessionToken } from '../lib/tokens.js';
import { toPublicUser } from '../db/users.js';
import { getContext } from './context.js';

export const SESSION_COOKIE = 'rl_session';

export function issueSession(res: Response, userId: string, tokenVersion: number): string {
  const ctx = getContext(res.req);
  const token = createSessionToken({ sub: userId, tv: tokenVersion }, ctx.config.sessionSecret, ctx.config.sessionTtlSeconds);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: ctx.config.isProduction,
    maxAge: ctx.config.sessionTtlSeconds * 1000,
    path: '/',
  });
  return token;
}

export function clearSession(res: Response): void {
  const ctx = getContext(res.req);
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: ctx.config.isProduction,
    path: '/',
  });
}

function readToken(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const fromCookie = cookies?.[SESSION_COOKIE];
  if (fromCookie) return fromCookie;
  const header = req.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Resolves the session. Backend authorization never trusts the client: the
 * token signature, its expiry AND the user's current token version are all
 * re-checked on every single request.
 */
function resolve(req: Request): { user: ReturnType<typeof toPublicUser> } | null {
  const ctx = getContext(req);
  const token = readToken(req);
  if (!token) return null;

  const result = verifySessionToken(token, ctx.config.sessionSecret);
  if (!result.ok) return null;

  const row = ctx.users.findById(result.claims.sub);
  if (!row) return null;
  if (row.token_version !== result.claims.tv) return null; // logged out everywhere

  return { user: toPublicUser(row) };
}

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const resolved = resolve(req);
  if (resolved) req.user = resolved.user;
  next();
};

export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const resolved = resolve(req);
  if (!resolved) {
    next(unauthorized('You need to sign in to do that.'));
    return;
  }
  req.user = resolved.user;
  next();
};

/**
 * Native clients (the Android APK) cannot share cookies with the backend
 * origin, so they ask for the session token and send it as a bearer header.
 * Browsers never get the token in the body — it stays HttpOnly.
 */
export function wantsToken(req: Request): boolean {
  return req.get('x-recipelens-client')?.toLowerCase() === 'native';
}

export function currentUser(req: Request): { id: string; email: string; displayName: string } {
  if (!req.user) throw unauthorized();
  return req.user;
}
