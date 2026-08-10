/**
 * Recipe assistant: nutrition estimates, substitutions, AI customisation and
 * recipe Q&A. All of it runs through RecipeAIService, so the same validation,
 * retry and error rules apply — and every number is labelled an estimate.
 */
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { asyncHandler, getContext } from '../middleware/context.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { CHAT_SYSTEM, NUTRITION_SYSTEM, SUBSTITUTION_SYSTEM, customizationSystem, recipeToPrompt } from '../ai/assistPrompts.js';
import type { AppContext } from '../context.js';
import type { RecipeAIService } from '../ai/RecipeAIService.js';
import { loadRecipe } from './recipes.js';
import {
  aiChatAnswerSchema,
  aiCustomizationSchema,
  aiNutritionSchema,
  aiSubstitutionsSchema,
  chatAnswerSchema,
  customizationSchema,
  CUSTOMIZATION_GOALS,
  normalizeUnitToken,
  nutritionSchema,
  parseQuantity,
  substitutionSchema,
  type Customization,
  type Nutrition,
  type Substitution,
} from '../shared.js';

function requireAi(ctx: AppContext): RecipeAIService {
  if (!ctx.ai) {
    throw new ApiError(503, 'AI_NOT_CONFIGURED', 'The recipe assistant is not available on this server.', {
      details: { reason: ctx.aiDisabledReason },
      recovery: ['Ask the administrator to configure the AI provider'],
      retryable: false,
    });
  }
  return ctx.ai;
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return parseQuantity(value).value;
  return null;
}

function toText(value: unknown, max: number): string | null {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'n/a', 'unknown'].includes(text.toLowerCase())) return null;
  return text.slice(0, max);
}

function clamp(value: number | null, min: number, max: number): number | null {
  if (value == null) return null;
  return Math.min(max, Math.max(min, value));
}

export function assistRoutes(): Router {
  const router = Router();
  router.use(requireAuth);

  const assistLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 120,
    message: 'That is a lot of assistant requests in one hour. Please try again later.',
  });
  router.use(assistLimiter);

  /* ---- Nutrition -------------------------------------------------------- */
  router.post(
    '/:id/nutrition',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const ai = requireAi(ctx);
      const recipe = loadRecipe(ctx, currentUser(req).id, req.params.id);
      const { servings } = z.object({ servings: z.number().int().min(1).max(500).optional() }).parse(req.body ?? {});

      const outcome = await ai.runStructured(
        'nutrition',
        NUTRITION_SYSTEM,
        recipeToPrompt(recipe, servings ?? recipe.servings),
        aiNutritionSchema,
        (raw): Nutrition => {
          const macros = [raw.calories, raw.protein, raw.carbs, raw.fat].map(toNumber);
          if (macros.every((value) => value == null)) {
            // An estimate with no numbers in it is not an estimate. Ask again
            // rather than presenting an empty panel as a result.
            throw new Error('the answer contained no usable nutrition values');
          }
          return nutritionSchema.parse({
            calories: clamp(toNumber(raw.calories), 0, 20000),
            protein: clamp(toNumber(raw.protein), 0, 2000),
            carbs: clamp(toNumber(raw.carbs), 0, 2000),
            fat: clamp(toNumber(raw.fat), 0, 2000),
            fiber: clamp(toNumber(raw.fiber), 0, 500),
            sugar: clamp(toNumber(raw.sugar), 0, 2000),
            sodium: clamp(toNumber(raw.sodium), 0, 100000),
            basis: raw.basis === 'whole-recipe' || recipe.servings == null ? 'whole-recipe' : 'per-serving',
            confidence: clamp(toNumber(raw.confidence), 0, 1),
            unaccounted: Array.isArray(raw.unaccounted)
              ? raw.unaccounted.map((v) => toText(v, 120)).filter((v): v is string => v !== null)
              : [],
            notes: toText(raw.notes, 1000),
          });
        },
      );

      res.json({
        nutrition: outcome.value,
        // Said plainly so the client can never present this as fact.
        disclaimer: 'AI estimate from typical ingredient values — not a verified nutritional analysis.',
        analysis: { provider: outcome.provider, model: outcome.model, attempts: outcome.attempts, durationMs: outcome.durationMs },
      });
    }),
  );

  /* ---- Substitutions ---------------------------------------------------- */
  router.post(
    '/:id/substitutions',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const ai = requireAi(ctx);
      const recipe = loadRecipe(ctx, currentUser(req).id, req.params.id);
      const { ingredientId, reason } = z
        .object({ ingredientId: z.string().min(1), reason: z.string().trim().max(200).optional() })
        .parse(req.body);

      const ingredient = recipe.ingredients.find((item) => item.id === ingredientId);
      if (!ingredient) throw new ApiError(404, 'NOT_FOUND', 'That ingredient is not part of this recipe.');

      const user = `${recipeToPrompt(recipe)}\n\n### Ingredient to replace\n${ingredient.name}${
        ingredient.note ? ` (${ingredient.note})` : ''
      }${reason ? `\n\n### Why the cook wants to replace it\n${reason}` : ''}`;

      const outcome = await ai.runStructured(
        'substitutions',
        SUBSTITUTION_SYSTEM,
        user,
        aiSubstitutionsSchema,
        (raw): Substitution[] =>
          raw.options
            .map((option) => {
              const replacement = toText(option.replacement, 160);
              const why = toText(option.why, 600);
              if (!replacement || !why) return null;
              return substitutionSchema.parse({
                replacement,
                quantity: toNumber(option.quantity),
                unit: normalizeUnitToken(option.unit == null ? null : String(option.unit)),
                why,
                changes: toText(option.changes, 600),
                suitability: clamp(toNumber(option.suitability), 0, 1),
              });
            })
            .filter((option): option is Substitution => option !== null),
      );

      if (outcome.value.length === 0) {
        throw new ApiError(502, 'AI_INVALID_RESPONSE', 'No usable substitution was returned. Please try again.', {
          retryable: true,
        });
      }

      res.json({
        ingredient: { id: ingredient.id, name: ingredient.name },
        substitutions: outcome.value,
        disclaimer: 'AI suggestions — check them against any allergies or dietary needs.',
        analysis: { provider: outcome.provider, model: outcome.model, attempts: outcome.attempts, durationMs: outcome.durationMs },
      });
    }),
  );

  /* ---- Customisation ---------------------------------------------------- */
  router.post(
    '/:id/customize',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const ai = requireAi(ctx);
      const userId = currentUser(req).id;
      const recipe = loadRecipe(ctx, userId, req.params.id);
      const { goals, notes, save } = z
        .object({
          goals: z.array(z.enum(CUSTOMIZATION_GOALS)).min(1).max(4),
          notes: z.string().trim().max(400).optional(),
          /** When true the result is stored as a new recipe. */
          save: z.boolean().default(false),
        })
        .parse(req.body);

      const user = `${recipeToPrompt(recipe)}${notes ? `\n\n### Extra request from the cook\n${notes}` : ''}`;

      const outcome = await ai.runStructured(
        'customisation',
        customizationSystem(goals),
        user,
        aiCustomizationSchema,
        (raw): Customization =>
          customizationSchema.parse({
            title: toText(raw.title, 200) ?? `${recipe.title} (adapted)`,
            description: toText(raw.description, 4000),
            ingredients: raw.ingredients
              .map((item, index) => {
                const name = toText(item.name, 160);
                if (!name) return null;
                const quantity = toNumber(item.quantity);
                const note = toText(item.note, 240);
                const unquantified = /to taste|as needed/i.test(`${name} ${note ?? ''}`);
                return {
                  name,
                  quantity,
                  unit: normalizeUnitToken(item.unit == null ? null : String(item.unit)),
                  note,
                  optional: item.optional === true || item.optional === 'true',
                  estimated: item.estimated === true || item.estimated === 'true',
                  scalable: quantity != null && !unquantified,
                  group: null,
                  position: index,
                };
              })
              .filter((item) => item !== null),
            steps: raw.steps
              .map((step, index) => {
                const instruction = toText(step.instruction, 2000);
                if (!instruction) return null;
                const duration = toNumber(step.durationSeconds);
                const temperature = toNumber(step.temperatureC);
                return {
                  position: index,
                  instruction,
                  durationSeconds: duration == null ? null : Math.round(clamp(duration, 1, 86400)!),
                  temperatureC: temperature == null ? null : Math.round(clamp(temperature, -40, 500)!),
                  estimated: step.estimated === true || step.estimated === 'true',
                };
              })
              .filter((step) => step !== null),
            changes: raw.changes.map((change) => toText(change, 400)).filter((change): change is string => change !== null),
            warnings: Array.isArray(raw.warnings)
              ? raw.warnings.map((warning) => toText(warning, 300)).filter((warning): warning is string => warning !== null)
              : [],
          }),
        { temperature: 0.4, maxTokens: 4096 },
      );

      let savedRecipe = null;
      if (save) {
        savedRecipe = ctx.recipes.create(userId, {
          ...recipe,
          title: outcome.value.title,
          description: outcome.value.description,
          ingredients: outcome.value.ingredients,
          steps: outcome.value.steps,
          tags: [...new Set([...recipe.tags, ...goals])].slice(0, 20),
          notes: [recipe.notes, `Adapted by AI: ${outcome.value.changes.join(' ')}`].filter(Boolean).join('\n\n').slice(0, 4000),
          // The adaptation is derived from this recipe, not from the original source.
          sourceType: 'manual',
          sourceUrl: recipe.sourceUrl,
        });
      }

      res.json({
        customization: outcome.value,
        goals,
        recipe: savedRecipe,
        disclaimer: 'AI adaptation — check amounts and allergens before cooking.',
        analysis: { provider: outcome.provider, model: outcome.model, attempts: outcome.attempts, durationMs: outcome.durationMs },
      });
    }),
  );

  /* ---- Recipe chat ------------------------------------------------------ */
  router.post(
    '/:id/chat',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const ai = requireAi(ctx);
      const recipe = loadRecipe(ctx, currentUser(req).id, req.params.id);
      const { question, history } = z
        .object({
          question: z.string().trim().min(2, 'Ask a question first.').max(500),
          history: z
            .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }))
            .max(10)
            .optional(),
        })
        .parse(req.body);

      const conversation = (history ?? [])
        .map((turn) => `${turn.role === 'user' ? 'Cook' : 'You'}: ${turn.content}`)
        .join('\n');

      const user = `${recipeToPrompt(recipe)}${conversation ? `\n\n### Conversation so far\n${conversation}` : ''}\n\n### Question\n${question}`;

      const outcome = await ai.runStructured(
        'the recipe question',
        CHAT_SYSTEM,
        user,
        aiChatAnswerSchema,
        (raw) =>
          chatAnswerSchema.parse({
            answer: toText(raw.answer, 4000) ?? 'I could not answer that from this recipe.',
            suggestions: Array.isArray(raw.suggestions)
              ? raw.suggestions.map((s) => toText(s, 200)).filter((s): s is string => s !== null).slice(0, 5)
              : [],
            outsideRecipe: raw.outsideRecipe === true || raw.outsideRecipe === 'true',
          }),
        { temperature: 0.3 },
      );

      res.json({
        ...outcome.value,
        analysis: { provider: outcome.provider, model: outcome.model, attempts: outcome.attempts, durationMs: outcome.durationMs },
      });
    }),
  );

  return router;
}
