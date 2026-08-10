import type { Request, RequestHandler } from 'express';
import type { AppContext } from '../context.js';
import type { PublicUser } from '../db/users.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Populated by `requireAuth` / `optionalAuth`. */
    user?: PublicUser;
    requestId?: string;
  }
}

export function getContext(req: Request): AppContext {
  const ctx = req.app.locals.ctx as AppContext | undefined;
  if (!ctx) throw new Error('Application context is not configured.');
  return ctx;
}

/** Wraps an async handler so rejections reach the error middleware. */
export function asyncHandler(handler: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}
