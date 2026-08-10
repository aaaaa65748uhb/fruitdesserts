import { randomUUID } from 'node:crypto';
import type { Db } from './index.js';
import { nowIso } from './index.js';
import type { Difficulty, Ingredient, Recipe, RecipeDraft, SourceType, Step } from '../shared.js';

interface RecipeRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  difficulty: string | null;
  cuisine: string | null;
  image_url: string | null;
  source_url: string | null;
  source_type: string;
  notes: string | null;
  tags_json: string;
  equipment_json: string;
  missing_json: string;
  confidence: number | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface IngredientRow {
  id: string;
  recipe_id: string;
  position: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  optional: number;
  estimated: number;
  scalable: number;
  group_name: string | null;
}

interface StepRow {
  id: string;
  recipe_id: string;
  position: number;
  instruction: string;
  duration_seconds: number | null;
  temperature_c: number | null;
  estimated: number;
}

export interface StoredRecipe extends Recipe {
  version: number;
}

export interface RecipeListItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  difficulty: Difficulty | null;
  cuisine: string | null;
  tags: string[];
  sourceType: SourceType;
  sourceUrl: string | null;
  isFavorite: boolean;
  ingredientCount: number;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export interface ListOptions {
  search?: string;
  favoritesOnly?: boolean;
  collectionId?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export class RecipeRepo {
  constructor(private readonly db: Db) {}

  /** Ownership is enforced in SQL — never by the caller alone. */
  findById(userId: string, id: string): StoredRecipe | null {
    const row = this.db.prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?').get(id, userId) as RecipeRow | undefined;
    if (!row) return null;
    return this.hydrate(row, userId);
  }

  /** Used to distinguish 404 (no such recipe) from 403 (someone else's). */
  existsAnywhere(id: string): boolean {
    const row = this.db.prepare('SELECT 1 AS ok FROM recipes WHERE id = ?').get(id) as { ok: number } | undefined;
    return Boolean(row);
  }

  private hydrate(row: RecipeRow, userId: string): StoredRecipe {
    const ingredientRows = this.db
      .prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY position ASC')
      .all(row.id) as IngredientRow[];
    const stepRows = this.db.prepare('SELECT * FROM steps WHERE recipe_id = ? ORDER BY position ASC').all(row.id) as StepRow[];
    const fav = this.db.prepare('SELECT 1 AS ok FROM favorites WHERE user_id = ? AND recipe_id = ?').get(userId, row.id) as
      | { ok: number }
      | undefined;

    const ingredients: Ingredient[] = ingredientRows.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      note: i.note,
      optional: Boolean(i.optional),
      estimated: Boolean(i.estimated),
      scalable: Boolean(i.scalable),
      group: i.group_name,
      position: i.position,
    }));

    const steps: Step[] = stepRows.map((s) => ({
      id: s.id,
      position: s.position,
      instruction: s.instruction,
      durationSeconds: s.duration_seconds,
      temperatureC: s.temperature_c,
      estimated: Boolean(s.estimated),
    }));

    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      servings: row.servings,
      prepMinutes: row.prep_minutes,
      cookMinutes: row.cook_minutes,
      difficulty: (row.difficulty as Difficulty | null) ?? null,
      cuisine: row.cuisine,
      imageUrl: row.image_url,
      sourceUrl: row.source_url,
      sourceType: row.source_type as SourceType,
      tags: parseJsonArray(row.tags_json),
      equipment: parseJsonArray(row.equipment_json),
      missingInfo: parseJsonArray(row.missing_json),
      notes: row.notes,
      confidence: row.confidence,
      ingredients,
      steps,
      isFavorite: Boolean(fav),
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create(userId: string, draft: RecipeDraft): StoredRecipe {
    const id = randomUUID();
    const now = nowIso();
    const insert = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO recipes (id, user_id, title, description, servings, prep_minutes, cook_minutes, difficulty, cuisine,
                                image_url, source_url, source_type, notes, tags_json, equipment_json, missing_json,
                                confidence, version, created_at, updated_at)
           VALUES (@id, @user_id, @title, @description, @servings, @prep_minutes, @cook_minutes, @difficulty, @cuisine,
                   @image_url, @source_url, @source_type, @notes, @tags_json, @equipment_json, @missing_json,
                   @confidence, 1, @created_at, @updated_at)`,
        )
        .run({
          id,
          user_id: userId,
          title: draft.title,
          description: draft.description,
          servings: draft.servings,
          prep_minutes: draft.prepMinutes,
          cook_minutes: draft.cookMinutes,
          difficulty: draft.difficulty,
          cuisine: draft.cuisine,
          image_url: draft.imageUrl,
          source_url: draft.sourceUrl,
          source_type: draft.sourceType,
          notes: draft.notes,
          tags_json: JSON.stringify(draft.tags),
          equipment_json: JSON.stringify(draft.equipment),
          missing_json: JSON.stringify(draft.missingInfo),
          confidence: draft.confidence,
          created_at: now,
          updated_at: now,
        });
      this.replaceChildren(id, draft);
    });
    insert();
    return this.findById(userId, id)!;
  }

  private replaceChildren(recipeId: string, draft: Pick<RecipeDraft, 'ingredients' | 'steps'>): void {
    this.db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(recipeId);
    this.db.prepare('DELETE FROM steps WHERE recipe_id = ?').run(recipeId);

    const insertIngredient = this.db.prepare(
      `INSERT INTO ingredients (id, recipe_id, position, name, quantity, unit, note, optional, estimated, scalable, group_name)
       VALUES (@id, @recipe_id, @position, @name, @quantity, @unit, @note, @optional, @estimated, @scalable, @group_name)`,
    );
    draft.ingredients.forEach((ingredient, index) => {
      insertIngredient.run({
        id: randomUUID(),
        recipe_id: recipeId,
        position: index,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        note: ingredient.note,
        optional: ingredient.optional ? 1 : 0,
        estimated: ingredient.estimated ? 1 : 0,
        scalable: ingredient.scalable ? 1 : 0,
        group_name: ingredient.group,
      });
    });

    const insertStep = this.db.prepare(
      `INSERT INTO steps (id, recipe_id, position, instruction, duration_seconds, temperature_c, estimated)
       VALUES (@id, @recipe_id, @position, @instruction, @duration_seconds, @temperature_c, @estimated)`,
    );
    draft.steps.forEach((step, index) => {
      insertStep.run({
        id: randomUUID(),
        recipe_id: recipeId,
        position: index,
        instruction: step.instruction,
        duration_seconds: step.durationSeconds,
        temperature_c: step.temperatureC,
        estimated: step.estimated ? 1 : 0,
      });
    });
  }

  /**
   * Optimistic concurrency: when `expectedVersion` is given and no longer
   * matches, nothing is written and `null` is returned so the route can answer
   * with 409 instead of silently clobbering a concurrent edit.
   */
  update(userId: string, id: string, draft: RecipeDraft, expectedVersion?: number): StoredRecipe | null {
    const now = nowIso();
    let updated = false;
    const run = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `UPDATE recipes SET title = @title, description = @description, servings = @servings, prep_minutes = @prep_minutes,
                 cook_minutes = @cook_minutes, difficulty = @difficulty, cuisine = @cuisine, image_url = @image_url,
                 source_url = @source_url, source_type = @source_type, notes = @notes, tags_json = @tags_json,
                 equipment_json = @equipment_json, missing_json = @missing_json, confidence = @confidence,
                 version = version + 1, updated_at = @updated_at
           WHERE id = @id AND user_id = @user_id
             AND (@expected_version IS NULL OR version = @expected_version)`,
        )
        .run({
          id,
          user_id: userId,
          title: draft.title,
          description: draft.description,
          servings: draft.servings,
          prep_minutes: draft.prepMinutes,
          cook_minutes: draft.cookMinutes,
          difficulty: draft.difficulty,
          cuisine: draft.cuisine,
          image_url: draft.imageUrl,
          source_url: draft.sourceUrl,
          source_type: draft.sourceType,
          notes: draft.notes,
          tags_json: JSON.stringify(draft.tags),
          equipment_json: JSON.stringify(draft.equipment),
          missing_json: JSON.stringify(draft.missingInfo),
          confidence: draft.confidence,
          updated_at: now,
          expected_version: expectedVersion ?? null,
        });
      if (result.changes === 0) return;
      this.replaceChildren(id, draft);
      updated = true;
    });
    run();
    if (!updated) return null;
    return this.findById(userId, id);
  }

  delete(userId: string, id: string): boolean {
    const result = this.db.prepare('DELETE FROM recipes WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  }

  list(userId: string, options: ListOptions = {}): { items: RecipeListItem[]; total: number } {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);

    const where: string[] = ['r.user_id = @user_id'];
    const params: Record<string, unknown> = { user_id: userId, limit, offset };

    if (options.search?.trim()) {
      where.push(`(r.title LIKE @search OR IFNULL(r.description, '') LIKE @search OR EXISTS (
        SELECT 1 FROM ingredients i WHERE i.recipe_id = r.id AND i.name LIKE @search))`);
      params.search = `%${options.search.trim()}%`;
    }
    if (options.favoritesOnly) {
      where.push('EXISTS (SELECT 1 FROM favorites f WHERE f.recipe_id = r.id AND f.user_id = @user_id)');
    }
    if (options.collectionId) {
      where.push('EXISTS (SELECT 1 FROM collection_recipes cr WHERE cr.recipe_id = r.id AND cr.collection_id = @collection_id)');
      params.collection_id = options.collectionId;
    }
    if (options.tag?.trim()) {
      where.push('r.tags_json LIKE @tag');
      params.tag = `%"${options.tag.trim()}"%`;
    }

    const whereSql = where.join(' AND ');
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM recipes r WHERE ${whereSql}`).get(params) as { n: number }
    ).n;

    const rows = this.db
      .prepare(
        `SELECT r.*,
                (SELECT COUNT(*) FROM ingredients i WHERE i.recipe_id = r.id) AS ingredient_count,
                (SELECT COUNT(*) FROM steps s WHERE s.recipe_id = r.id) AS step_count,
                EXISTS (SELECT 1 FROM favorites f WHERE f.recipe_id = r.id AND f.user_id = @user_id) AS is_favorite
         FROM recipes r
         WHERE ${whereSql}
         ORDER BY r.created_at DESC
         LIMIT @limit OFFSET @offset`,
      )
      .all(params) as Array<RecipeRow & { ingredient_count: number; step_count: number; is_favorite: number }>;

    const items: RecipeListItem[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url,
      servings: row.servings,
      prepMinutes: row.prep_minutes,
      cookMinutes: row.cook_minutes,
      difficulty: (row.difficulty as Difficulty | null) ?? null,
      cuisine: row.cuisine,
      tags: parseJsonArray(row.tags_json),
      sourceType: row.source_type as SourceType,
      sourceUrl: row.source_url,
      isFavorite: Boolean(row.is_favorite),
      ingredientCount: row.ingredient_count,
      stepCount: row.step_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { items, total };
  }

  setFavorite(userId: string, recipeId: string, favorite: boolean): boolean {
    if (favorite) {
      this.db
        .prepare('INSERT OR IGNORE INTO favorites (user_id, recipe_id, created_at) VALUES (?, ?, ?)')
        .run(userId, recipeId, nowIso());
      return true;
    }
    this.db.prepare('DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?').run(userId, recipeId);
    return false;
  }

  countForUser(userId: string): { recipes: number; favorites: number } {
    const recipes = (this.db.prepare('SELECT COUNT(*) AS n FROM recipes WHERE user_id = ?').get(userId) as { n: number }).n;
    const favorites = (this.db.prepare('SELECT COUNT(*) AS n FROM favorites WHERE user_id = ?').get(userId) as { n: number }).n;
    return { recipes, favorites };
  }
}
