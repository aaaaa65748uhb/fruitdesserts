import { randomUUID } from 'node:crypto';
import type { Db } from './index.js';
import { nowIso } from './index.js';
import { combineMeasures, conversionGroup, formatMeasure, mergeKey } from '../shared.js';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  checked: boolean;
  recipeId: string | null;
  displayText: string;
  createdAt: string;
  updatedAt: string;
}

interface ShoppingRow {
  id: string;
  user_id: string;
  name: string;
  merge_key: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  checked: number;
  recipe_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewShoppingItem {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
  recipeId?: string | null;
}

function toItem(row: ShoppingRow): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    note: row.note,
    checked: Boolean(row.checked),
    recipeId: row.recipe_id,
    displayText: formatMeasure(row.quantity, row.unit),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ShoppingRepo {
  constructor(private readonly db: Db) {}

  list(userId: string): ShoppingItem[] {
    const rows = this.db
      .prepare('SELECT * FROM shopping_list_items WHERE user_id = ? ORDER BY checked ASC, created_at ASC')
      .all(userId) as ShoppingRow[];
    return rows.map(toItem);
  }

  findById(userId: string, id: string): ShoppingItem | null {
    const row = this.db.prepare('SELECT * FROM shopping_list_items WHERE id = ? AND user_id = ?').get(id, userId) as
      | ShoppingRow
      | undefined;
    return row ? toItem(row) : null;
  }

  /**
   * Adds items, folding each into an existing *unchecked* line when the name
   * matches and the units are convertible. Incompatible units stay separate.
   */
  addMany(userId: string, items: NewShoppingItem[]): { added: ShoppingItem[]; merged: ShoppingItem[] } {
    const added: ShoppingItem[] = [];
    const merged: ShoppingItem[] = [];

    const run = this.db.transaction(() => {
      for (const item of items) {
        const name = item.name.trim();
        if (!name) continue;
        const unit = item.unit ?? null;
        const key = mergeKey({ name, unit });
        const existing = this.db
          .prepare('SELECT * FROM shopping_list_items WHERE user_id = ? AND merge_key = ? AND checked = 0 LIMIT 1')
          .get(userId, key) as ShoppingRow | undefined;

        if (existing) {
          const combined = combineMeasures(
            { quantity: existing.quantity, unit: existing.unit },
            { quantity: item.quantity ?? null, unit },
          );
          this.db
            .prepare('UPDATE shopping_list_items SET quantity = ?, unit = ?, updated_at = ? WHERE id = ?')
            .run(combined.quantity, combined.unit, nowIso(), existing.id);
          const updated = this.findById(userId, existing.id)!;
          merged.push(updated);
          continue;
        }

        const now = nowIso();
        const id = randomUUID();
        this.db
          .prepare(
            `INSERT INTO shopping_list_items (id, user_id, name, merge_key, quantity, unit, note, checked, recipe_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          )
          .run(id, userId, name, key, item.quantity ?? null, unit, item.note ?? null, item.recipeId ?? null, now, now);
        added.push(this.findById(userId, id)!);
      }
    });
    run();
    return { added, merged };
  }

  update(
    userId: string,
    id: string,
    patch: { name?: string; quantity?: number | null; unit?: string | null; note?: string | null; checked?: boolean },
  ): ShoppingItem | null {
    const current = this.db.prepare('SELECT * FROM shopping_list_items WHERE id = ? AND user_id = ?').get(id, userId) as
      | ShoppingRow
      | undefined;
    if (!current) return null;

    const name = patch.name?.trim() || current.name;
    const unit = patch.unit === undefined ? current.unit : patch.unit;
    const quantity = patch.quantity === undefined ? current.quantity : patch.quantity;
    const note = patch.note === undefined ? current.note : patch.note;
    const checked = patch.checked === undefined ? Boolean(current.checked) : patch.checked;

    this.db
      .prepare(
        `UPDATE shopping_list_items
         SET name = ?, merge_key = ?, quantity = ?, unit = ?, note = ?, checked = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(name, mergeKey({ name, unit }), quantity, unit, note, checked ? 1 : 0, nowIso(), id, userId);
    return this.findById(userId, id);
  }

  delete(userId: string, id: string): boolean {
    return this.db.prepare('DELETE FROM shopping_list_items WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  }

  clear(userId: string, onlyChecked: boolean): number {
    const sql = onlyChecked
      ? 'DELETE FROM shopping_list_items WHERE user_id = ? AND checked = 1'
      : 'DELETE FROM shopping_list_items WHERE user_id = ?';
    return this.db.prepare(sql).run(userId).changes;
  }

  /** Exposed for diagnostics/tests: which merge bucket a line falls into. */
  static bucketFor(name: string, unit: string | null): { key: string; group: string } {
    return { key: mergeKey({ name, unit }), group: conversionGroup(unit) };
  }
}
