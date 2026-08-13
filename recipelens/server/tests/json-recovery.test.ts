/**
 * Reading an answer a reasoning model wrote.
 *
 * These models think out loud before answering, and the thinking contains
 * braces of its own — so "the first { in the response" is not the answer. They
 * also put literal newlines inside strings and run out of tokens mid-object.
 * Every repair here is syntax only: a field the model never wrote stays
 * missing, and the schema rejects the result rather than inventing it.
 */
import { describe, expect, it } from 'vitest';
import { parseJsonLoose } from '../src/ai/json.js';

const RECIPE = '{"title":"Garlic butter","servings":2,"ingredients":[{"name":"butter","quantity":100,"unit":"g"}],"steps":[{"instruction":"Mash together."}]}';

describe('thinking that comes before the answer', () => {
  it('ignores a <think> block that contains braces of its own', () => {
    const raw = `<think>The shape is {"title": string}. I will fill it in.</think>\n${RECIPE}`;
    const result = parseJsonLoose(raw);
    expect(result.ok).toBe(true);
    expect((result as { value: { title: string } }).value.title).toBe('Garlic butter');
  });

  it('handles the other tags models use for the same thing', () => {
    for (const tag of ['thinking', 'reasoning', 'scratchpad', 'analysis']) {
      const raw = `<${tag}>maybe {"a":1}</${tag}>${RECIPE}`;
      const result = parseJsonLoose(raw);
      expect(result.ok, tag).toBe(true);
      expect((result as { value: { title: string } }).value.title).toBe('Garlic butter');
    }
  });

  it('prefers the real answer over a small example the model mused about', () => {
    const raw = `First I will sketch {"title":"x"} and then answer.\n${RECIPE}`;
    const result = parseJsonLoose(raw);
    expect(result.ok).toBe(true);
    expect((result as { value: { title: string } }).value.title).toBe('Garlic butter');
  });

  it('still reads plain prose followed by the object', () => {
    const result = parseJsonLoose(`Sure! Here is the recipe:\n\n${RECIPE}`);
    expect(result.ok).toBe(true);
  });
});

describe('answers that are almost JSON', () => {
  it('escapes the literal newlines models put inside instructions', () => {
    const raw = '{"title":"Soup","steps":[{"instruction":"Chop.\nSimmer."}]}';
    const result = parseJsonLoose(raw);
    expect(result.ok).toBe(true);
    expect((result as { value: { steps: Array<{ instruction: string }> } }).value.steps[0].instruction).toContain('Chop.');
  });

  it('closes an object cut off by the token budget', () => {
    const raw = '{"title":"Soup","ingredients":[{"name":"onion","quantity":1},{"name":"carro';
    const result = parseJsonLoose(raw);
    expect(result.ok).toBe(true);
    const value = (result as { value: { title: string; ingredients: unknown[] } }).value;
    expect(value.title).toBe('Soup');
    // The half-written ingredient is dropped, never guessed at.
    expect(value.ingredients).toHaveLength(1);
  });

  it('reads a fenced block that follows a thinking block', () => {
    const raw = `<think>ok</think>\n\`\`\`json\n${RECIPE}\n\`\`\``;
    expect(parseJsonLoose(raw).ok).toBe(true);
  });
});

describe('answers that are not JSON at all', () => {
  it('fails rather than inventing something', () => {
    expect(parseJsonLoose('I cannot find a recipe in that video.').ok).toBe(false);
    expect(parseJsonLoose('').ok).toBe(false);
  });

  it('fails when the thinking never ended and no answer followed', () => {
    expect(parseJsonLoose('<think>still working on it, the title might be').ok).toBe(false);
  });
});
