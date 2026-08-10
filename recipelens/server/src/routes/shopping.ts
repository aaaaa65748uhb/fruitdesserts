import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { asyncHandler, getContext } from '../middleware/context.js';
import { normalizeUnitToken, scaleRecipe } from '../shared.js';
import { loadRecipe } from './recipes.js';

const itemInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  quantity: z.number().finite().nonnegative().max(1e6).nullable().optional(),
  unit: z.string().trim().max(24).nullable().optional(),
  note: z.string().trim().max(240).nullable().optional(),
  recipeId: z.string().uuid().nullable().optional(),
});

const addSchema = z.union([
  itemInputSchema,
  z.object({ items: z.array(itemInputSchema).min(1).max(100) }),
]);

const fromRecipeSchema = z.object({
  recipeId: z.string().uuid(),
  servings: z.number().int().min(1).max(500).optional(),
  includeOptional: z.boolean().optional(),
  /** Restrict to a subset of ingredient ids (checkbox selection in the UI). */
  ingredientIds: z.array(z.string()).max(200).optional(),
});

export function shoppingRoutes(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const items = ctx.shopping.list(currentUser(req).id);
      res.json({
        items,
        counts: { total: items.length, checked: items.filter((i) => i.checked).length },
      });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const parsed = addSchema.parse(req.body);
      const rawItems = 'items' in parsed ? parsed.items : [parsed];
      const items = rawItems.map((item) => ({
        name: item.name,
        quantity: item.quantity ?? null,
        unit: normalizeUnitToken(item.unit ?? null),
        note: item.note ?? null,
        recipeId: item.recipeId ?? null,
      }));
      const result = ctx.shopping.addMany(currentUser(req).id, items);
      res.status(201).json({
        added: result.added,
        merged: result.merged,
        items: ctx.shopping.list(currentUser(req).id),
      });
    }),
  );

  /** Adds a recipe's ingredients, scaled to the servings the user is cooking. */
  router.post(
    '/from-recipe',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const userId = currentUser(req).id;
      const input = fromRecipeSchema.parse(req.body);
      const recipe = loadRecipe(ctx, userId, input.recipeId);

      const target = input.servings ?? recipe.servings ?? null;
      const scaled = scaleRecipe(recipe, target);
      const selected = new Set(input.ingredientIds ?? []);

      const items = scaled.ingredients
        .filter((ingredient) => (input.includeOptional ?? true) || !ingredient.optional)
        .filter((ingredient) => selected.size === 0 || (ingredient.id != null && selected.has(ingredient.id)))
        .map((ingredient) => ({
          name: ingredient.name,
          quantity: ingredient.displayQuantity,
          unit: ingredient.displayUnit,
          note: ingredient.note,
          recipeId: recipe.id,
        }));

      const result = ctx.shopping.addMany(userId, items);
      res.status(201).json({
        added: result.added,
        merged: result.merged,
        items: ctx.shopping.list(userId),
      });
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const patch = z
        .object({
          name: z.string().trim().min(1).max(160).optional(),
          quantity: z.number().finite().nonnegative().max(1e6).nullable().optional(),
          unit: z.string().trim().max(24).nullable().optional(),
          note: z.string().trim().max(240).nullable().optional(),
          checked: z.boolean().optional(),
        })
        .parse(req.body);

      const updated = ctx.shopping.update(currentUser(req).id, req.params.id, {
        ...patch,
        unit: patch.unit === undefined ? undefined : normalizeUnitToken(patch.unit),
      });
      if (!updated) throw notFound('That shopping list item does not exist.');
      res.json({ item: updated });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const removed = ctx.shopping.delete(currentUser(req).id, req.params.id);
      if (!removed) throw notFound('That shopping list item does not exist.');
      res.json({ ok: true, id: req.params.id });
    }),
  );

  router.post(
    '/clear',
    asyncHandler(async (req, res) => {
      const ctx = getContext(req);
      const { onlyChecked } = z.object({ onlyChecked: z.boolean().default(true) }).parse(req.body ?? {});
      const removed = ctx.shopping.clear(currentUser(req).id, onlyChecked);
      res.json({ ok: true, removed });
    }),
  );

  return router;
}
