import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { toPublicUser } from '../db/users.js';
import { clearSession, currentUser, issueSession, requireAuth } from '../middleware/auth.js';
import { asyncHandler, getContext } from '../middleware/context.js';
import { rateLimit } from '../middleware/rateLimit.js';

const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email('Enter a valid email address.');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(200, 'Password must be at most 200 characters.');

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'Tell us what to call you.').max(80).optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(200),
});

export function authRoutes(): Router {
  const router = Router();

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyOf: (req) => req.ip ?? 'unknown',
    message: 'Too many attempts. Please wait a few minutes and try again.',
  });

  router.post(
    '/register',
    authLimiter,
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const input = registerSchema.parse(req.body);

      if (ctx.users.findByEmail(input.email)) {
        throw new ApiError(409, 'CONFLICT', 'An account with that email already exists.', {
          recovery: ['Sign in instead'],
        });
      }

      const passwordHash = await hashPassword(input.password);
      const user = ctx.users.create({
        email: input.email,
        displayName: input.displayName ?? input.email.split('@')[0],
        passwordHash,
      });

      issueSession(res, user.id, user.token_version);
      res.status(201).json({ user: toPublicUser(user) });
    }),
  );

  router.post(
    '/login',
    authLimiter,
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const input = loginSchema.parse(req.body);

      const user = ctx.users.findByEmail(input.email);
      // Always run a hash comparison so timing does not reveal existence.
      const stored = user?.password_hash ?? 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA';
      const valid = await verifyPassword(input.password, stored);

      if (!user || !valid) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password.');
      }

      issueSession(res, user.id, user.token_version);
      res.json({ user: toPublicUser(user) });
    }),
  );

  router.post('/logout', (req, res) => {
    void req;
    clearSession(res);
    res.json({ ok: true });
  });

  router.post(
    '/logout-all',
    requireAuth,
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      ctx.users.bumpTokenVersion(currentUser(req).id);
      clearSession(res);
      res.json({ ok: true });
    }),
  );

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: currentUser(req) });
  });

  router.patch(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const input = z.object({ displayName: z.string().trim().min(1).max(80) }).parse(req.body);
      const updated = ctx.users.updateProfile(currentUser(req).id, input.displayName);
      if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Account not found.');
      res.json({ user: toPublicUser(updated) });
    }),
  );

  return router;
}
