import { CATEGORY_BY_ID } from "./categories";
import type { CategoryId, Product } from "./types";

const NIQQUD = /[֑-ׇ]/g;
const FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/** Normalizes Hebrew/English text for matching: niqqud, final letters, quotes, double vav/yod, case. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFC")
    .replace(NIQQUD, "")
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/["'`׳״‘’“”]/g, "")
    .replace(/[-_.,/\\()%+]/g, " ")
    .replace(/וו/g, "ו")
    .replace(/יי/g, "י")
    .replace(/\s+/g, " ")
    .trim();
}

/** Also strips matres lectionis (ו/י inside words) to match defective vs plene spellings (e.g. "שקולד"/"שוקולד"). */
function skeleton(token: string): string {
  if (token.length <= 2) return token;
  return token[0] + token.slice(1, -1).replace(/[וי]/g, "") + token[token.length - 1];
}

const SYNONYMS: Record<string, string[]> = {
  קולה: ["קוקה קולה"],
  coke: ["קוקה קולה"],
  מים: ["מים מינרליים"],
  שוקולד: ["פרה"],
  חלב: ["חלב טרי"],
  ניר: ["נייר"],
  טואלט: ["נייר טואלט"],
  סבון: ["נוזל כלים", "סבון ידיים"],
  פסטה: ["ספגטי", "פנה", "פתיתים"],
  ירקות: ["עגבניות", "מלפפונים"],
};

function levenshteinAtMost1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

export interface SearchFilters {
  category?: CategoryId;
  brand?: string;
}

export interface SearchHit {
  product: Product;
  score: number;
}

function productHaystack(p: Product) {
  const name = normalizeText(p.nameHe);
  const en = normalizeText(p.nameEn ?? "");
  const brand = normalizeText(p.brand);
  const category = normalizeText(CATEGORY_BY_ID[p.category]?.nameHe ?? "");
  const tokens = `${name} ${en} ${brand}`.split(" ").filter(Boolean);
  return { name, en, brand, category, tokens, full: `${brand} ${name}`, fullRev: `${name} ${brand}` };
}

function scoreProduct(p: Product, q: string, qTokens: string[]): number {
  const h = productHaystack(p);
  if (p.barcode && q.replace(/\s/g, "") === p.barcode) return 1000;
  if (h.name === q || h.full === q || h.fullRev === q || h.en === q) return 500;
  let score = 0;
  if (h.name.startsWith(q)) score = Math.max(score, 300);
  else if (h.name.includes(q) || h.full.includes(q) || h.fullRev.includes(q)) score = Math.max(score, 220);
  else if (h.en && h.en.includes(q)) score = Math.max(score, 200);

  // Every query token must match some product token (exactly, as prefix, by skeleton, or within 1 edit).
  let allTokensMatch = qTokens.length > 0;
  let tokenScore = 0;
  for (const qt of qTokens) {
    let best = 0;
    for (const t of h.tokens) {
      if (t === qt) best = Math.max(best, 40);
      else if (t.startsWith(qt) && qt.length >= 2) best = Math.max(best, 30);
      else if (qt.length >= 3 && skeleton(t) === skeleton(qt)) best = Math.max(best, 28);
      else if (qt.length >= 4 && levenshteinAtMost1(t, qt)) best = Math.max(best, 18);
    }
    if (best === 0) allTokensMatch = false;
    tokenScore += best;
  }
  if (allTokensMatch) score = Math.max(score, 100 + tokenScore);
  if (h.brand === q) score = Math.max(score, 150);

  // Broad category matches rank below any product-name match.
  if (score === 0 && (h.category.includes(q) || qTokens.every((t) => h.category.includes(t)))) score = 40;
  return score;
}

export function searchProducts(products: Product[], query: string, filters: SearchFilters = {}, limit = 50): SearchHit[] {
  const pool = products.filter(
    (p) => (!filters.category || p.category === filters.category) && (!filters.brand || p.brand === filters.brand),
  );
  const q = normalizeText(query);
  if (!q) return pool.slice(0, limit).map((product) => ({ product, score: 0 }));

  const queries = [q, ...(SYNONYMS[q] ?? []).map(normalizeText)];
  const hits: SearchHit[] = [];
  for (const product of pool) {
    let best = 0;
    queries.forEach((qq, i) => {
      const s = scoreProduct(product, qq, qq.split(" ").filter(Boolean));
      best = Math.max(best, i === 0 ? s : s * 0.8); // synonym matches rank slightly below direct ones
    });
    if (best > 0) hits.push({ product, score: best });
  }
  return hits
    .sort((a, b) => b.score - a.score || a.product.nameHe.localeCompare(b.product.nameHe, "he"))
    .slice(0, limit);
}

export function suggest(products: Product[], query: string, limit = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { product } of searchProducts(products, query, {}, 30)) {
    const label = `${product.nameHe} ${product.brand}`;
    if (!seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
    if (out.length >= limit) break;
  }
  return out;
}
