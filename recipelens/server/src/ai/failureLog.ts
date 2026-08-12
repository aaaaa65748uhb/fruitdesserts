/**
 * The last few AI provider failures, kept in memory so a deployment can be
 * diagnosed without shell access to the machine.
 *
 * Why this exists: when a provider refuses a request, the only party who can
 * see why is the server holding the key. Previously that reason was mapped to
 * a generic message and thrown away, which left "the AI provider returned an
 * unusable response" with nothing behind it.
 *
 * Nothing here is allowed to carry a credential. Every recorded string goes
 * through `redact()` first, and the buffer is capped so it cannot grow.
 */

export type FailureStage = 'transport' | 'http' | 'envelope' | 'empty';

export interface ProviderFailure {
  at: string;
  stage: FailureStage;
  code: string;
  status: number | null;
  provider: string;
  model: string;
  endpoint: string;
  /** Redacted, truncated provider text — for a human to read, not to parse. */
  detail: string;
}

const MAX_ENTRIES = 10;
const MAX_DETAIL_CHARS = 400;

const entries: ProviderFailure[] = [];

/**
 * Strips anything shaped like a credential. Provider error bodies should never
 * contain one, but this is the one place where provider text becomes readable,
 * so it does not rely on that.
 */
export function redact(text: string): string {
  return text
    .replace(/\b(nvapi|sk|sk-proj|sk-ant|gsk|AIza)[-_][A-Za-z0-9_-]{6,}/g, '[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [redacted]')
    .replace(/("?(?:api[_-]?key|authorization|token)"?\s*[:=]\s*"?)[^"\s,}]{8,}/gi, '$1[redacted]');
}

export function recordProviderFailure(failure: Omit<ProviderFailure, 'at' | 'detail'> & { detail?: string }): void {
  const entry: ProviderFailure = {
    at: new Date().toISOString(),
    stage: failure.stage,
    code: failure.code,
    status: failure.status ?? null,
    provider: failure.provider,
    model: failure.model,
    endpoint: failure.endpoint,
    detail: redact((failure.detail ?? '').replace(/\s+/g, ' ').trim()).slice(0, MAX_DETAIL_CHARS),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);

  // Also visible in the platform's log stream, where most people look first.
  console.warn(
    `[ai] ${entry.provider}/${entry.model} ${entry.stage} failure` +
      `${entry.status ? ` (HTTP ${entry.status})` : ''}: ${entry.detail || entry.code}`,
  );
}

/** Newest first. */
export function recentProviderFailures(): ProviderFailure[] {
  return [...entries].reverse();
}

export function clearProviderFailures(): void {
  entries.length = 0;
}
