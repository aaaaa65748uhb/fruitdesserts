/**
 * Unit registry, quantity parsing/formatting and unit-aware arithmetic.
 *
 * Shared by the server (normalisation, shopping-list merging) and the web
 * client (display, scaling preview) so both sides always agree on the maths.
 */

export type Dimension = 'mass' | 'volume' | 'count' | 'discrete';

export interface UnitDef {
  /** Canonical token stored in the database. */
  canonical: string;
  dimension: Dimension;
  /** Multiplier to the dimension's base unit (g / ml / piece). */
  toBase: number;
  /** Lower-cased spellings that map onto this unit. */
  aliases: string[];
  /** Preferred singular/plural display forms. */
  display: { one: string; many: string };
}

/**
 * `discrete` units are countable things that cannot be converted into each
 * other (a clove is not a slice). They merge only with the identical unit.
 */
const UNIT_DEFS: UnitDef[] = [
  // ---- mass (base: g) ----
  { canonical: 'g', dimension: 'mass', toBase: 1, aliases: ['g', 'gr', 'gram', 'grams', 'gramme', 'grammes', 'גרם'], display: { one: 'g', many: 'g' } },
  { canonical: 'kg', dimension: 'mass', toBase: 1000, aliases: ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms', 'ק"ג'], display: { one: 'kg', many: 'kg' } },
  { canonical: 'mg', dimension: 'mass', toBase: 0.001, aliases: ['mg', 'milligram', 'milligrams'], display: { one: 'mg', many: 'mg' } },
  { canonical: 'oz', dimension: 'mass', toBase: 28.349523125, aliases: ['oz', 'ounce', 'ounces'], display: { one: 'oz', many: 'oz' } },
  { canonical: 'lb', dimension: 'mass', toBase: 453.59237, aliases: ['lb', 'lbs', 'pound', 'pounds'], display: { one: 'lb', many: 'lb' } },

  // ---- volume (base: ml) ----
  { canonical: 'ml', dimension: 'volume', toBase: 1, aliases: ['ml', 'milliliter', 'millilitre', 'milliliters', 'millilitres', 'cc', 'מ"ל'], display: { one: 'ml', many: 'ml' } },
  { canonical: 'l', dimension: 'volume', toBase: 1000, aliases: ['l', 'lt', 'liter', 'litre', 'liters', 'litres', 'ליטר'], display: { one: 'l', many: 'l' } },
  { canonical: 'tsp', dimension: 'volume', toBase: 4.92892159375, aliases: ['tsp', 'tsps', 'teaspoon', 'teaspoons', 't', 'כפית'], display: { one: 'tsp', many: 'tsp' } },
  { canonical: 'tbsp', dimension: 'volume', toBase: 14.78676478125, aliases: ['tbsp', 'tbsps', 'tablespoon', 'tablespoons', 'tbl', 'tbs', 'כף'], display: { one: 'tbsp', many: 'tbsp' } },
  { canonical: 'cup', dimension: 'volume', toBase: 236.5882365, aliases: ['cup', 'cups', 'כוס'], display: { one: 'cup', many: 'cups' } },
  { canonical: 'fl-oz', dimension: 'volume', toBase: 29.5735295625, aliases: ['fl oz', 'floz', 'fl-oz', 'fluid ounce', 'fluid ounces'], display: { one: 'fl oz', many: 'fl oz' } },
  { canonical: 'pint', dimension: 'volume', toBase: 473.176473, aliases: ['pint', 'pints', 'pt'], display: { one: 'pint', many: 'pints' } },
  { canonical: 'quart', dimension: 'volume', toBase: 946.352946, aliases: ['quart', 'quarts', 'qt'], display: { one: 'quart', many: 'quarts' } },
  { canonical: 'gallon', dimension: 'volume', toBase: 3785.411784, aliases: ['gallon', 'gallons', 'gal'], display: { one: 'gallon', many: 'gallons' } },

  // ---- count (base: piece) ----
  { canonical: 'piece', dimension: 'count', toBase: 1, aliases: ['piece', 'pieces', 'pc', 'pcs', 'unit', 'units', 'whole', 'יחידה', 'יחידות'], display: { one: 'piece', many: 'pieces' } },
  { canonical: 'dozen', dimension: 'count', toBase: 12, aliases: ['dozen', 'dozens'], display: { one: 'dozen', many: 'dozen' } },

  // ---- discrete (never converted between each other) ----
  { canonical: 'clove', dimension: 'discrete', toBase: 1, aliases: ['clove', 'cloves', 'שן'], display: { one: 'clove', many: 'cloves' } },
  { canonical: 'slice', dimension: 'discrete', toBase: 1, aliases: ['slice', 'slices', 'פרוסה'], display: { one: 'slice', many: 'slices' } },
  { canonical: 'pinch', dimension: 'discrete', toBase: 1, aliases: ['pinch', 'pinches', 'קמצוץ'], display: { one: 'pinch', many: 'pinches' } },
  { canonical: 'dash', dimension: 'discrete', toBase: 1, aliases: ['dash', 'dashes'], display: { one: 'dash', many: 'dashes' } },
  { canonical: 'can', dimension: 'discrete', toBase: 1, aliases: ['can', 'cans', 'tin', 'tins'], display: { one: 'can', many: 'cans' } },
  { canonical: 'package', dimension: 'discrete', toBase: 1, aliases: ['package', 'packages', 'pack', 'packs', 'pkg', 'חבילה'], display: { one: 'package', many: 'packages' } },
  { canonical: 'bunch', dimension: 'discrete', toBase: 1, aliases: ['bunch', 'bunches', 'צרור'], display: { one: 'bunch', many: 'bunches' } },
  { canonical: 'sprig', dimension: 'discrete', toBase: 1, aliases: ['sprig', 'sprigs'], display: { one: 'sprig', many: 'sprigs' } },
  { canonical: 'stick', dimension: 'discrete', toBase: 1, aliases: ['stick', 'sticks'], display: { one: 'stick', many: 'sticks' } },
  { canonical: 'handful', dimension: 'discrete', toBase: 1, aliases: ['handful', 'handfuls'], display: { one: 'handful', many: 'handfuls' } },
  { canonical: 'leaf', dimension: 'discrete', toBase: 1, aliases: ['leaf', 'leaves'], display: { one: 'leaf', many: 'leaves' } },
  { canonical: 'head', dimension: 'discrete', toBase: 1, aliases: ['head', 'heads'], display: { one: 'head', many: 'heads' } },
  { canonical: 'stalk', dimension: 'discrete', toBase: 1, aliases: ['stalk', 'stalks'], display: { one: 'stalk', many: 'stalks' } },
  { canonical: 'drop', dimension: 'discrete', toBase: 1, aliases: ['drop', 'drops'], display: { one: 'drop', many: 'drops' } },
];

const ALIAS_INDEX = new Map<string, UnitDef>();
for (const def of UNIT_DEFS) {
  ALIAS_INDEX.set(def.canonical, def);
  for (const alias of def.aliases) ALIAS_INDEX.set(alias, def);
}

export const KNOWN_UNITS: readonly string[] = UNIT_DEFS.map((u) => u.canonical);

/** Base unit for each dimension. */
const BASE_UNIT: Record<Dimension, string> = { mass: 'g', volume: 'ml', count: 'piece', discrete: '' };

export function normalizeUnitToken(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = String(raw).trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ');
  if (!cleaned) return null;
  const def = ALIAS_INDEX.get(cleaned);
  return def ? def.canonical : cleaned.slice(0, 24);
}

export function getUnitDef(unit: string | null | undefined): UnitDef | null {
  if (!unit) return null;
  return ALIAS_INDEX.get(unit.trim().toLowerCase()) ?? null;
}

export function unitDimension(unit: string | null | undefined): Dimension | null {
  const def = getUnitDef(unit);
  if (!def) return null;
  return def.dimension;
}

/**
 * A merge key identifying which quantities may be summed together.
 * Convertible dimensions share a key; unknown or discrete units keep their own.
 */
export function conversionGroup(unit: string | null | undefined): string {
  const def = getUnitDef(unit);
  if (!def) return unit ? `raw:${unit.toLowerCase()}` : 'none';
  if (def.dimension === 'discrete') return `discrete:${def.canonical}`;
  return `dim:${def.dimension}`;
}

export function canConvert(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) return true;
  return conversionGroup(a) === conversionGroup(b);
}

/** Convert a quantity between two units. Returns null when incompatible. */
export function convert(value: number, from: string | null | undefined, to: string | null | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  if (!from && !to) return value;
  if (!canConvert(from, to)) return null;
  const fromDef = getUnitDef(from);
  const toDef = getUnitDef(to);
  if (!fromDef || !toDef) return value; // identical raw unit strings
  return (value * fromDef.toBase) / toDef.toBase;
}

/** Convert to the dimension's base unit; returns the value untouched for others. */
export function toBaseUnit(value: number, unit: string | null | undefined): { value: number; unit: string | null } {
  const def = getUnitDef(unit);
  if (!def || def.dimension === 'discrete') return { value, unit: unit ?? null };
  const base = BASE_UNIT[def.dimension];
  return { value: value * def.toBase, unit: base };
}

const VULGAR_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6,
  '⅐': 1 / 7, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅑': 1 / 9, '⅒': 0.1,
};

export interface ParsedQuantity {
  value: number | null;
  /** True when the source expressed a range ("1-2 tbsp") — the mean is used. */
  range: boolean;
}

/**
 * Parse a human quantity string: "1 1/2", "1½", "0.5", "1,5", "2-3", "½".
 * Returns `{ value: null }` when nothing numeric is present ("to taste").
 */
export function parseQuantity(raw: string | number | null | undefined): ParsedQuantity {
  if (raw == null) return { value: null, range: false };
  if (typeof raw === 'number') return { value: Number.isFinite(raw) ? raw : null, range: false };

  let text = raw.trim().toLowerCase();
  if (!text) return { value: null, range: false };

  // Expand vulgar fractions ("1½" -> "1 1/2").
  for (const [glyph, val] of Object.entries(VULGAR_FRACTIONS)) {
    if (text.includes(glyph)) {
      const asFraction = decimalToFractionString(val);
      text = text.replace(new RegExp(glyph, 'g'), ` ${asFraction}`);
    }
  }
  // Decimal comma → dot, but only between digits ("1,5" not "1, 5 apples").
  text = text.replace(/(\d),(\d)/g, '$1.$2').trim();

  const rangeMatch = text.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)/);
  if (rangeMatch) {
    const lo = parseSimple(rangeMatch[1]);
    const hi = parseSimple(rangeMatch[2]);
    if (lo != null && hi != null) return { value: (lo + hi) / 2, range: true };
  }

  const value = parseSimple(text);
  return { value, range: false };
}

function parseSimple(text: string): number | null {
  const t = text.trim();
  // "1 1/2"
  const mixed = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) {
    const den = Number(mixed[3]);
    if (den === 0) return null;
    return Number(mixed[1]) + Number(mixed[2]) / den;
  }
  // "3/4"
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const den = Number(frac[2]);
    if (den === 0) return null;
    return Number(frac[1]) / den;
  }
  const dec = t.match(/^(\d+(?:\.\d+)?)/);
  if (dec) {
    const n = Number(dec[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const FRACTION_TABLE: Array<[number, string]> = [
  [1 / 8, '1/8'], [1 / 6, '1/6'], [1 / 4, '1/4'], [1 / 3, '1/3'], [3 / 8, '3/8'],
  [1 / 2, '1/2'], [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'], [5 / 6, '5/6'], [7 / 8, '7/8'],
];

function decimalToFractionString(value: number): string {
  let best = '1/2';
  let bestDelta = Infinity;
  for (const [v, label] of FRACTION_TABLE) {
    const d = Math.abs(v - value);
    if (d < bestDelta) { bestDelta = d; best = label; }
  }
  return best;
}

/**
 * Render a numeric quantity the way a cook would write it.
 * Small values become fractions; large ones are rounded sensibly.
 */
export function formatQuantity(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const abs = Math.abs(value);

  if (abs >= 100) return String(Math.round(value));
  if (abs >= 10) return trimZeros(value.toFixed(1));

  const whole = Math.floor(abs);
  const frac = abs - whole;
  if (frac > 0.01) {
    for (const [v, label] of FRACTION_TABLE) {
      if (Math.abs(frac - v) < 0.021) {
        const sign = value < 0 ? '-' : '';
        return whole > 0 ? `${sign}${whole} ${label}` : `${sign}${label}`;
      }
    }
  } else if (frac <= 0.01) {
    return String(Math.round(value));
  }
  return trimZeros(value.toFixed(abs < 1 ? 2 : 2));
}

function trimZeros(s: string): string {
  return s.replace(/\.?0+$/, '');
}

export function formatUnit(unit: string | null | undefined, quantity: number | null | undefined): string {
  if (!unit) return '';
  const def = getUnitDef(unit);
  if (!def) return unit;
  const q = quantity ?? 0;
  const plural = Math.abs(q - 1) > 1e-9;
  return plural ? def.display.many : def.display.one;
}

/**
 * Pick a friendlier unit for a value ("1200 g" → "1.2 kg", "0.5 kg" → "500 g").
 * Only ever rescales inside the same dimension, so the amount is unchanged.
 */
export function humanizeMeasure(value: number, unit: string | null): { value: number; unit: string | null } {
  const def = getUnitDef(unit);
  if (!def) return { value, unit };
  if (def.dimension === 'mass') {
    const grams = value * def.toBase;
    if (grams >= 1000) return { value: grams / 1000, unit: 'kg' };
    if (grams < 1 && grams > 0) return { value: grams * 1000, unit: 'mg' };
    if (def.canonical === 'kg' || def.canonical === 'mg') return { value: grams, unit: 'g' };
    return { value, unit };
  }
  if (def.dimension === 'volume') {
    if (def.canonical === 'ml' || def.canonical === 'l') {
      const ml = value * def.toBase;
      if (ml >= 1000) return { value: ml / 1000, unit: 'l' };
      return { value: ml, unit: 'ml' };
    }
    return { value, unit };
  }
  return { value, unit };
}

/** "2 1/2 cups" — a complete, human readable measurement. */
export function formatMeasure(value: number | null | undefined, unit: string | null | undefined): string {
  if (value == null) return '';
  const q = formatQuantity(value);
  const u = formatUnit(unit, value);
  return u ? `${q} ${u}` : q;
}
