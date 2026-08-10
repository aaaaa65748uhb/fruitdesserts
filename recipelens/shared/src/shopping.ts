/**
 * Shopping-list merging.
 *
 * Two lines merge only when they name the same ingredient AND their units are
 * convertible ("200 g" + "0.3 kg" → "500 g"). Incompatible pairs
 * ("2 cups flour" + "200 g flour") are intentionally kept apart rather than
 * silently — and wrongly — added together.
 */
import { conversionGroup, convert, formatMeasure, getUnitDef, humanizeMeasure } from './units.js';
import { roundSensibly } from './scale.js';

export interface Measure {
  quantity: number | null;
  unit: string | null;
}

/**
 * Add two compatible measurements, keeping the unit the list already uses:
 * "4 tbsp" + "2 tbsp" stays "6 tbsp" instead of collapsing to millilitres.
 * Returns the original measure untouched when the units cannot be converted.
 */
export function combineMeasures(base: Measure, addition: Measure): Measure {
  if (addition.quantity == null) return base;
  if (base.quantity == null) return { quantity: addition.quantity, unit: addition.unit };

  const converted = convert(addition.quantity, addition.unit, base.unit);
  if (converted == null) return base;

  const human = humanizeMeasure(base.quantity + converted, base.unit);
  return { quantity: roundSensibly(human.value), unit: human.unit };
}

export interface MergeableItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  optional?: boolean;
  recipeId?: string | null;
}

export interface MergedItem extends MergeableItem {
  /** Ids of the recipes that contributed to this line. */
  sources: string[];
  /** How many input lines were folded into this one. */
  mergedCount: number;
  displayText: string;
}

/**
 * Matching key for an ingredient name. Purely internal — the displayed name is
 * always the first spelling we saw, so lossy stemming is safe here.
 */
export function normalizeName(name: string): string {
  let n = name.toLowerCase().trim();
  n = n.replace(/\([^)]*\)/g, ' ');            // drop parentheticals
  n = n.replace(/[^\p{L}\p{N}\s-]/gu, ' ');    // punctuation
  n = n.replace(/\s+/g, ' ').trim();
  n = n.replace(/^(fresh|freshly|large|small|medium|whole|raw|ripe|organic)\s+/u, '');
  const words = n.split(' ').map(singularize);
  return words.join(' ').trim();
}

/** -f/-fe plurals that would otherwise be mangled by the generic rule. */
const IRREGULAR_PLURALS: Record<string, string> = {
  leaves: 'leaf', knives: 'knife', halves: 'half', loaves: 'loaf', wolves: 'wolf', shelves: 'shelf',
};

function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word in IRREGULAR_PLURALS) return IRREGULAR_PLURALS[word];
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  // "cloves" → "clove", "olives" → "olive" (the common case in a kitchen).
  if (word.endsWith('ves')) return word.slice(0, -1);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

export function mergeKey(item: Pick<MergeableItem, 'name' | 'unit'>): string {
  return `${normalizeName(item.name)}|${conversionGroup(item.unit)}`;
}

export function mergeItems(items: MergeableItem[]): MergedItem[] {
  const buckets = new Map<string, MergedItem>();

  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    const key = mergeKey({ name, unit: item.unit });
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, {
        name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        optional: item.optional ?? false,
        sources: item.recipeId ? [item.recipeId] : [],
        mergedCount: 1,
        displayText: formatMeasure(item.quantity ?? null, item.unit ?? null),
      });
      continue;
    }

    existing.mergedCount += 1;
    if (item.recipeId && !existing.sources.includes(item.recipeId)) existing.sources.push(item.recipeId);
    // An amount-less line ("salt, to taste") must not zero out a real amount.
    if (item.quantity == null) {
      existing.optional = existing.optional && (item.optional ?? false);
      continue;
    }
    const combined = combineMeasures(
      { quantity: existing.quantity, unit: existing.unit },
      { quantity: item.quantity, unit: item.unit ?? null },
    );
    existing.quantity = combined.quantity;
    existing.unit = combined.unit;
    existing.optional = existing.optional && (item.optional ?? false);
    existing.displayText = formatMeasure(existing.quantity, existing.unit);
  }

  for (const item of buckets.values()) {
    item.displayText = formatMeasure(item.quantity, item.unit);
  }

  return [...buckets.values()];
}

/** True when the two lines would be folded together by `mergeItems`. */
export function isMergeable(a: Pick<MergeableItem, 'name' | 'unit'>, b: Pick<MergeableItem, 'name' | 'unit'>): boolean {
  return mergeKey(a) === mergeKey(b);
}

export function unitLabel(unit: string | null): string {
  const def = getUnitDef(unit);
  return def ? def.display.many : (unit ?? '');
}
