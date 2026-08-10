/**
 * Import pipeline.
 *
 *   link / text / screenshot / video info
 *        → source processing (oEmbed, OpenGraph, schema.org JSON-LD)
 *        → [structured data path]  → validated recipe, no AI call
 *        → [AI path] RecipeAIService → JSON → schema validation → normalisation
 *        → saved recipe
 *
 * A source that yields nothing usable produces a clear error plus fallbacks.
 * Nothing is ever invented to make an import "succeed".
 */
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { asyncHandler, getContext } from '../middleware/context.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { RecipeAIService } from '../ai/RecipeAIService.js';
import type { AnalyzeRecipeInput } from '../ai/providers/AIProvider.js';
import { detectPlatform, extractFromUrl, platformGuidance, type Platform } from '../extract/source.js';
import { parseHttpUrl } from '../extract/url.js';
import { recipeDraftSchema, type RecipeDraft } from '../shared.js';
import type { AppContext } from '../context.js';
import { ProgressTracker } from '../lib/progress.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGES = 4;
const DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/;

const urlSourceSchema = z.object({
  type: z.literal('url'),
  url: z.string().trim().min(4).max(2048),
  language: z.string().trim().max(10).optional(),
  save: z.boolean().optional(),
});

const textSourceSchema = z.object({
  type: z.literal('text'),
  text: z.string().trim().min(20, 'Paste a bit more of the recipe so it can be read.').max(50000),
  title: z.string().trim().max(200).optional(),
  language: z.string().trim().max(10).optional(),
  save: z.boolean().optional(),
});

const imageSourceSchema = z.object({
  type: z.literal('image'),
  images: z.array(z.string()).min(1).max(MAX_IMAGES),
  ocrText: z.string().trim().max(20000).optional(),
  note: z.string().trim().max(2000).optional(),
  language: z.string().trim().max(10).optional(),
  save: z.boolean().optional(),
});

const videoSourceSchema = z.object({
  type: z.literal('video'),
  filename: z.string().trim().max(255).optional(),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 6).optional(),
  sizeBytes: z.number().int().min(0).optional(),
  transcript: z.string().trim().max(50000).optional(),
  captions: z.array(z.string().trim().max(5000)).max(20).optional(),
  frames: z.array(z.string()).max(MAX_IMAGES).optional(),
  language: z.string().trim().max(10).optional(),
  save: z.boolean().optional(),
});

const importSchema = z.discriminatedUnion('type', [
  urlSourceSchema,
  textSourceSchema,
  imageSourceSchema,
  videoSourceSchema,
]);

function assertImages(images: string[], maxBytes: number): string[] {
  return images.map((image, index) => {
    const match = DATA_URL_RE.exec(image.trim());
    if (!match) {
      throw new ApiError(400, 'BAD_REQUEST', `Image ${index + 1} must be a PNG, JPEG or WebP data URL.`, {
        recovery: ['Choose a different image', 'Paste the recipe text instead'],
      });
    }
    const base64 = match[2].replace(/\s+/g, '');
    const bytes = Math.floor((base64.length * 3) / 4);
    if (bytes > maxBytes) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', `Image ${index + 1} is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`, {
        recovery: ['Use a smaller image'],
      });
    }
    return `data:image/${match[1] === 'jpg' ? 'jpeg' : match[1]};base64,${base64}`;
  });
}

function requireAi(ctx: AppContext): RecipeAIService {
  if (!ctx.ai) {
    throw new ApiError(503, 'AI_NOT_CONFIGURED', 'AI recipe analysis is not available on this server.', {
      details: { reason: ctx.aiDisabledReason },
      recovery: ['Ask the administrator to configure the AI provider', 'Create the recipe manually'],
      retryable: false,
    });
  }
  return ctx.ai;
}

export function importRoutes(): Router {
  const router = Router();
  router.use(requireAuth);

  // AI calls cost money and time — cap them per user.
  const analyzeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    message: 'You have run a lot of imports in the last hour. Please try again later.',
  });

  router.get('/capabilities', (req, res) => {
    const ctx = getContext(req);
    res.json({
      ai: {
        configured: Boolean(ctx.ai),
        provider: ctx.ai?.providerName ?? null,
        model: ctx.ai?.model ?? null,
        reason: ctx.aiDisabledReason,
      },
      sources: {
        url: true,
        text: true,
        image: Boolean(ctx.ai),
        video: Boolean(ctx.ai),
      },
      limits: { maxUploadBytes: ctx.config.maxUploadBytes, maxImages: MAX_IMAGES },
      notes: [
        'Social platforms do not give third parties access to video audio; captions, titles and screenshots are used instead.',
        'Screenshots and pasted text always work, even when a link cannot be opened.',
      ],
    });
  });

  router.post(
    '/analyze',
    analyzeLimiter,
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const input = importSchema.parse(req.body);
      const warnings: string[] = [];
      const progressId = ProgressTracker.normalizeId(req.get('x-request-id'));
      ctx.progress.start(progressId, userId);

      let aiInput: AnalyzeRecipeInput;
      let platform: Platform | null = null;
      let sourceRef: string | null = null;
      let structuredDraft: RecipeDraft | null = null;
      let imageUrl: string | null = null;

      switch (input.type) {
        case 'url': {
          ctx.progress.push(progressId, 'reading-source');
          platform = detectPlatform(parseHttpUrl(input.url));
          const extraction = await extractFromUrl(input.url, {
            allowPrivateNetwork: ctx.allowPrivateNetworkFetch,
            fetchImpl: ctx.fetchImpl,
          });
          ctx.progress.push(progressId, 'extracting-text');
          warnings.push(...extraction.warnings);
          sourceRef = extraction.url;
          imageUrl = extraction.imageUrl;
          structuredDraft = extraction.structuredRecipe;
          aiInput = {
            sourceType: 'url',
            sourceUrl: extraction.url,
            title: extraction.title,
            description: extraction.description,
            captions: extraction.captions,
            ocrText: null,
            pastedText: extraction.bodyText,
            metadata: extraction.metadata,
            language: input.language ?? null,
          };
          break;
        }
        case 'text': {
          aiInput = {
            sourceType: 'text',
            title: input.title ?? null,
            pastedText: input.text,
            language: input.language ?? null,
          };
          break;
        }
        case 'image': {
          const images = assertImages(input.images, ctx.config.maxUploadBytes);
          aiInput = {
            sourceType: 'image',
            images,
            ocrText: input.ocrText ?? null,
            pastedText: input.note ?? null,
            language: input.language ?? null,
          };
          break;
        }
        case 'video': {
          const frames = input.frames ? assertImages(input.frames, ctx.config.maxUploadBytes) : [];
          if (!input.transcript && !input.captions?.length && frames.length === 0) {
            throw new ApiError(
              422,
              'INSUFFICIENT_SOURCE_DATA',
              'Unable to extract enough information from this video.',
              {
                details: {
                  reason:
                    'This server has no speech-to-text provider configured, so a video file on its own carries no readable content.',
                },
                recovery: ['Upload a screenshot of the recipe', 'Paste the recipe text', 'Add the video caption'],
                retryable: false,
              },
            );
          }
          warnings.push('Video audio is not transcribed by this server — captions, screenshots and notes were used.');
          aiInput = {
            sourceType: 'video',
            transcript: input.transcript ?? null,
            captions: input.captions ?? [],
            images: frames,
            metadata: {
              filename: input.filename ?? null,
              durationSeconds: input.durationSeconds ?? null,
              sizeBytes: input.sizeBytes ?? null,
            },
            language: input.language ?? null,
          };
          break;
        }
        default: {
          throw new ApiError(400, 'BAD_REQUEST', 'Unsupported import source.');
        }
      }

      const sourceHash = RecipeAIService.fingerprint(aiInput);
      const started = Date.now();

      /* ---- Structured data path: a real recipe, no AI needed ------------- */
      if (structuredDraft) {
        const draft = { ...structuredDraft, imageUrl: structuredDraft.imageUrl ?? imageUrl };
        const analysis = ctx.analyses.record({
          userId,
          recipeId: null,
          sourceType: input.type,
          sourceRef,
          sourceHash,
          provider: 'structured-data',
          model: 'schema.org/Recipe',
          status: 'success',
          attempts: 1,
          durationMs: Date.now() - started,
          resultJson: JSON.stringify(draft),
        });
        const recipe = ctx.recipes.create(userId, recipeDraftSchema.parse(draft));
        ctx.analyses.attachRecipe(analysis.id, recipe.id);
        res.status(201).json({
          recipe,
          analysis: {
            id: analysis.id,
            source: 'structured-data',
            provider: 'structured-data',
            model: 'schema.org/Recipe',
            attempts: 1,
            durationMs: analysis.durationMs,
            cached: false,
          },
          warnings: [...warnings, 'This page published a machine-readable recipe, so it was imported directly.'],
        });
        return;
      }

      /* ---- AI path ------------------------------------------------------- */
      const ai = requireAi(ctx);
      ctx.progress.push(progressId, 'analysing');

      const cached = ctx.analyses.findRecentSuccess(userId, sourceHash, CACHE_TTL_MS);
      if (cached) {
        const parsed = recipeDraftSchema.safeParse(JSON.parse(cached.resultJson));
        if (parsed.success) {
          const recipe = ctx.recipes.create(userId, { ...parsed.data, imageUrl: parsed.data.imageUrl ?? imageUrl });
          res.status(201).json({
            recipe,
            analysis: {
              id: cached.record.id,
              source: 'cache',
              provider: cached.record.provider,
              model: cached.record.model,
              attempts: cached.record.attempts,
              durationMs: 0,
              cached: true,
            },
            warnings: [...warnings, 'This exact source was analysed recently — the saved analysis was reused.'],
          });
          return;
        }
      }

      try {
        const outcome = await ai.analyze(aiInput);
        const draft: RecipeDraft = {
          ...outcome.draft,
          imageUrl: outcome.draft.imageUrl ?? imageUrl,
          sourceType: input.type,
          sourceUrl: sourceRef,
        };
        ctx.progress.push(progressId, 'validating');
        const analysis = ctx.analyses.record({
          userId,
          recipeId: null,
          sourceType: input.type,
          sourceRef,
          sourceHash,
          provider: outcome.provider,
          model: outcome.model,
          status: 'success',
          attempts: outcome.attempts,
          durationMs: outcome.durationMs,
          resultJson: JSON.stringify(draft),
        });
        ctx.progress.push(progressId, 'saving');
        const recipe = ctx.recipes.create(userId, recipeDraftSchema.parse(draft));
        ctx.analyses.attachRecipe(analysis.id, recipe.id);
        ctx.progress.push(progressId, 'done');

        if (draft.missingInfo.length > 0) {
          warnings.push(`The source did not state: ${draft.missingInfo.join(', ')}. Add the details yourself when you edit.`);
        }

        res.status(201).json({
          recipe,
          analysis: {
            id: analysis.id,
            source: 'ai',
            provider: outcome.provider,
            model: outcome.model,
            attempts: outcome.attempts,
            durationMs: outcome.durationMs,
            repaired: outcome.repaired,
            cached: false,
          },
          warnings,
        });
      } catch (error) {
        let apiError = error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'Import failed.');
        if (apiError.code === 'INSUFFICIENT_SOURCE_DATA' && platform) {
          const guidance = platformGuidance(platform);
          apiError = new ApiError(422, 'INSUFFICIENT_SOURCE_DATA', "We couldn't extract enough information from this video.", {
            details: { platform, reason: guidance.note },
            recovery: [...guidance.recovery, 'Try again'],
            retryable: false,
          });
        }
        ctx.progress.fail(progressId, apiError.message);
        ctx.analyses.record({
          userId,
          recipeId: null,
          sourceType: input.type,
          sourceRef,
          sourceHash,
          provider: ai.providerName,
          model: ai.model,
          status: 'failed',
          errorCode: apiError.code,
          attempts: 1,
          durationMs: Date.now() - started,
          resultJson: null,
        });
        throw apiError;
      }
    }),
  );

  /** Real, server-recorded progress for an import that is running now. */
  router.get(
    '/progress/:id',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const id = ProgressTracker.normalizeId(req.params.id);
      const record = id ? ctx.progress.get(id, currentUser(req).id) : null;
      if (!record) {
        res.json({ known: false, phases: [], finished: false, error: null });
        return;
      }
      res.json({
        known: true,
        phases: record.entries.map((entry) => ({ phase: entry.phase, label: entry.label, at: entry.at })),
        finished: record.finished,
        error: record.error,
      });
    }),
  );

  router.get(
    '/history',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      res.json({ analyses: ctx.analyses.listForUser(currentUser(req).id, 20) });
    }),
  );

  return router;
}
