import { randomUUID } from 'node:crypto';
import type { Db } from './index.js';
import { nowIso } from './index.js';

export type AnalysisStatus = 'success' | 'failed';

export interface AnalysisRecord {
  id: string;
  userId: string;
  recipeId: string | null;
  sourceType: string;
  sourceRef: string | null;
  sourceHash: string;
  provider: string;
  model: string;
  status: AnalysisStatus;
  errorCode: string | null;
  attempts: number;
  durationMs: number;
  createdAt: string;
}

interface AnalysisRow {
  id: string;
  user_id: string;
  recipe_id: string | null;
  source_type: string;
  source_ref: string | null;
  source_hash: string;
  provider: string;
  model: string;
  status: string;
  error_code: string | null;
  attempts: number;
  duration_ms: number;
  result_json: string | null;
  created_at: string;
}

function toRecord(row: AnalysisRow): AnalysisRecord {
  return {
    id: row.id,
    userId: row.user_id,
    recipeId: row.recipe_id,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    sourceHash: row.source_hash,
    provider: row.provider,
    model: row.model,
    status: row.status as AnalysisStatus,
    errorCode: row.error_code,
    attempts: row.attempts,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

export class AnalysisRepo {
  constructor(private readonly db: Db) {}

  record(input: {
    userId: string;
    recipeId: string | null;
    sourceType: string;
    sourceRef: string | null;
    sourceHash: string;
    provider: string;
    model: string;
    status: AnalysisStatus;
    errorCode?: string | null;
    attempts: number;
    durationMs: number;
    resultJson?: string | null;
  }): AnalysisRecord {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO ai_analyses (id, user_id, recipe_id, source_type, source_ref, source_hash, provider, model,
                                  status, error_code, attempts, duration_ms, result_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.userId,
        input.recipeId,
        input.sourceType,
        input.sourceRef,
        input.sourceHash,
        input.provider,
        input.model,
        input.status,
        input.errorCode ?? null,
        input.attempts,
        input.durationMs,
        input.resultJson ?? null,
        nowIso(),
      );
    return this.findById(input.userId, id)!;
  }

  findById(userId: string, id: string): AnalysisRecord | null {
    const row = this.db.prepare('SELECT * FROM ai_analyses WHERE id = ? AND user_id = ?').get(id, userId) as AnalysisRow | undefined;
    return row ? toRecord(row) : null;
  }

  /** Most recent successful analysis of the identical source for this user. */
  findRecentSuccess(userId: string, sourceHash: string, maxAgeMs: number): { record: AnalysisRecord; resultJson: string } | null {
    const row = this.db
      .prepare(
        `SELECT * FROM ai_analyses
         WHERE user_id = ? AND source_hash = ? AND status = 'success' AND result_json IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(userId, sourceHash) as AnalysisRow | undefined;
    if (!row || !row.result_json) return null;
    if (Date.now() - Date.parse(row.created_at) > maxAgeMs) return null;
    return { record: toRecord(row), resultJson: row.result_json };
  }

  listForUser(userId: string, limit = 20): AnalysisRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM ai_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, limit) as AnalysisRow[];
    return rows.map(toRecord);
  }

  attachRecipe(analysisId: string, recipeId: string): void {
    this.db.prepare('UPDATE ai_analyses SET recipe_id = ? WHERE id = ?').run(recipeId, analysisId);
  }
}
