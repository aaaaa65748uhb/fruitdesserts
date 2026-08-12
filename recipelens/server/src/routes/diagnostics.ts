/**
 * Live check of the configured AI provider.
 *
 * This performs a *real* round trip to whatever AI_PROVIDER points at, using
 * the key from the server environment, and reports whether it answered with
 * usable JSON. It exists because the only machine that can honestly verify the
 * credentials is the one that holds them.
 *
 * It never returns the key. Provider text is echoed only through the redaction
 * in failureLog.ts, and only to a signed-in caller, because without it a failed
 * deployment gives no clue as to what the provider actually objected to.
 *
 *   GET /api/diagnostics/ai           — one tiny completion (is the key live?)
 *   GET /api/diagnostics/ai?deep=1    — a real recipe extraction from fixed
 *                                       text (does the whole pipeline work?)
 */
import { Router } from 'express';
import { z } from 'zod';
import { recentProviderFailures } from '../ai/failureLog.js';
import { ApiError } from '../lib/errors.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { asyncHandler, getContext } from '../middleware/context.js';
import { rateLimit } from '../middleware/rateLimit.js';

/** Complete enough that a working model has no excuse to fail on it. */
const DEEP_CHECK_SOURCE = `Garlic butter, two ways.
Serves 2.
You need 100 g of unsalted butter, softened, and 2 cloves of garlic, finely grated.
Mash the butter and the garlic together with a fork until evenly combined.
Chill for 30 minutes before serving.`;

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

      const deep = req.query.deep === '1' || req.query.deep === 'true';
      const started = Date.now();

      const describe = (extra: Record<string, unknown>) => ({
        provider: ctx.ai!.providerName,
        configuredModel: ctx.ai!.model,
        endpoint: ctx.ai!.endpoint,
        checkedAt: new Date().toISOString(),
        // Redacted provider text — the only honest way to say what went wrong.
        recentFailures: recentProviderFailures(),
        ...extra,
      });

      try {
        if (deep) {
          // The real extraction path: same prompt, same schema, same
          // normalisation as an import, on text that is known to be complete.
          const outcome = await ctx.ai.analyze({
            sourceType: 'text',
            pastedText: DEEP_CHECK_SOURCE,
            title: 'Two-ingredient check',
          });
          res.json(
            describe({
              ok: true,
              check: 'deep',
              model: outcome.model,
              attempts: outcome.attempts,
              repairedJson: outcome.repaired,
              latencyMs: Date.now() - started,
              extracted: {
                title: outcome.draft.title,
                ingredientCount: outcome.draft.ingredients.length,
                stepCount: outcome.draft.steps.length,
              },
            }),
          );
          return;
        }

        const outcome = await ctx.ai.runStructured(
          'the connection check',
          'You are a connectivity check. Reply with exactly {"ok": true} and nothing else.',
          'Reply with {"ok": true}.',
          pingSchema,
          (raw) => raw,
          { temperature: 0, maxTokens: 64 },
        );

        res.json(
          describe({
            ok: true,
            check: 'ping',
            // The model string the provider itself reported answering with.
            model: outcome.model,
            attempts: outcome.attempts,
            latencyMs: Date.now() - started,
          }),
        );
      } catch (error) {
        // The status stays honest — a broken provider is a 502, not a 200 —
        // but the diagnosis travels in `details`, so the caller can show what
        // the provider actually said instead of just "something went wrong".
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError(500, 'INTERNAL_ERROR', 'The check did not complete.', { cause: error });
        throw new ApiError(apiError.status, apiError.code, apiError.message, {
          retryable: apiError.retryable,
          details: describe({
            ok: false,
            check: deep ? 'deep' : 'ping',
            latencyMs: Date.now() - started,
            failure: { code: apiError.code, message: apiError.message, status: apiError.status },
          }),
        });
      }
    }),
  );

  return router;
}
