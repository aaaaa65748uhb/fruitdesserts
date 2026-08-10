/**
 * Source processing: turn a link into whatever text/metadata is actually
 * available, without ever inventing content.
 *
 * Two paths exist on purpose:
 *  - schema.org/Recipe JSON-LD → a complete recipe, no AI call needed;
 *  - anything else → the material is handed to RecipeAIService.
 * When a platform blocks automated access (common for TikTok/Instagram video)
 * the caller gets a clear "not enough information" error plus fallbacks.
 */
import { ApiError } from '../lib/errors.js';
import { normalizeUnitToken, parseQuantity, recipeDraftSchema, type Ingredient, type RecipeDraft, type Step } from '../shared.js';
import { decodeEntities, jsonLdBlocks, metaContent, pageTitle, visibleText } from './html.js';
import { fetchText, parseHttpUrl, type FetchTextOptions } from './url.js';

export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'pinterest' | 'web';

export interface SourceExtraction {
  url: string;
  platform: Platform;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  captions: string[];
  bodyText: string | null;
  metadata: Record<string, string | number | null>;
  /** A complete recipe found in structured data — no AI required. */
  structuredRecipe: RecipeDraft | null;
  warnings: string[];
}

export function detectPlatform(url: URL): Platform {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host.endsWith('tiktok.com')) return 'tiktok';
  if (host.endsWith('instagram.com')) return 'instagram';
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'youtube';
  if (host.endsWith('facebook.com') || host.endsWith('fb.watch')) return 'facebook';
  if (host.endsWith('pinterest.com') || host.endsWith('pin.it')) return 'pinterest';
  return 'web';
}

/**
 * Tracking parameters that change per share but not the content. Removing them
 * makes the analysis cache hit when the same video is shared twice.
 */
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'igshid', 'igsh', 'si', '_r', '_t', 'is_from_webapp', 'sender_device',
  'web_id', 'fbclid', 'gclid', 'share_app_id', 'share_link_id', 'feature',
];

export function canonicalizeUrl(url: URL): URL {
  const copy = new URL(url.toString());
  for (const param of TRACKING_PARAMS) copy.searchParams.delete(param);
  copy.hash = '';
  return copy;
}

/**
 * What a user can do when a platform will not hand over enough information.
 * These are honest fallbacks — RecipeLens never works around access controls.
 */
export function platformGuidance(platform: Platform): { note: string; recovery: string[] } {
  const common = ['Upload a screenshot of the recipe', 'Paste the recipe text', 'Upload the video'];
  switch (platform) {
    case 'tiktok':
      return {
        note: 'TikTok only exposes the title and thumbnail to other apps — the audio and on-screen text are not available.',
        recovery: ['Copy the video caption into the text tab', ...common],
      };
    case 'instagram':
      return {
        note: 'Instagram requires a login for Reel content, so only public preview data can be read.',
        recovery: ['Copy the Reel caption into the text tab', ...common],
      };
    case 'youtube':
      return {
        note: 'YouTube exposes the title and description; captions are only available through its own APIs.',
        recovery: ['Copy the video description into the text tab', ...common],
      };
    case 'facebook':
      return { note: 'Facebook restricts video content to logged-in users.', recovery: common };
    default:
      return { note: 'This page did not contain enough recipe information.', recovery: common };
  }
}

const OEMBED_ENDPOINTS: Partial<Record<Platform, (url: string) => string>> = {
  tiktok: (url) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  youtube: (url) => `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
};

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  html?: string;
}

export async function extractFromUrl(rawUrl: string, options: FetchTextOptions = {}): Promise<SourceExtraction> {
  const url = canonicalizeUrl(parseHttpUrl(rawUrl));
  const platform = detectPlatform(url);
  const warnings: string[] = [];

  const result: SourceExtraction = {
    url: url.toString(),
    platform,
    title: null,
    description: null,
    imageUrl: null,
    captions: [],
    bodyText: null,
    metadata: { platform },
    structuredRecipe: null,
    warnings,
  };

  // 1. oEmbed — the only sanctioned metadata channel on most social platforms.
  const oembed = OEMBED_ENDPOINTS[platform];
  if (oembed) {
    try {
      const doc = await fetchText(oembed(url.toString()), { ...options, accept: 'application/json' });
      const data = JSON.parse(doc.body) as OEmbedResponse;
      if (data.title) {
        result.title = decodeEntities(data.title).trim();
        result.captions.push(result.title);
      }
      if (data.thumbnail_url) result.imageUrl = safeUrl(data.thumbnail_url);
      if (data.author_name) result.metadata.author = data.author_name;
    } catch (error) {
      warnings.push(`oEmbed metadata was not available (${platform}).`);
      void error;
    }
  }

  // 2. The page itself.
  try {
    const doc = await fetchText(url.toString(), options);
    if (doc.contentType.includes('json')) {
      result.bodyText = doc.body.slice(0, 8000);
    } else {
      const html = doc.body;
      result.title ??= metaContent(html, ['og:title', 'twitter:title']) ?? pageTitle(html);
      result.description =
        metaContent(html, ['og:description', 'twitter:description', 'description']) ?? result.description;
      const metaImage = metaContent(html, ['og:image', 'twitter:image']);
      result.imageUrl ??= safeResolve(metaImage, doc.url);
      const structured = findStructuredRecipe(jsonLdBlocks(html));
      if (structured) {
        result.structuredRecipe = structuredToDraft(structured, url.toString(), result.imageUrl);
      }
      const text = visibleText(html);
      result.bodyText = text.length > 0 ? text : null;
      if (doc.truncated) warnings.push('The page was very large and only the first part was read.');
    }
  } catch (error) {
    if (error instanceof ApiError) {
      // Social platforms routinely refuse bots; keep whatever oEmbed gave us.
      if (result.title || result.description) {
        warnings.push(`Only limited metadata was available: ${error.message}`);
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  if (platform !== 'web') {
    warnings.push(platformGuidance(platform).note);
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* schema.org/Recipe                                                          */
/* -------------------------------------------------------------------------- */

interface JsonLdRecipe {
  name?: unknown;
  description?: unknown;
  recipeYield?: unknown;
  prepTime?: unknown;
  cookTime?: unknown;
  totalTime?: unknown;
  recipeCategory?: unknown;
  recipeCuisine?: unknown;
  keywords?: unknown;
  image?: unknown;
  recipeIngredient?: unknown;
  ingredients?: unknown;
  recipeInstructions?: unknown;
}

function isRecipeNode(node: unknown): node is JsonLdRecipe {
  if (!node || typeof node !== 'object') return false;
  const type = (node as { '@type'?: unknown })['@type'];
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe');
}

export function findStructuredRecipe(blocks: unknown[]): JsonLdRecipe | null {
  const queue = [...blocks];
  while (queue.length) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (!node || typeof node !== 'object') continue;
    if (isRecipeNode(node)) return node;
    const graph = (node as { '@graph'?: unknown })['@graph'];
    if (Array.isArray(graph)) queue.push(...graph);
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return decodeEntities(value).replace(/\s+/g, ' ').trim() || null;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = asString(item);
      if (s) return s;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return asString(obj.text ?? obj.name ?? obj.url ?? null);
  }
  return null;
}

function asStringList(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.map(asString).filter((v): v is string => Boolean(v));
  const single = asString(value);
  return single ? [single] : [];
}

/** Resolve a possibly relative URL against the page it came from. */
function safeResolve(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return safeUrl(new URL(value, base).toString());
  } catch {
    return null;
  }
}

/** Keep only absolute http(s) URLs; anything else becomes null. */
function safeUrl(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString().slice(0, 2048) : null;
  } catch {
    return null;
  }
}

/** ISO-8601 duration ("PT1H30M") → minutes. */
export function isoDurationToMinutes(value: unknown): number | null {
  const text = asString(value);
  if (!text) return null;
  const match = text.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!match) return null;
  const [, d, h, m, s] = match;
  const minutes = (Number(d ?? 0) * 24 * 60) + (Number(h ?? 0) * 60) + Number(m ?? 0) + Math.round(Number(s ?? 0) / 60);
  return minutes > 0 ? minutes : null;
}

export function parseIngredientLine(line: string, position: number): Ingredient | null {
  const text = line.replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const match = text.match(/^([\d.,/¼½¾⅓⅔⅛⅜⅝⅞\s-]+)?\s*([a-zA-Z֐-׿.]+)?\s*(.*)$/u);
  let quantity: number | null = null;
  let unit: string | null = null;
  let name = text;
  let note: string | null = null;

  if (match) {
    const [, qtyRaw, unitRaw, rest] = match;
    const parsedQty = parseQuantity(qtyRaw ?? null);
    if (parsedQty.value != null) {
      quantity = parsedQty.value;
      const candidateUnit = normalizeUnitToken(unitRaw ?? null);
      const known = candidateUnit && candidateUnit !== (unitRaw ?? '').toLowerCase().replace(/\.$/, '');
      if (unitRaw && (known || isLikelyUnit(unitRaw))) {
        unit = candidateUnit;
        name = rest.trim();
      } else {
        name = `${unitRaw ?? ''} ${rest}`.trim();
      }
    }
  }

  const commaSplit = name.match(/^([^,]+),\s*(.+)$/);
  if (commaSplit) {
    name = commaSplit[1].trim();
    note = commaSplit[2].trim();
  }
  const parenSplit = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (parenSplit) {
    name = parenSplit[1].trim();
    note = note ? `${note}; ${parenSplit[2].trim()}` : parenSplit[2].trim();
  }
  // "salt to taste" → name "salt", note "to taste" (so it never gets scaled).
  const suffixSplit = name.match(/^(.+?)[,\s]+(to taste|as needed|for serving|for garnish|for frying|optional)\s*$/i);
  if (suffixSplit) {
    name = suffixSplit[1].trim();
    note = note ? `${note}; ${suffixSplit[2].toLowerCase()}` : suffixSplit[2].toLowerCase();
  }
  if (!name) name = text;

  const lowered = `${name} ${note ?? ''}`.toLowerCase();
  const optional = /\boptional\b/.test(lowered);
  const unquantified = /to taste|as needed|for serving|for garnish|for frying/.test(lowered);

  return {
    name: name.slice(0, 160),
    quantity,
    unit,
    note: note ? note.slice(0, 240) : null,
    optional,
    estimated: false,
    scalable: quantity != null && !unquantified,
    group: null,
    position,
  };
}

const UNIT_WORDS = new Set([
  'g', 'gr', 'gram', 'grams', 'kg', 'mg', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
  'ml', 'l', 'liter', 'litre', 'liters', 'litres', 'tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon',
  'tablespoons', 'cup', 'cups', 'pinch', 'clove', 'cloves', 'slice', 'slices', 'can', 'cans', 'package',
  'packages', 'bunch', 'sprig', 'sprigs', 'stick', 'sticks', 'piece', 'pieces', 'handful', 'head', 'stalk',
]);

function isLikelyUnit(word: string): boolean {
  return UNIT_WORDS.has(word.toLowerCase().replace(/\.$/, ''));
}

function instructionsToSteps(value: unknown): Step[] {
  const steps: Step[] = [];
  const push = (text: string | null) => {
    const instruction = text?.replace(/\s+/g, ' ').trim();
    if (!instruction) return;
    steps.push({
      position: steps.length,
      instruction: instruction.slice(0, 2000),
      durationSeconds: null,
      temperatureC: extractTemperature(instruction),
      estimated: false,
    });
  };

  const walk = (node: unknown): void => {
    if (!node) return;
    if (typeof node === 'string') {
      // Long single-string instructions are split on sentence-ish boundaries.
      const parts = node.split(/\r?\n+|(?<=\.)\s+(?=[A-Z֐-׿])/).map((p) => p.trim()).filter(Boolean);
      for (const part of parts) push(decodeEntities(part));
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (Array.isArray(obj.itemListElement)) {
        walk(obj.itemListElement);
        return;
      }
      push(asString(obj.text ?? obj.name ?? null));
    }
  };

  walk(value);
  return steps;
}

function extractTemperature(text: string): number | null {
  const celsius = text.match(/(\d{2,3})\s*°?\s*c\b/i);
  if (celsius) {
    const value = Number(celsius[1]);
    if (value >= 40 && value <= 350) return value;
  }
  const fahrenheit = text.match(/(\d{2,3})\s*°?\s*f\b/i);
  if (fahrenheit) {
    const value = Math.round(((Number(fahrenheit[1]) - 32) * 5) / 9);
    if (value >= 40 && value <= 350) return value;
  }
  return null;
}

function parseYield(value: unknown): number | null {
  const text = asString(value);
  if (!text) return null;
  const parsed = parseQuantity(text);
  if (parsed.value == null) return null;
  const rounded = Math.round(parsed.value);
  return rounded >= 1 && rounded <= 500 ? rounded : null;
}

/** Convert schema.org data into a draft. Missing fields stay missing. */
export function structuredToDraft(node: JsonLdRecipe, sourceUrl: string, fallbackImage: string | null): RecipeDraft | null {
  const rawIngredients = asStringList(node.recipeIngredient ?? node.ingredients);
  const ingredients = rawIngredients
    .map((line, index) => parseIngredientLine(line, index))
    .filter((i): i is Ingredient => i !== null);
  const steps = instructionsToSteps(node.recipeInstructions);
  if (ingredients.length === 0 || steps.length === 0) return null;

  const title = asString(node.name);
  if (!title) return null;

  const prepMinutes = isoDurationToMinutes(node.prepTime);
  const cookMinutes = isoDurationToMinutes(node.cookTime);
  const total = isoDurationToMinutes(node.totalTime);
  const servings = parseYield(node.recipeYield);

  const missingInfo: string[] = [];
  if (servings == null) missingInfo.push('servings');
  if (prepMinutes == null && cookMinutes == null && total == null) missingInfo.push('timing');

  const draft = {
    title,
    description: asString(node.description),
    servings,
    prepMinutes: prepMinutes ?? (total != null && cookMinutes != null ? Math.max(total - cookMinutes, 0) : null),
    cookMinutes: cookMinutes ?? (total != null && prepMinutes == null ? total : null),
    difficulty: null,
    cuisine: asString(node.recipeCuisine),
    imageUrl: safeUrl(node.image) ?? safeUrl(fallbackImage),
    sourceUrl,
    sourceType: 'url' as const,
    tags: [...asStringList(node.keywords), ...asStringList(node.recipeCategory)].slice(0, 20),
    equipment: [],
    notes: null,
    missingInfo,
    confidence: 1,
    ingredients,
    steps,
  };

  const validated = recipeDraftSchema.safeParse(draft);
  return validated.success ? validated.data : null;
}
