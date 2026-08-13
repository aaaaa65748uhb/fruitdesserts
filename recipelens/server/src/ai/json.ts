/**
 * Recovery of a JSON object from a model's raw answer.
 *
 * Models wrap JSON in prose or code fences, emit trailing commas, stop
 * mid-object, put literal newlines inside strings, or think out loud first —
 * and a reasoning model's thinking frequently contains braces of its own, so
 * the first `{` in the response is not necessarily the answer.
 *
 * Every repair here is *syntactic*. Nothing is filled in on the model's
 * behalf: a field the model did not write stays missing, and the schema
 * rejects the result rather than inventing it.
 */

export type JsonParseResult =
  | { ok: true; value: unknown; repaired: boolean }
  | { ok: false; error: string };

export function parseJsonLoose(raw: string): JsonParseResult {
  const text = (raw ?? '').trim();
  if (!text) return { ok: false, error: 'empty response' };

  const direct = tryParse(text);
  if (direct.ok) return { ok: true, value: direct.value, repaired: false };

  const thoughtless = stripReasoning(text);
  const candidates = [
    thoughtless,
    stripFences(thoughtless),
    ...extractBalancedObjects(thoughtless),
    ...extractBalancedObjects(stripFences(thoughtless)),
  ];

  // Among the objects the model produced, take the largest that parses: a
  // reasoning trace often contains a small illustrative object before the real
  // answer, and the answer is the substantial one.
  let best: { value: unknown; size: number } | null = null;
  const consider = (candidate: string) => {
    const parsed = tryParse(candidate);
    if (parsed.ok && (!best || candidate.length > best.size)) best = { value: parsed.value, size: candidate.length };
  };

  for (const candidate of candidates) {
    if (!candidate) continue;
    consider(candidate);
    const cleaned = removeTrailingCommas(escapeRawControlChars(candidate));
    consider(cleaned);
    const closed = closeTruncated(cleaned);
    if (closed) consider(closed);
  }

  if (best) return { ok: true, value: (best as { value: unknown }).value, repaired: true };
  return { ok: false, error: direct.error };
}

/**
 * Remove a reasoning model's thinking. It is not part of the answer, and it
 * routinely contains braces — so leaving it in makes the first `{` in the
 * response point at the model's notes instead of its output.
 */
function stripReasoning(text: string): string {
  const tagged = text.replace(/<(think|thinking|reasoning|scratchpad|analysis)>[\s\S]*?<\/\1>/gi, ' ').trim();
  // An unclosed block means the thinking ran to the end of the response; keep
  // whatever follows the last closing tag, if there is one.
  const lastClose = tagged.lastIndexOf('</think>');
  return (lastClose === -1 ? tagged : tagged.slice(lastClose + '</think>'.length)).trim() || tagged;
}

/**
 * Literal newlines and tabs inside a JSON string are invalid, and models emit
 * them in step instructions all the time. Escaping is a pure syntax repair —
 * the characters stay, they just become legal.
 */
function escapeRawControlChars(text: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
        out += ch;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        out += ch;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') inString = true;
    out += ch;
  }
  return out;
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

/**
 * Every top-level {...} block, respecting strings and escapes, plus the
 * trailing fragment when the response was cut off mid-object. More than one
 * can appear — the caller decides which is the answer.
 */
function extractBalancedObjects(text: string): string[] {
  const found: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        found.push(text.slice(start, i + 1));
        start = -1;
      }
      if (depth < 0) depth = 0;
    }
  }
  // Cut off mid-object: closeTruncated() may still rescue the tail.
  if (depth > 0 && start !== -1) found.push(text.slice(start));
  return found;
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
