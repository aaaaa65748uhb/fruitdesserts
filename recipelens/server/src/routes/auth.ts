import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { toPublicUser } from '../db/users.js';
import { clearSession, currentUser, issueSession, requireAuth, wantsToken } from '../middleware/auth.js';
import { asyncHandler, getContext } from '../middleware/context.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { verifyGoogleIdToken } from '../lib/googleIdToken.js';
import { normalizeEmail } from '../shared.js';

// Normalised first: a phone keyboard can wrap the address in invisible
// directional marks, which would otherwise be rejected as malformed.
const emailSchema = z.preprocess(
  (value) => (typeof value === 'string' ? normalizeEmail(value) : value),
  z.string().trim().min(3).max(254).email('Enter a valid email address.'),
);

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

      const token = issueSession(res, user.id, user.token_version);
      res.status(201).json({ user: toPublicUser(user), ...(wantsToken(req) ? { token } : {}) });
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

      const token = issueSession(res, user.id, user.token_version);
      res.json({ user: toPublicUser(user), ...(wantsToken(req) ? { token } : {}) });
    }),
  );

  /**
   * Google Sign-In. The client (Android or web) obtains an ID token from
   * Google and posts it here; the server verifies it against Google's keys
   * before creating or linking an account. No client secret is involved.
   */
  router.post(
    '/google',
    authLimiter,
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      if (!ctx.config.google.configured || !ctx.config.google.clientId) {
        throw new ApiError(503, 'GOOGLE_NOT_CONFIGURED', 'Google sign-in is not available on this server.', {
          details: { reason: ctx.config.google.disabledReason },
          recovery: ['Sign in with an email address and password'],
          retryable: false,
        });
      }

      const { idToken } = z.object({ idToken: z.string().min(20).max(8192) }).parse(req.body);
      const identity = await verifyGoogleIdToken(idToken, {
        clientId: ctx.config.google.clientId,
        jwksUrl: ctx.config.google.jwksUrl,
        fetchImpl: ctx.fetchImpl,
      });

      let user = ctx.users.findByGoogleSub(identity.sub);
      if (!user) {
        const byEmail = ctx.users.findByEmail(identity.email);
        if (byEmail) {
          // Same person, already registered with a password — link the accounts.
          user = ctx.users.linkGoogle(byEmail.id, identity.sub) ?? byEmail;
        } else {
          // Federated accounts get an unusable password hash: there is no
          // password to guess, and password login for them always fails.
          user = ctx.users.create({
            email: identity.email,
            displayName: identity.name ?? identity.email.split('@')[0],
            passwordHash: `google$${randomBytes(32).toString('base64')}`,
            authProvider: 'google',
            googleSub: identity.sub,
          });
        }
      }

      const token = issueSession(res, user.id, user.token_version);
      res.json({ user: toPublicUser(user), ...(wantsToken(req) ? { token } : {}) });
    }),
  );

  /** The OAuth *client id* is public by design; the client needs it to start the flow. */
  router.get('/google/config', (req, res) => {
    const ctx = getContext(req);
    res.json({ configured: ctx.config.google.configured, clientId: ctx.config.google.clientId });
  });

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
