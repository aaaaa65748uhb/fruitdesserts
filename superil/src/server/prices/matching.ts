import { RETAILERS } from "@/data/retailers";
import { canonicalGtin } from "@/lib/gtin";
import { normalizeText } from "@/lib/search";
import { totalBaseQuantity } from "@/lib/units";
import type { PackageUnit, Product } from "@/lib/types";
import type { FeedProduct } from "./types";

/**
 * Matching rules
 * 1. A curated catalog product is linked to retailer records ONLY through reviewed identifiers in
 *    data/barcode-map.json: a GTIN ("g:<gtin>" or plain digits) or a retailer-internal code ("i:<retailer>:<code>").
 * 2. The same GTIN from different retailers is the same product (verified identifier).
 * 3. Records whose package size differs from the product's size are never attached (size conflict).
 * 4. Name similarity only produces review *suggestions*; it never links anything automatically.
 */

export type BarcodeMap = Record<string, string[]>;

export function normalizeMapKey(value: string): string | undefined {
  const v = value.trim();
  if (v.startsWith("i:")) return /^i:[a-z-]+:[A-Za-z0-9._]+$/.test(v) ? v : undefined;
  const code = v.startsWith("g:") ? v.slice(2) : v;
  const g = canonicalGtin(code);
  return g ? `g:${g}` : undefined;
}

export function parseBarcodeMap(raw: unknown): { map: BarcodeMap; invalid: string[] } {
  const map: BarcodeMap = {};
  const invalid: string[] = [];
  if (!raw || typeof raw !== "object") return { map, invalid };
  for (const [productId, v] of Object.entries(raw as Record<string, unknown>)) {
    if (productId.startsWith("_")) continue; // comments
    const values = Array.isArray(v) ? v : [v];
    for (const x of values) {
      const key = typeof x === "string" ? normalizeMapKey(x) : undefined;
      if (key) {
        const list = (map[productId] ??= []);
        if (!list.includes(key)) list.push(key);
      }
      else invalid.push(`${productId}: ${String(x)}`);
    }
  }
  return { map, invalid };
}

/** Product id for feed products. Internal codes that cannot form a safe URL id return undefined (reported). */
export function keyToProductId(key: string): string | undefined {
  if (key.startsWith("g:")) return `gtin-${key.slice(2)}`;
  const m = key.match(/^i:([a-z-]+):([A-Za-z0-9._]+)$/);
  return m ? `int-${m[1]}-${m[2]}` : undefined;
}

export function productIdToKey(productId: string): string | undefined {
  if (productId.startsWith("gtin-")) return /^gtin-\d{13,14}$/.test(productId) ? `g:${productId.slice(5)}` : undefined;
  if (!productId.startsWith("int-")) return undefined;
  const rest = productId.slice(4);
  // Retailer ids contain dashes, so resolve against the known retailer list (longest id first).
  const retailer = [...RETAILERS].sort((a, b) => b.id.length - a.id.length).find((r) => rest.startsWith(`${r.id}-`));
  if (!retailer) return undefined;
  const code = rest.slice(retailer.id.length + 1);
  return /^[A-Za-z0-9._]+$/.test(code) ? `i:${retailer.id}:${code}` : undefined;
}

type Sized = { quantity: number; unit: PackageUnit } | { packageSize: number; packageUnit: PackageUnit; multipack?: number };

function base(s: Sized) {
  return "quantity" in s ? totalBaseQuantity({ packageSize: s.quantity, packageUnit: s.unit }) : totalBaseQuantity(s);
}

/** Same measurement basis and the same total amount (0.5% tolerance for rounding in files). */
export function sameSize(a: Sized, b: Sized): boolean {
  const x = base(a);
  const y = base(b);
  if (x.basis !== y.basis) return false;
  return Math.abs(x.amount - y.amount) <= Math.max(x.amount, y.amount) * 0.005;
}

export function invertMap(map: BarcodeMap): Map<string, string> {
  const inv = new Map<string, string>();
  for (const [productId, keys] of Object.entries(map)) for (const k of keys) inv.set(k, productId);
  return inv;
}

export interface MatchRecordInput {
  productKey: string;
  barcode?: string;
  itemCode: string;
  name: string;
  manufacturer?: string;
  quantity: number;
  unit: PackageUnit;
}

export interface SizeConflict {
  productKey: string;
  recordName: string;
  against: "catalog" | "feed";
  productId: string;
  productName: string;
  expected: string;
  found: string;
}

export interface Suggestion {
  productId: string;
  productName: string;
  productKey: string;
  recordName: string;
  score: number;
}

export interface EntryMatchReport {
  matchedToCatalog: { productId: string; productKey: string }[];
  knownFeedProducts: number;
  newProducts: number;
  internalCodes: number;
  sizeConflicts: SizeConflict[];
  suggestions: Suggestion[];
}

const fmt = (q: number, u: PackageUnit) => `${q} ${u}`;

export function matchRecords(
  records: MatchRecordInput[],
  catalog: Product[],
  map: BarcodeMap,
  feed: Record<string, FeedProduct>,
): EntryMatchReport {
  const inv = invertMap(map);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const report: EntryMatchReport = { matchedToCatalog: [], knownFeedProducts: 0, newProducts: 0, internalCodes: 0, sizeConflicts: [], suggestions: [] };
  const unmappedCatalog = catalog.filter((p) => p.provenance === "curated_demo" && !map[p.id]);
  for (const r of records) {
    if (!r.barcode) report.internalCodes++;
    const mappedId = inv.get(r.productKey);
    if (mappedId) {
      const p = byId.get(mappedId);
      if (p && !sameSize(r, p)) {
        report.sizeConflicts.push({ productKey: r.productKey, recordName: r.name, against: "catalog", productId: p.id, productName: p.nameHe, expected: fmt(p.packageSize * (p.multipack ?? 1), p.packageUnit), found: fmt(r.quantity, r.unit) });
      } else if (p) report.matchedToCatalog.push({ productId: p.id, productKey: r.productKey });
      continue;
    }
    const known = feed[r.productKey];
    if (known) {
      report.knownFeedProducts++;
      if (!sameSize(r, known)) {
        report.sizeConflicts.push({ productKey: r.productKey, recordName: r.name, against: "feed", productId: keyToProductId(r.productKey) ?? r.productKey, productName: known.name, expected: fmt(known.quantity, known.unit), found: fmt(r.quantity, r.unit) });
      }
    } else report.newProducts++;
    if (r.barcode && report.suggestions.length < 200) {
      for (const p of unmappedCatalog) {
        const score = similarity(p, r);
        if (score >= 0.75) report.suggestions.push({ productId: p.id, productName: `${p.nameHe} ${p.brand}`, productKey: r.productKey, recordName: r.name, score });
      }
    }
  }
  report.suggestions.sort((a, b) => b.score - a.score);
  return report;
}

/** Review-only similarity: all name tokens present, brand present, and identical package size. */
export function similarity(p: Product, r: MatchRecordInput): number {
  if (!sameSize(r, p)) return 0;
  const text = normalizeText(`${r.name} ${r.manufacturer ?? ""}`);
  const nameTokens = normalizeText(p.nameHe).split(" ").filter((t) => t.length > 1 && !/^\d/.test(t));
  if (!nameTokens.length) return 0;
  const hits = nameTokens.filter((t) => text.includes(t)).length;
  const brandHit = normalizeText(p.brand).split(" ").some((t) => t.length > 1 && text.includes(t));
  const score = hits / nameTokens.length;
  return brandHit ? score : score * 0.7;
}
