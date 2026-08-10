/**
 * Serving-size scaling.
 *
 * Quantities are stored normalised against `recipe.servings`; scaling always
 * recomputes from that stored number instead of rewriting displayed text, so
 * 2 → 4 → 1 servings round-trips exactly.
 */
import type { Ingredient, RecipeDraft } from './recipe.js';
import { formatMeasure, humanizeMeasure } from './units.js';

export function scaleFactor(baseServings: number | null | undefined, targetServings: number | null | undefined): number {
  if (!baseServings || !targetServings) return 1;
  if (baseServings <= 0 || targetServings <= 0) return 1;
  return targetServings / baseServings;
}

export interface ScaledIngredient extends Ingredient {
  /** Quantity after scaling (null keeps its "no amount given" meaning). */
  scaledQuantity: number | null;
  /** Unit chosen for display; may differ from `unit` (1200 g → 1.2 kg). */
  displayUnit: string | null;
  displayQuantity: number | null;
  displayText: string;
  /** True when this row was multiplied by a factor other than 1. */
  wasScaled: boolean;
}

export function scaleIngredient(ingredient: Ingredient, factor: number): ScaledIngredient {
  const canScale = ingredient.scalable && ingredient.quantity != null && Number.isFinite(factor) && factor > 0;
  const scaledQuantity = canScale ? roundSensibly(ingredient.quantity! * factor) : ingredient.quantity;

  let displayQuantity = scaledQuantity;
  let displayUnit = ingredient.unit;
  if (scaledQuantity != null) {
    const human = humanizeMeasure(scaledQuantity, ingredient.unit);
    displayQuantity = roundSensibly(human.value);
    displayUnit = human.unit;
  }

  return {
    ...ingredient,
    scaledQuantity,
    displayQuantity,
    displayUnit,
    displayText: formatMeasure(displayQuantity, displayUnit),
    wasScaled: canScale && Math.abs(factor - 1) > 1e-9,
  };
}

/** Keeps floating point noise (0.30000000000000004) out of the UI and the DB. */
export function roundSensibly(value: number): number {
  if (!Number.isFinite(value)) return value;
  const abs = Math.abs(value);
  if (abs >= 100) return Math.round(value * 10) / 10;
  if (abs >= 10) return Math.round(value * 100) / 100;
  return Math.round(value * 1000) / 1000;
}

export function scaleIngredients(ingredients: Ingredient[], factor: number): ScaledIngredient[] {
  return ingredients.map((i) => scaleIngredient(i, factor));
}

export function scaleRecipe(
  recipe: Pick<RecipeDraft, 'servings' | 'ingredients'>,
  targetServings: number | null,
): { factor: number; ingredients: ScaledIngredient[] } {
  const factor = scaleFactor(recipe.servings, targetServings);
  return { factor, ingredients: scaleIngredients(recipe.ingredients, factor) };
}
