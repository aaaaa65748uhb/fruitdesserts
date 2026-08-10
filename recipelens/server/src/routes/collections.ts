import { Router } from 'express';
import { z } from 'zod';
import { conflict, notFound } from '../lib/errors.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { asyncHandler, getContext } from '../middleware/context.js';
import { loadRecipe } from './recipes.js';

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Give the collection a name.').max(80),
  description: z.string().trim().max(500).nullable().optional(),
});

export function collectionRoutes(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      res.json({ collections: ctx.collections.list(currentUser(req).id) });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const input = bodySchema.parse(req.body);
      if (ctx.collections.findByName(userId, input.name)) {
        throw conflict('You already have a collection with that name.');
      }
      const collection = ctx.collections.create(userId, input.name, input.description ?? null);
      res.status(201).json({ collection });
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const input = bodySchema.parse(req.body);
      const existing = ctx.collections.findById(userId, req.params.id);
      if (!existing) throw notFound('Collection not found.');

      const clash = ctx.collections.findByName(userId, input.name);
      if (clash && clash.id !== existing.id) throw conflict('You already have a collection with that name.');

      const updated = ctx.collections.update(userId, existing.id, input.name, input.description ?? null);
      res.json({ collection: updated });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const removed = ctx.collections.delete(currentUser(req).id, req.params.id);
      if (!removed) throw notFound('Collection not found.');
      res.json({ ok: true, id: req.params.id });
    }),
  );

  router.post(
    '/:id/recipes',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const collection = ctx.collections.findById(userId, req.params.id);
      if (!collection) throw notFound('Collection not found.');

      const { recipeId } = z.object({ recipeId: z.string().uuid() }).parse(req.body);
      const recipe = loadRecipe(ctx, userId, recipeId);
      ctx.collections.addRecipe(collection.id, recipe.id);
      res.status(201).json({ collection: ctx.collections.findById(userId, collection.id) });
    }),
  );

  router.delete(
    '/:id/recipes/:recipeId',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const collection = ctx.collections.findById(userId, req.params.id);
      if (!collection) throw notFound('Collection not found.');
      ctx.collections.removeRecipe(collection.id, req.params.recipeId);
      res.json({ collection: ctx.collections.findById(userId, collection.id) });
    }),
  );

  return router;
}
