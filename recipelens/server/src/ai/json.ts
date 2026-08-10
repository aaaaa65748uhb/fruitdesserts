/**
 * Recovery of a JSON object from a model's raw answer.
 *
 * Models wrap JSON in prose or code fences, emit trailing commas, or stop
 * mid-object. These are *safe* repairs: they only fix syntax, never content —
 * no field is ever filled in on the model's behalf.
 */

export type JsonParseResult =
  | { ok: true; value: unknown; repaired: boolean }
  | { ok: false; error: string };

export function parseJsonLoose(raw: string): JsonParseResult {
  const text = (raw ?? '').trim();
  if (!text) return { ok: false, error: 'empty response' };

  const direct = tryParse(text);
  if (direct.ok) return { ok: true, value: direct.value, repaired: false };

  const candidates = [stripFences(text), extractBalancedObject(text), extractBalancedObject(stripFences(text))];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = tryParse(candidate);
    if (parsed.ok) return { ok: true, value: parsed.value, repaired: true };

    const cleaned = removeTrailingCommas(candidate);
    const parsedClean = tryParse(cleaned);
    if (parsedClean.ok) return { ok: true, value: parsedClean.value, repaired: true };

    const closed = closeTruncated(cleaned);
    if (closed) {
      const parsedClosed = tryParse(closed);
      if (parsedClosed.ok) return { ok: true, value: parsedClosed.value, repaired: true };
    }
  }

  return { ok: false, error: direct.error };
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'invalid JSON' };
  }
}

function stripFences(text: string): string {
  const fenced = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  return text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
}

/** First top-level {...} block, respecting strings and escapes. */
function extractBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start); // truncated — closeTruncated() may still rescue it
}

function removeTrailingCommas(text: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ',') {
      const rest = text.slice(i + 1);
      const nextNonSpace = rest.match(/^\s*([}\]])/);
      if (nextNonSpace) continue; // drop the comma
    }
    out += ch;
  }
  return out;
}

interface Scan {
  /** Brackets still open at the end of the scanned text. */
  stack: string[];
  inString: boolean;
  /** Index of the last comma that was outside a string. */
  lastComma: number;
}

function scanStructure(text: string): Scan {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastComma = -1;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
    else if (ch === ',') lastComma = i;
  }
  return { stack, inString, lastComma };
}

/**
 * Close a response that was cut off mid-object (max_tokens reached): drop the
 * incomplete trailing element and close whatever brackets remain open.
 */
function closeTruncated(text: string): string | null {
  const full = scanStructure(text);
  if (full.stack.length === 0 && !full.inString) return null; // not truncated

  // Cut back to the last complete element, then re-scan what actually remains.
  let body = full.lastComma > 0 ? text.slice(0, full.lastComma) : text;
  const partial = scanStructure(body);
  if (partial.inString) body = body.replace(/"[^"]*$/, '');
  body = removeTrailingCommas(body);

  const remaining = scanStructure(body);
  if (remaining.stack.length === 0) return null;

  const closers = remaining.stack
    .slice()
    .reverse()
    .map((open) => (open === '{' ? '}' : ']'))
    .join('');
  return `${body}${closers}`;
}
