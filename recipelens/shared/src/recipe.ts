/**
 * Canonical recipe domain model + validation schemas.
 *
 * `aiRecipeSchema` is deliberately tolerant (the model may send strings where
 * numbers are expected) — `normalizeAiRecipe` turns a *validated* AI payload
 * into the strict `RecipeDraft` shape the database accepts.
 */
import { z } from 'zod';
import { normalizeUnitToken, parseQuantity } from './units.js';

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SOURCE_TYPES = ['url', 'text', 'image', 'video', 'manual'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Strict domain model                                                        */
/* -------------------------------------------------------------------------- */

export const ingredientSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(160),
  /** Quantity for ONE batch at `recipe.servings`. Null when unquantified. */
  quantity: z.number().finite().nonnegative().nullable(),
  unit: z.string().trim().max(24).nullable(),
  note: z.string().trim().max(240).nullable().default(null),
  optional: z.boolean().default(false),
  /** The AI (or user) estimated this amount rather than reading it. */
  estimated: z.boolean().default(false),
  /** "to taste"/"for frying" style amounts must not be multiplied. */
  scalable: z.boolean().default(true),
  group: z.string().trim().max(80).nullable().default(null),
  position: z.number().int().nonnegative().default(0),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const stepSchema = z.object({
  id: z.string().optional(),
  position: z.number().int().nonnegative().default(0),
  instruction: z.string().trim().min(1).max(2000),
  durationSeconds: z.number().int().positive().max(60 * 60 * 24).nullable().default(null),
  temperatureC: z.number().int().min(-40).max(500).nullable().default(null),
  estimated: z.boolean().default(false),
});
export type Step = z.infer<typeof stepSchema>;

/**
 * `z.string().url()` happily accepts `javascript:` and `data:` URLs, and these
 * values end up in `<a href>` / `<img src>`. Only http(s) is ever allowed.
 */
const webUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), { message: 'Only http:// and https:// links are allowed.' });

export const recipeDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().default(null),
  servings: z.number().int().positive().max(500).nullable().default(null),
  prepMinutes: z.number().int().nonnegative().max(60 * 24).nullable().default(null),
  cookMinutes: z.number().int().nonnegative().max(60 * 24).nullable().default(null),
  difficulty: z.enum(DIFFICULTIES).nullable().default(null),
  cuisine: z.string().trim().max(80).nullable().default(null),
  imageUrl: webUrlSchema.nullable().default(null),
  sourceUrl: webUrlSchema.nullable().default(null),
  sourceType: z.enum(SOURCE_TYPES).default('manual'),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  equipment: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  notes: z.string().trim().max(4000).nullable().default(null),
  /** Fields the AI could not read from the source and left empty. */
  missingInfo: z.array(z.string().trim().max(120)).max(20).default([]),
  /** 0..1 self-reported extraction confidence, null when not applicable. */
  confidence: z.number().min(0).max(1).nullable().default(null),
  ingredients: z.array(ingredientSchema).min(1).max(200),
  steps: z.array(stepSchema).min(1).max(200),
});
export type RecipeDraft = z.infer<typeof recipeDraftSchema>;

export interface Recipe extends RecipeDraft {
  id: string;
  userId: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Tolerant AI payload schema                                                 */
/* -------------------------------------------------------------------------- */

const looseString = z.union([z.string(), z.number()]).nullish().transform((v) => (v == null ? null : String(v)));
const looseNumber = z.union([z.number(), z.string()]).nullish();
const looseBool = z.union([z.boolean(), z.string(), z.number()]).nullish();

export const aiIngredientSchema = z.object({
  name: z.union([z.string(), z.number()]).transform((v) => String(v)),
  quantity: looseNumber,
  unit: looseString,
  note: looseString,
  optional: looseBool,
  estimated: looseBool,
  group: looseString,
});

export const aiStepSchema = z.object({
  instruction: z.union([z.string(), z.number()]).transform((v) => String(v)),
  durationSeconds: looseNumber,
  temperatureC: looseNumber,
  estimated: looseBool,
});

export const aiRecipeSchema = z.object({
  title: looseString,
  description: looseString,
  servings: looseNumber,
  prepMinutes: looseNumber,
  cookMinutes: looseNumber,
  difficulty: looseString,
  cuisine: looseString,
  tags: z.array(z.union([z.string(), z.number()])).nullish(),
  equipment: z.array(z.union([z.string(), z.number()])).nullish(),
  notes: looseString,
  missingInfo: z.array(z.union([z.string(), z.number()])).nullish(),
  confidence: looseNumber,
  ingredients: z.array(aiIngredientSchema).min(1),
  steps: z.array(aiStepSchema).min(1),
});
export type AiRecipePayload = z.infer<typeof aiRecipeSchema>;

/* -------------------------------------------------------------------------- */
/* Normalisation                                                              */
/* -------------------------------------------------------------------------- */

const UNQUANTIFIED_HINTS = [
  'to taste', 'as needed', 'for serving', 'for garnish', 'for frying', 'for greasing',
  'optional', 'a pinch', 'some', 'לפי הטעם', 'לפי טעם',
];

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return parseQuantity(value).value;
  return null;
}

function toBool(value: unknown, fallback = false): boolean {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value).trim().toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(s)) return true;
  if (['false', 'no', '0', 'n'].includes(s)) return false;
  return fallback;
}

function clampInt(value: number | null, min: number, max: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function cleanText(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const t = String(value).replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const lowered = t.toLowerCase();
  if (['null', 'undefined', 'n/a', 'unknown', 'none'].includes(lowered)) return null;
  return t.slice(0, max);
}

function cleanList(value: unknown, max: number, itemMax: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    const t = cleanText(typeof raw === 'number' ? String(raw) : (raw as string), itemMax);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export interface NormalizeOptions {
  sourceType?: SourceType;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  fallbackTitle?: string;
}

/**
 * Turn a validated AI payload into a strict `RecipeDraft`.
 * Nothing is invented here: unreadable values stay `null` and quantities the
 * model marked (or that look) uncertain keep `estimated: true`.
 */
export function normalizeAiRecipe(payload: AiRecipePayload, opts: NormalizeOptions = {}): RecipeDraft {
  const ingredients: Ingredient[] = [];
  payload.ingredients.forEach((raw, index) => {
    const name = cleanText(raw.name, 160);
    if (!name) return;
    const note = cleanText(raw.note ?? null, 240);
    const haystack = `${name} ${note ?? ''}`.toLowerCase();
    const unquantified = UNQUANTIFIED_HINTS.some((h) => haystack.includes(h));

    let quantity = toNumber(raw.quantity);
    if (quantity != null && (!Number.isFinite(quantity) || quantity < 0 || quantity > 1e6)) quantity = null;

    ingredients.push({
      name,
      quantity,
      unit: normalizeUnitToken(raw.unit ?? null),
      note,
      optional: toBool(raw.optional, false) || haystack.includes('optional'),
      estimated: toBool(raw.estimated, false),
      scalable: quantity != null && !unquantified,
      group: cleanText(raw.group ?? null, 80),
      position: index,
    });
  });

  const steps: Step[] = [];
  payload.steps.forEach((raw) => {
    const instruction = cleanText(raw.instruction, 2000);
    if (!instruction) return;
    steps.push({
      position: steps.length,
      instruction,
      durationSeconds: clampInt(toNumber(raw.durationSeconds), 1, 60 * 60 * 24),
      temperatureC: clampInt(toNumber(raw.temperatureC), -40, 500),
      estimated: toBool(raw.estimated, false),
    });
  });

  const difficultyRaw = cleanText(payload.difficulty ?? null, 20)?.toLowerCase() ?? null;
  const difficulty = (DIFFICULTIES as readonly string[]).includes(difficultyRaw ?? '')
    ? (difficultyRaw as Difficulty)
    : null;

  const confidenceRaw = toNumber(payload.confidence);
  const confidence = confidenceRaw == null ? null : Math.min(1, Math.max(0, confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw));

  const draft: RecipeDraft = {
    title: cleanText(payload.title, 200) ?? opts.fallbackTitle ?? 'Untitled recipe',
    description: cleanText(payload.description ?? null, 4000),
    servings: clampInt(toNumber(payload.servings), 1, 500),
    prepMinutes: clampInt(toNumber(payload.prepMinutes), 0, 60 * 24),
    cookMinutes: clampInt(toNumber(payload.cookMinutes), 0, 60 * 24),
    difficulty,
    cuisine: cleanText(payload.cuisine ?? null, 80),
    imageUrl: opts.imageUrl ?? null,
    sourceUrl: opts.sourceUrl ?? null,
    sourceType: opts.sourceType ?? 'manual',
    tags: cleanList(payload.tags, 20, 40),
    equipment: cleanList(payload.equipment, 30, 80),
    notes: cleanText(payload.notes ?? null, 4000),
    missingInfo: cleanList(payload.missingInfo, 20, 120),
    confidence,
    ingredients,
    steps,
  };

  // Record, rather than invent, anything the source did not provide.
  const missing = new Set(draft.missingInfo);
  if (draft.servings == null) missing.add('servings');
  if (draft.prepMinutes == null && draft.cookMinutes == null) missing.add('timing');
  draft.missingInfo = [...missing].slice(0, 20);

  return recipeDraftSchema.parse(draft);
}

export function totalMinutes(recipe: Pick<RecipeDraft, 'prepMinutes' | 'cookMinutes'>): number | null {
  if (recipe.prepMinutes == null && recipe.cookMinutes == null) return null;
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
}
