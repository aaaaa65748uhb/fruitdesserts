import { Router } from 'express';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { asyncHandler, getContext } from '../middleware/context.js';
import { loadRecipe } from './recipes.js';

const saveSchema = z.object({
  currentStep: z.number().int().min(0).max(500).optional(),
  completedSteps: z.array(z.number().int().min(0).max(500)).max(500).optional(),
  servings: z.number().int().min(1).max(500).nullable().optional(),
  completed: z.boolean().optional(),
});

/** Cooking progress lives on the server, so it survives a refresh or a device swap. */
export function cookingRoutes(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      res.json({ sessions: ctx.cooking.listActive(currentUser(req).id) });
    }),
  );

  router.get(
    '/:recipeId',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const recipe = loadRecipe(ctx, userId, req.params.recipeId);
      res.json({ session: ctx.cooking.get(userId, recipe.id) });
    }),
  );

  router.put(
    '/:recipeId',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const recipe = loadRecipe(ctx, userId, req.params.recipeId);
      const input = saveSchema.parse(req.body);

      const lastIndex = recipe.steps.length - 1;
      if (input.currentStep != null && input.currentStep > lastIndex) {
        throw badRequest(`This recipe only has ${recipe.steps.length} steps.`);
      }
      if (input.completedSteps?.some((index) => index > lastIndex)) {
        throw badRequest('A completed step index is out of range for this recipe.');
      }

      const session = ctx.cooking.save(userId, recipe.id, input);
      res.json({ session });
    }),
  );

  router.delete(
    '/:recipeId',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const recipe = loadRecipe(ctx, userId, req.params.recipeId);
      ctx.cooking.reset(userId, recipe.id);
      res.json({ ok: true });
    }),
  );

  return router;
}
