/**
 * Live check of the configured AI provider.
 *
 * This performs a *real* round trip to whatever AI_PROVIDER points at, using
 * the key from the server environment, and reports whether it answered with
 * usable JSON. It exists because the only machine that can honestly verify the
 * credentials is the one that holds them.
 *
 * It never returns the key, and it never echoes raw provider text — only the
 * provider name, the model that answered, the endpoint host and a timing.
 */
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { asyncHandler, getContext } from '../middleware/context.js';
import { rateLimit } from '../middleware/rateLimit.js';

const pingSchema = z.object({
  ok: z.union([z.boolean(), z.string(), z.number()]).optional(),
  status: z.union([z.string(), z.number()]).optional(),
});

export function diagnosticsRoutes(): Router {
  const router = Router();
  router.use(requireAuth);

  // A real completion costs money, so this is deliberately hard to abuse.
  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many provider checks in one hour. Please wait before trying again.',
  });

  router.get(
    '/ai',
    limiter,
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      void currentUser(req);

      if (!ctx.ai) {
        throw new ApiError(503, 'AI_NOT_CONFIGURED', 'No AI provider is configured on this server.', {
          details: { reason: ctx.aiDisabledReason },
          recovery: ['Set AI_API_KEY in the server environment and redeploy'],
          retryable: false,
        });
      }

      const started = Date.now();
      const outcome = await ctx.ai.runStructured(
        'the connection check',
        'You are a connectivity check. Reply with exactly {"ok": true} and nothing else.',
        'Reply with {"ok": true}.',
        pingSchema,
        (raw) => raw,
        { temperature: 0, maxTokens: 64 },
      );

      res.json({
        ok: true,
        provider: ctx.ai.providerName,
        // The model string the provider itself reported answering with.
        model: outcome.model,
        configuredModel: ctx.ai.model,
        endpoint: ctx.ai.endpoint,
        attempts: outcome.attempts,
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      });
    }),
  );

  return router;
}
