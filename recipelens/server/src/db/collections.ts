import { randomUUID } from 'node:crypto';
import type { Db } from './index.js';
import { nowIso } from './index.js';

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  recipeCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  name_lower: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export class CollectionRepo {
  constructor(private readonly db: Db) {}

  list(userId: string): Collection[] {
    const rows = this.db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM collection_recipes cr WHERE cr.collection_id = c.id) AS recipe_count
         FROM collections c WHERE c.user_id = ? ORDER BY c.created_at DESC`,
      )
      .all(userId) as Array<CollectionRow & { recipe_count: number }>;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      recipeCount: r.recipe_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  findById(userId: string, id: string): Collection | null {
    const row = this.db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM collection_recipes cr WHERE cr.collection_id = c.id) AS recipe_count
         FROM collections c WHERE c.id = ? AND c.user_id = ?`,
      )
      .get(id, userId) as (CollectionRow & { recipe_count: number }) | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      recipeCount: row.recipe_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  findByName(userId: string, name: string): Collection | null {
    const row = this.db
      .prepare('SELECT id FROM collections WHERE user_id = ? AND name_lower = ?')
      .get(userId, name.trim().toLowerCase()) as { id: string } | undefined;
    return row ? this.findById(userId, row.id) : null;
  }

  create(userId: string, name: string, description: string | null): Collection {
    const now = nowIso();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO collections (id, user_id, name, name_lower, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, userId, name.trim(), name.trim().toLowerCase(), description, now, now);
    return this.findById(userId, id)!;
  }

  update(userId: string, id: string, name: string, description: string | null): Collection | null {
    const result = this.db
      .prepare('UPDATE collections SET name = ?, name_lower = ?, description = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(name.trim(), name.trim().toLowerCase(), description, nowIso(), id, userId);
    if (result.changes === 0) return null;
    return this.findById(userId, id);
  }

  delete(userId: string, id: string): boolean {
    return this.db.prepare('DELETE FROM collections WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  }

  addRecipe(collectionId: string, recipeId: string): void {
    this.db
      .prepare('INSERT OR IGNORE INTO collection_recipes (collection_id, recipe_id, added_at) VALUES (?, ?, ?)')
      .run(collectionId, recipeId, nowIso());
  }

  removeRecipe(collectionId: string, recipeId: string): boolean {
    return (
      this.db.prepare('DELETE FROM collection_recipes WHERE collection_id = ? AND recipe_id = ?').run(collectionId, recipeId)
        .changes > 0
    );
  }

  collectionsForRecipe(userId: string, recipeId: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT cr.collection_id AS id FROM collection_recipes cr
         JOIN collections c ON c.id = cr.collection_id
         WHERE cr.recipe_id = ? AND c.user_id = ?`,
      )
      .all(recipeId, userId) as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }
}
