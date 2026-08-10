/**
 * Schemas for the recipe assistant features: nutrition estimates, ingredient
 * substitutions, AI customisation and recipe Q&A.
 *
 * Everything here is explicitly an *estimate*. The UI labels it as such, and
 * nothing in this file is presented as verified nutritional fact.
 */
import { z } from 'zod';
import { ingredientSchema, stepSchema } from './recipe.js';

/* -------------------------------------------------------------------------- */
/* Nutrition                                                                  */
/* -------------------------------------------------------------------------- */

const nullableNumber = z.union([z.number(), z.string(), z.null()]).nullish();

export const nutritionSchema = z.object({
  calories: z.number().min(0).max(20000).nullable(),
  protein: z.number().min(0).max(2000).nullable(),
  carbs: z.number().min(0).max(2000).nullable(),
  fat: z.number().min(0).max(2000).nullable(),
  fiber: z.number().min(0).max(500).nullable(),
  sugar: z.number().min(0).max(2000).nullable(),
  sodium: z.number().min(0).max(100000).nullable(),
  /** Per serving unless the recipe has no serving count. */
  basis: z.enum(['per-serving', 'whole-recipe']),
  confidence: z.number().min(0).max(1).nullable(),
  /** Ingredients the model could not account for. */
  unaccounted: z.array(z.string().max(120)).max(30).default([]),
  notes: z.string().max(1000).nullable().default(null),
});
export type Nutrition = z.infer<typeof nutritionSchema>;

export const aiNutritionSchema = z.object({
  calories: nullableNumber,
  protein: nullableNumber,
  carbs: nullableNumber,
  fat: nullableNumber,
  fiber: nullableNumber,
  sugar: nullableNumber,
  sodium: nullableNumber,
  basis: z.string().nullish(),
  confidence: nullableNumber,
  unaccounted: z.array(z.union([z.string(), z.number()])).nullish(),
  notes: z.union([z.string(), z.number()]).nullish(),
});

export const dietaryTagSchema = z.string().trim().min(1).max(40);

/* -------------------------------------------------------------------------- */
/* Substitutions                                                              */
/* -------------------------------------------------------------------------- */

export const substitutionSchema = z.object({
  replacement: z.string().trim().min(1).max(160),
  quantity: z.number().min(0).max(1e6).nullable(),
  unit: z.string().trim().max(24).nullable(),
  /** Why this swap works for this specific recipe. */
  why: z.string().trim().min(1).max(600),
  /** What the cook should expect to be different. */
  changes: z.string().trim().max(600).nullable(),
  /** 0..1 — how well it preserves the original result. */
  suitability: z.number().min(0).max(1).nullable(),
});
export type Substitution = z.infer<typeof substitutionSchema>;

export const aiSubstitutionsSchema = z.object({
  ingredient: z.union([z.string(), z.number()]).nullish(),
  options: z
    .array(
      z.object({
        replacement: z.union([z.string(), z.number()]),
        quantity: nullableNumber,
        unit: z.union([z.string(), z.number(), z.null()]).nullish(),
        why: z.union([z.string(), z.number()]).nullish(),
        changes: z.union([z.string(), z.number(), z.null()]).nullish(),
        suitability: nullableNumber,
      }),
    )
    .min(1)
    .max(6),
});

/* -------------------------------------------------------------------------- */
/* Customisation                                                              */
/* -------------------------------------------------------------------------- */

export const CUSTOMIZATION_GOALS = [
  'high-protein',
  'lower-calorie',
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'less-spicy',
  'more-spicy',
  'budget-friendly',
  'faster',
  'fewer-ingredients',
] as const;
export type CustomizationGoal = (typeof CUSTOMIZATION_GOALS)[number];

export const GOAL_LABELS: Record<CustomizationGoal, string> = {
  'high-protein': 'High protein',
  'lower-calorie': 'Lower calorie',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'gluten-free': 'Gluten-free',
  'dairy-free': 'Dairy-free',
  'less-spicy': 'Less spicy',
  'more-spicy': 'More spicy',
  'budget-friendly': 'Budget-friendly',
  faster: 'Faster recipe',
  'fewer-ingredients': 'Fewer ingredients',
};

/** A customised recipe plus a plain-language account of what changed. */
export const customizationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable(),
  ingredients: z.array(ingredientSchema).min(1).max(200),
  steps: z.array(stepSchema).min(1).max(200),
  changes: z.array(z.string().trim().min(1).max(400)).min(1).max(30),
  warnings: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
});
export type Customization = z.infer<typeof customizationSchema>;

export const aiCustomizationSchema = z.object({
  title: z.union([z.string(), z.number()]).nullish(),
  description: z.union([z.string(), z.number(), z.null()]).nullish(),
  ingredients: z
    .array(
      z.object({
        name: z.union([z.string(), z.number()]),
        quantity: nullableNumber,
        unit: z.union([z.string(), z.number(), z.null()]).nullish(),
        note: z.union([z.string(), z.number(), z.null()]).nullish(),
        optional: z.union([z.boolean(), z.string(), z.number()]).nullish(),
        estimated: z.union([z.boolean(), z.string(), z.number()]).nullish(),
      }),
    )
    .min(1),
  steps: z
    .array(
      z.object({
        instruction: z.union([z.string(), z.number()]),
        durationSeconds: nullableNumber,
        temperatureC: nullableNumber,
        estimated: z.union([z.boolean(), z.string(), z.number()]).nullish(),
      }),
    )
    .min(1),
  changes: z.array(z.union([z.string(), z.number()])).min(1),
  warnings: z.array(z.union([z.string(), z.number()])).nullish(),
});

/* -------------------------------------------------------------------------- */
/* Recipe chat                                                                */
/* -------------------------------------------------------------------------- */

export const chatAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(4000),
  /** Concrete follow-up actions, e.g. "swap the cream for yoghurt". */
  suggestions: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
  /** True when the recipe itself does not contain the answer. */
  outsideRecipe: z.boolean().default(false),
});
export type ChatAnswer = z.infer<typeof chatAnswerSchema>;

export const aiChatAnswerSchema = z.object({
  answer: z.union([z.string(), z.number()]),
  suggestions: z.array(z.union([z.string(), z.number()])).nullish(),
  outsideRecipe: z.union([z.boolean(), z.string(), z.number()]).nullish(),
});
