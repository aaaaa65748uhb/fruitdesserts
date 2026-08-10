import { Router } from 'express';
import { z } from 'zod';
import { ApiError, forbidden, notFound } from '../lib/errors.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { asyncHandler, getContext } from '../middleware/context.js';
import type { AppContext } from '../context.js';
import type { StoredRecipe } from '../db/recipes.js';
import { recipeDraftSchema, scaleRecipe, type RecipeDraft } from '../shared.js';

/** Client-supplied recipe. Positions are re-derived from array order. */
const recipeInputSchema = recipeDraftSchema.extend({
  ingredients: recipeDraftSchema.shape.ingredients,
  steps: recipeDraftSchema.shape.steps,
});

const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  favorite: z.enum(['true', 'false']).optional(),
  collectionId: z.string().uuid().optional(),
  tag: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function loadRecipe(ctx: AppContext, userId: string, id: string): StoredRecipe {
  const recipe = ctx.recipes.findById(userId, id);
  if (recipe) return recipe;
  // Distinguish "does not exist" from "belongs to somebody else" without
  // leaking the other user's data: both are refused, with accurate status.
  if (ctx.recipes.existsAnywhere(id)) throw forbidden('This recipe belongs to another account.');
  throw notFound('Recipe not found.');
}

function normalizePositions(draft: RecipeDraft): RecipeDraft {
  return {
    ...draft,
    ingredients: draft.ingredients.map((ingredient, index) => ({ ...ingredient, position: index })),
    steps: draft.steps.map((step, index) => ({ ...step, position: index })),
  };
}

export function recipeRoutes(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const query = listQuerySchema.parse(req.query);
      const result = ctx.recipes.list(currentUser(req).id, {
        search: query.search,
        favoritesOnly: query.favorite === 'true',
        collectionId: query.collectionId,
        tag: query.tag,
        limit: query.limit,
        offset: query.offset,
      });
      res.json({ ...result, limit: query.limit ?? 50, offset: query.offset ?? 0 });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const draft = normalizePositions(recipeInputSchema.parse(req.body));
      const recipe = ctx.recipes.create(currentUser(req).id, draft);
      res.status(201).json({ recipe });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const recipe = loadRecipe(ctx, currentUser(req).id, req.params.id);
      const collections = ctx.collections.collectionsForRecipe(currentUser(req).id, recipe.id);
      res.json({ recipe, collectionIds: collections });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const existing = loadRecipe(ctx, userId, req.params.id);

      const body = recipeInputSchema.extend({ version: z.number().int().positive().optional() }).parse(req.body);
      const { version, ...draftInput } = body;
      const draft = normalizePositions(draftInput as RecipeDraft);

      const updated = ctx.recipes.update(userId, existing.id, draft, version);
      if (!updated) {
        throw new ApiError(
          409,
          'VERSION_CONFLICT',
          'This recipe was changed somewhere else. Reload it and apply your edit again.',
          { details: { currentVersion: existing.version }, retryable: false },
        );
      }
      res.json({ recipe: updated });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const recipe = loadRecipe(ctx, userId, req.params.id);
      ctx.recipes.delete(userId, recipe.id);
      res.json({ ok: true, id: recipe.id });
    }),
  );

  router.post(
    '/:id/favorite',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const recipe = loadRecipe(ctx, userId, req.params.id);
      const { favorite } = z.object({ favorite: z.boolean() }).parse(req.body);
      const isFavorite = ctx.recipes.setFavorite(userId, recipe.id, favorite);
      res.json({ id: recipe.id, isFavorite });
    }),
  );

  /** Server-side scaling — the same shared implementation the UI uses. */
  router.get(
    '/:id/scaled',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const recipe = loadRecipe(ctx, userId, req.params.id);
      const { servings } = z.object({ servings: z.coerce.number().int().min(1).max(500) }).parse(req.query);
      const scaled = scaleRecipe(recipe, servings);
      res.json({
        id: recipe.id,
        baseServings: recipe.servings,
        servings,
        factor: scaled.factor,
        ingredients: scaled.ingredients,
      });
    }),
  );

  return router;
}
