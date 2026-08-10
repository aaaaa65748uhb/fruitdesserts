import { randomUUID } from 'node:crypto';
import type { Db } from './index.js';
import { nowIso } from './index.js';

export interface CookingSession {
  id: string;
  recipeId: string;
  currentStep: number;
  completedSteps: number[];
  servings: number | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface CookingRow {
  id: string;
  user_id: string;
  recipe_id: string;
  current_step: number;
  completed_steps_json: string;
  servings: number | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

function toSession(row: CookingRow): CookingSession {
  let completedSteps: number[] = [];
  try {
    const parsed: unknown = JSON.parse(row.completed_steps_json);
    if (Array.isArray(parsed)) completedSteps = parsed.filter((n): n is number => typeof n === 'number');
  } catch {
    completedSteps = [];
  }
  return {
    id: row.id,
    recipeId: row.recipe_id,
    currentStep: row.current_step,
    completedSteps,
    servings: row.servings,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export class CookingRepo {
  constructor(private readonly db: Db) {}

  get(userId: string, recipeId: string): CookingSession | null {
    const row = this.db.prepare('SELECT * FROM cooking_sessions WHERE user_id = ? AND recipe_id = ?').get(userId, recipeId) as
      | CookingRow
      | undefined;
    return row ? toSession(row) : null;
  }

  listActive(userId: string, limit = 10): CookingSession[] {
    const rows = this.db
      .prepare('SELECT * FROM cooking_sessions WHERE user_id = ? AND completed_at IS NULL ORDER BY updated_at DESC LIMIT ?')
      .all(userId, limit) as CookingRow[];
    return rows.map(toSession);
  }

  /** Creates or updates the single session a user has per recipe. */
  save(
    userId: string,
    recipeId: string,
    patch: { currentStep?: number; completedSteps?: number[]; servings?: number | null; completed?: boolean },
  ): CookingSession {
    const now = nowIso();
    const existing = this.db.prepare('SELECT * FROM cooking_sessions WHERE user_id = ? AND recipe_id = ?').get(userId, recipeId) as
      | CookingRow
      | undefined;

    const currentStep = patch.currentStep ?? existing?.current_step ?? 0;
    const completedSteps = patch.completedSteps ?? (existing ? toSession(existing).completedSteps : []);
    const servings = patch.servings === undefined ? (existing?.servings ?? null) : patch.servings;
    const completedAt = patch.completed === undefined ? (existing?.completed_at ?? null) : patch.completed ? now : null;

    if (existing) {
      this.db
        .prepare(
          `UPDATE cooking_sessions SET current_step = ?, completed_steps_json = ?, servings = ?, updated_at = ?, completed_at = ?
           WHERE id = ?`,
        )
        .run(currentStep, JSON.stringify([...new Set(completedSteps)].sort((a, b) => a - b)), servings, now, completedAt, existing.id);
      return this.get(userId, recipeId)!;
    }

    this.db
      .prepare(
        `INSERT INTO cooking_sessions (id, user_id, recipe_id, current_step, completed_steps_json, servings, started_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        userId,
        recipeId,
        currentStep,
        JSON.stringify([...new Set(completedSteps)].sort((a, b) => a - b)),
        servings,
        now,
        now,
        completedAt,
      );
    return this.get(userId, recipeId)!;
  }

  reset(userId: string, recipeId: string): boolean {
    return this.db.prepare('DELETE FROM cooking_sessions WHERE user_id = ? AND recipe_id = ?').run(userId, recipeId).changes > 0;
  }
}
