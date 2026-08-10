import { describe, expect, it } from 'vitest';
import {
  canConvert,
  convert,
  formatMeasure,
  formatQuantity,
  mergeItems,
  normalizeName,
  normalizeUnitToken,
  parseQuantity,
  scaleIngredient,
  scaleRecipe,
  type Ingredient,
} from '../src/shared.js';

function ingredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    name: 'pasta',
    quantity: 200,
    unit: 'g',
    note: null,
    optional: false,
    estimated: false,
    scalable: true,
    group: null,
    position: 0,
    ...overrides,
  };
}

describe('quantity parsing', () => {
  it('parses decimals, fractions, mixed numbers and vulgar glyphs', () => {
    expect(parseQuantity('2').value).toBe(2);
    expect(parseQuantity('0.5').value).toBe(0.5);
    expect(parseQuantity('1,5').value).toBe(1.5);
    expect(parseQuantity('3/4').value).toBeCloseTo(0.75);
    expect(parseQuantity('1 1/2').value).toBeCloseTo(1.5);
    expect(parseQuantity('½').value).toBeCloseTo(0.5);
    expect(parseQuantity('1½').value).toBeCloseTo(1.5);
  });

  it('averages ranges and flags them', () => {
    const result = parseQuantity('2-3');
    expect(result.value).toBeCloseTo(2.5);
    expect(result.range).toBe(true);
  });

  it('returns null for unquantified text', () => {
    expect(parseQuantity('to taste').value).toBeNull();
    expect(parseQuantity('').value).toBeNull();
    expect(parseQuantity(null).value).toBeNull();
  });

  it('does not divide by zero', () => {
    expect(parseQuantity('1/0').value).toBeNull();
  });
});

describe('units', () => {
  it('normalises spellings to canonical tokens', () => {
    expect(normalizeUnitToken('Grams')).toBe('g');
    expect(normalizeUnitToken('tablespoons')).toBe('tbsp');
    expect(normalizeUnitToken('CLOVES')).toBe('clove');
    expect(normalizeUnitToken(null)).toBeNull();
  });

  it('converts inside a dimension and refuses across dimensions', () => {
    expect(convert(1, 'kg', 'g')).toBe(1000);
    expect(convert(2, 'tbsp', 'tsp')).toBeCloseTo(6, 5);
    expect(canConvert('g', 'ml')).toBe(false);
    expect(convert(1, 'cup', 'g')).toBeNull();
  });

  it('keeps discrete units apart', () => {
    expect(canConvert('clove', 'slice')).toBe(false);
    expect(canConvert('clove', 'clove')).toBe(true);
  });

  it('formats amounts the way a cook writes them', () => {
    expect(formatQuantity(0.5)).toBe('1/2');
    expect(formatQuantity(1.5)).toBe('1 1/2');
    expect(formatQuantity(2)).toBe('2');
    expect(formatMeasure(2, 'cup')).toBe('2 cups');
    expect(formatMeasure(1, 'cup')).toBe('1 cup');
  });
});

describe('scaling', () => {
  it('doubles quantities from 2 to 4 servings', () => {
    const result = scaleRecipe({ servings: 2, ingredients: [ingredient()] }, 4);
    expect(result.factor).toBe(2);
    expect(result.ingredients[0].scaledQuantity).toBe(400);
    expect(result.ingredients[0].displayText).toBe('400 g');
  });

  it('quarters quantities from 4 to 1 serving', () => {
    const result = scaleRecipe({ servings: 4, ingredients: [ingredient({ quantity: 400 })] }, 1);
    expect(result.factor).toBe(0.25);
    expect(result.ingredients[0].scaledQuantity).toBe(100);
  });

  it('round-trips 2 → 4 → 1 without drift', () => {
    const base = ingredient({ quantity: 200 });
    const doubled = scaleIngredient(base, 2).scaledQuantity!;
    const halvedFromBase = scaleIngredient(base, 0.5).scaledQuantity!;
    expect(doubled).toBe(400);
    expect(halvedFromBase).toBe(100);
  });

  it('never scales "to taste" or unquantified ingredients', () => {
    const salt = ingredient({ name: 'salt', quantity: null, unit: null, scalable: false });
    const scaled = scaleIngredient(salt, 4);
    expect(scaled.scaledQuantity).toBeNull();
    expect(scaled.displayText).toBe('');
    expect(scaled.wasScaled).toBe(false);
  });

  it('promotes large amounts to friendlier units', () => {
    const scaled = scaleIngredient(ingredient({ quantity: 500, unit: 'g' }), 3);
    expect(scaled.scaledQuantity).toBe(1500);
    expect(scaled.displayUnit).toBe('kg');
    expect(scaled.displayQuantity).toBe(1.5);
  });

  it('falls back to factor 1 when servings are unknown', () => {
    expect(scaleRecipe({ servings: null, ingredients: [ingredient()] }, 6).factor).toBe(1);
  });
});

describe('shopping list merging', () => {
  it('merges the same ingredient across compatible units', () => {
    const merged = mergeItems([
      { name: 'Flour', quantity: 200, unit: 'g' },
      { name: 'flour', quantity: 0.3, unit: 'kg' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(500);
    expect(merged[0].unit).toBe('g');
    expect(merged[0].mergedCount).toBe(2);
  });

  it('refuses to combine incompatible units', () => {
    const merged = mergeItems([
      { name: 'flour', quantity: 2, unit: 'cup' },
      { name: 'flour', quantity: 200, unit: 'g' },
    ]);
    expect(merged).toHaveLength(2);
  });

  it('keeps a real amount when an amount-less duplicate is added', () => {
    const merged = mergeItems([
      { name: 'salt', quantity: null, unit: null },
      { name: 'salt', quantity: null, unit: null },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBeNull();
  });

  it('matches singular and plural spellings', () => {
    expect(normalizeName('Tomatoes')).toBe(normalizeName('tomato'));
    expect(normalizeName('fresh Garlic cloves (peeled)')).toBe('garlic clove');
  });

  it('tracks contributing recipes', () => {
    const merged = mergeItems([
      { name: 'onion', quantity: 1, unit: 'piece', recipeId: 'a' },
      { name: 'onions', quantity: 2, unit: 'piece', recipeId: 'b' },
    ]);
    expect(merged[0].quantity).toBe(3);
    expect(merged[0].sources).toEqual(['a', 'b']);
  });
});
