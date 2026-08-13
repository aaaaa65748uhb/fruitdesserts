/**
 * Live progress for long imports.
 *
 * The client generates a request id, sends it as `x-request-id`, and polls
 * /api/import/progress/:id while the analysis runs. Phases are recorded by the
 * import route as they actually happen — nothing here is on a timer, so the UI
 * never shows a stage the server has not reached.
 */
export type ImportPhase =
  | 'received'
  | 'reading-source'
  | 'extracting-text'
  | 'analysing'
  | 'validating'
  | 'saving'
  | 'done'
  | 'failed';

export const PHASE_LABELS: Record<ImportPhase, string> = {
  received: 'Received the source',
  'reading-source': 'Reading video information',
  'extracting-text': 'Reading captions and on-screen text',
  analysing: 'Understanding the recipe',
  validating: 'Checking the recipe data',
  saving: 'Saving your recipe',
  done: 'Done',
  failed: 'Failed',
};

export interface ProgressEntry {
  phase: ImportPhase;
  label: string;
  at: number;
}

export interface ProgressRecord {
  userId: string;
  entries: ProgressEntry[];
  finished: boolean;
  error: string | null;
  /**
   * The recipe the import produced. A client that stopped waiting — a phone
   * that slept, a request that outlasted its own timeout — can still collect
   * the result instead of being told the import failed when it did not.
   */
  recipeId: string | null;
  updatedAt: number;
}

const TTL_MS = 10 * 60 * 1000;
const MAX_RECORDS = 500;

export class ProgressTracker {
  private readonly records = new Map<string, ProgressRecord>();

  /** Ignores anything that is not a plausible client-generated id. */
  static normalizeId(raw: string | undefined): string | null {
    if (!raw) return null;
    const id = raw.trim();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;
    return id;
  }

  start(id: string | null, userId: string): void {
    if (!id) return;
    this.sweep();
    this.records.set(id, {
      userId,
      entries: [{ phase: 'received', label: PHASE_LABELS.received, at: Date.now() }],
      finished: false,
      error: null,
      recipeId: null,
      updatedAt: Date.now(),
    });
  }

  push(id: string | null, phase: ImportPhase): void {
    if (!id) return;
    const record = this.records.get(id);
    if (!record) return;
    record.entries.push({ phase, label: PHASE_LABELS[phase], at: Date.now() });
    record.updatedAt = Date.now();
    if (phase === 'done' || phase === 'failed') record.finished = true;
  }

  /** Marks the import done and remembers what it produced. */
  succeed(id: string | null, recipeId: string): void {
    if (!id) return;
    const record = this.records.get(id);
    if (!record) return;
    record.recipeId = recipeId;
    this.push(id, 'done');
  }

  fail(id: string | null, message: string): void {
    if (!id) return;
    const record = this.records.get(id);
    if (!record) return;
    record.error = message;
    this.push(id, 'failed');
  }

  /** Progress is only ever visible to the user who started it. */
  get(id: string, userId: string): ProgressRecord | null {
    const record = this.records.get(id);
    if (!record || record.userId !== userId) return null;
    return record;
  }

  private sweep(): void {
    const cutoff = Date.now() - TTL_MS;
    for (const [id, record] of this.records) {
      if (record.updatedAt < cutoff) this.records.delete(id);
    }
    if (this.records.size > MAX_RECORDS) {
      const oldest = [...this.records.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
      for (const [id] of oldest.slice(0, this.records.size - MAX_RECORDS)) this.records.delete(id);
    }
  }
}
