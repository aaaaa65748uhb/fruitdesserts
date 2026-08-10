import type { Recipe } from '../lib/api.js';

export function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    userId: 'u1',
    title: 'Creamy Garlic Pasta',
    description: 'Quick weeknight pasta.',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 15,
    difficulty: 'easy',
    cuisine: 'Italian',
    imageUrl: null,
    sourceUrl: null,
    sourceType: 'text',
    tags: ['pasta'],
    equipment: [],
    notes: null,
    missingInfo: [],
    confidence: 0.8,
    isFavorite: false,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ingredients: [
      { id: 'i1', name: 'spaghetti', quantity: 200, unit: 'g', note: null, optional: false, estimated: false, scalable: true, group: null, position: 0 },
      { id: 'i2', name: 'heavy cream', quantity: 150, unit: 'ml', note: null, optional: false, estimated: true, scalable: true, group: null, position: 1 },
      { id: 'i3', name: 'salt', quantity: null, unit: null, note: 'to taste', optional: false, estimated: false, scalable: false, group: null, position: 2 },
    ],
    steps: [
      { id: 's1', position: 0, instruction: 'Boil the pasta.', durationSeconds: 480, temperatureC: null, estimated: false },
      { id: 's2', position: 1, instruction: 'Fry the garlic.', durationSeconds: null, temperatureC: null, estimated: false },
      { id: 's3', position: 2, instruction: 'Toss everything together.', durationSeconds: null, temperatureC: null, estimated: false },
    ],
    ...overrides,
  };
}
