import type { AnalyzeRecipeInput } from './providers/AIProvider.js';

export const RECIPE_JSON_SHAPE = `{
  "title": string,
  "description": string | null,
  "servings": number | null,
  "prepMinutes": number | null,
  "cookMinutes": number | null,
  "difficulty": "easy" | "medium" | "hard" | null,
  "cuisine": string | null,
  "tags": string[],
  "equipment": string[],
  "notes": string | null,
  "missingInfo": string[],
  "confidence": number,
  "ingredients": [
    {
      "name": string,
      "quantity": number | null,
      "unit": string | null,
      "note": string | null,
      "optional": boolean,
      "estimated": boolean
    }
  ],
  "steps": [
    {
      "instruction": string,
      "durationSeconds": number | null,
      "temperatureC": number | null,
      "estimated": boolean
    }
  ]
}`;

export const SYSTEM_PROMPT = `You are RecipeLens, a careful recipe extraction engine.

You convert cooking content (video transcripts, captions, OCR text, screenshots, pasted text) into ONE structured recipe.

Absolute rules:
1. Reply with a single JSON object and nothing else. No markdown, no code fences, no commentary.
2. NEVER invent information. If the source does not state a quantity, temperature, time, serving count or ingredient, use null.
3. When you infer a plausible amount from visual or contextual evidence rather than a stated value, keep the value AND set "estimated": true for that ingredient or step.
4. Anything you could not determine must be listed by name in "missingInfo" (e.g. "servings", "oven temperature").
5. Do not add ingredients that are not visible or mentioned. Do not add nutrition data.
6. "quantity" must be a plain number (use 0.5 rather than "1/2"). Put the unit in "unit" ("g", "ml", "tbsp", "cup", "clove", "piece"…). Use null for "to taste" amounts and put the wording in "note".
7. "confidence" is your own 0-1 estimate of how completely the source described the recipe.
8. Keep step instructions in the source language, one action group per step, imperative and specific.

Required JSON shape:
${RECIPE_JSON_SHAPE}`;

/** Roughly 20k tokens of source material — generous, but finite. */
const MAX_PROMPT_CHARS = 80_000;

function section(label: string, value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return `### ${label}\n${trimmed.slice(0, 12000)}`;
}

/** Everything textual we know about the source, in a stable order. */
export function buildUserPrompt(input: AnalyzeRecipeInput, repairHint?: string | null): string {
  const parts: Array<string | null> = [
    `### Source type\n${input.sourceType}`,
    input.sourceUrl ? `### Source URL\n${input.sourceUrl}` : null,
    section('Title', input.title),
    section('Description', input.description),
    input.captions?.length ? section('Captions', input.captions.join('\n')) : null,
    section('Transcript', input.transcript),
    section('OCR text from screenshots', input.ocrText),
    section('Text supplied by the user', input.pastedText),
    input.metadata && Object.keys(input.metadata).length
      ? section(
          'Metadata',
          Object.entries(input.metadata)
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join('\n'),
        )
      : null,
    input.images?.length ? `### Images\n${input.images.length} image(s) are attached to this message.` : null,
    input.language ? `### Preferred output language\n${input.language}` : null,
  ];

  // Each section is already bounded; this bounds their sum, so a page that
  // yields an unusual amount of text cannot push the request past the model's
  // context window and turn into an opaque HTTP 400.
  let body = parts.filter(Boolean).join('\n\n');
  if (body.length > MAX_PROMPT_CHARS) {
    body = `${body.slice(0, MAX_PROMPT_CHARS)}\n\n[source text truncated]`;
  }
  let prompt = `Extract the recipe from the material below.\n\n${body}`;

  if (repairHint) {
    prompt += `\n\n### Correction required
Your previous answer was rejected by the schema validator:
${repairHint}
Return the corrected JSON object only. Do not invent values to satisfy the schema — use null and list the field in "missingInfo".`;
  }
  return prompt;
}

/** Rough guard against calling the model with nothing useful to read. */
export function sourceTextLength(input: AnalyzeRecipeInput): number {
  return [input.title, input.description, input.transcript, input.ocrText, input.pastedText, ...(input.captions ?? [])]
    .filter((v): v is string => typeof v === 'string')
    .reduce((sum, v) => sum + v.trim().length, 0);
}
