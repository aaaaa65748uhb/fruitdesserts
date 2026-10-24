import { promises as fs } from "fs";
import { SEED_PRODUCTS } from "@/data/seed-products";
import { RETAILER_BY_ID } from "@/data/retailers";
import type { Product } from "@/lib/types";
import { analyzeUpload, type AnalyzedEntry } from "../ingest/analyze";
import type { Issue } from "../ingest/records";
import { priceConfig } from "./config";
import { JsonPriceRepository } from "./json-repo";
import {
  invertMap,
  keyToProductId,
  matchRecords,
  normalizeMapKey,
  parseBarcodeMap,
  sameSize,
  type BarcodeMap,
  type EntryMatchReport,
  type SizeConflict,
  type Suggestion,
} from "./matching";
import { mergePriceSnapshot, mergePromoSnapshot } from "./merge";
import { OFFICIAL_PROVENANCE, type ApplyStats, type FeedProduct, type ImportBatch, type MappingDecision, type PriceRepository, type StoredBranch } from "./types";

let repo: PriceRepository | undefined;

export type StorageMode = "postgres" | "file" | "file-unsafe";

/**
 * Where official data is stored:
 * - "postgres":    DATABASE_URL is set (recommended for production).
 * - "file":        JSON files in PRICE_DATA_DIR (development, or production with an explicit persistent volume).
 * - "file-unsafe": production without DATABASE_URL and without an explicit PRICE_DATA_DIR. Imports are refused,
 *                  because the default folder is usually wiped on redeploy.
 */
export function storageMode(): StorageMode {
  if (process.env.DATABASE_URL) return "postgres";
  if (process.env.NODE_ENV === "production" && !process.env.PRICE_DATA_DIR) return "file-unsafe";
  return "file";
}

export class StorageNotPersistentError extends Error {
  constructor() {
    super("אחסון לא קבוע: בסביבת ייצור יש להגדיר DATABASE_URL (מומלץ) או PRICE_DATA_DIR על כונן קבוע. הייבוא נחסם כדי שהנתונים לא יאבדו.");
  }
}

export async function getPriceRepository(): Promise<PriceRepository> {
  if (repo) return repo;
  if (process.env.DATABASE_URL) {
    const { PrismaPriceRepository } = await import("./prisma-repo");
    repo = new PrismaPriceRepository();
  } else repo = new JsonPriceRepository();
  return repo;
}

function assertWritable() {
  if (storageMode() === "file-unsafe" && !testRepo) throw new StorageNotPersistentError();
}
let testRepo = false;
/** For tests. */
export function setPriceRepository(r: PriceRepository | undefined) {
  repo = r;
  testRepo = !!r;
}

/** The committed, reviewed mapping file (data/barcode-map.json). */
export async function readMappingFile(file = priceConfig.barcodeMapFile): Promise<{ map: BarcodeMap; invalid: string[] }> {
  try {
    return parseBarcodeMap(JSON.parse(await fs.readFile(file, "utf8")));
  } catch {
    return { map: {}, invalid: [] };
  }
}

export interface ApprovedMapping {
  productId: string;
  key: string;
  source: "file" | "admin-web" | "cli";
  decidedAt?: string;
}

/**
 * Effective catalog ↔ identifier links = approvals in the committed mapping file + decisions stored in the
 * repository (database in production). A stored decision for the same pair overrides the file.
 */
export async function effectiveMappings(): Promise<{ map: BarcodeMap; approved: ApprovedMapping[]; rejected: Set<string>; invalid: string[] }> {
  const { map: fileMap, invalid } = await readMappingFile();
  const decisions = await (await getPriceRepository()).getMappingDecisions();
  const decided = new Map(decisions.map((d) => [`${d.productId}|${d.key}`, d]));
  const approved: ApprovedMapping[] = [];
  for (const [productId, keys] of Object.entries(fileMap)) {
    for (const key of keys) if (!decided.has(`${productId}|${key}`)) approved.push({ productId, key, source: "file" });
  }
  for (const d of decisions) if (d.status === "approved") approved.push({ productId: d.productId, key: d.key, source: d.decidedBy, decidedAt: d.decidedAt });
  const map: BarcodeMap = {};
  for (const a of approved) (map[a.productId] ??= []).push(a.key);
  const rejected = new Set(decisions.filter((d) => d.status === "rejected").map((d) => `${d.productId}|${d.key}`));
  return { map, approved, rejected, invalid };
}

/** @deprecated kept for callers that only need the effective map */
export async function readBarcodeMap(): Promise<{ map: BarcodeMap; invalid: string[] }> {
  const { map, invalid } = await effectiveMappings();
  return { map, invalid };
}

const MAX_ISSUES_IN_REPORT = 300;

export interface EntryReport {
  entryName: string;
  kind?: string;
  encoding?: string;
  container?: string;
  retailerId?: string;
  retailerName?: string;
  chainId?: string;
  storeId?: string;
  branchName?: string;
  publishedAt?: string;
  publishedAtSource?: string;
  counts: { total: number; valid: number; errors: number; warnings: number };
  issueCounts: Record<string, number>;
  issues: Issue[];
  issuesTruncated: boolean;
  blockers: string[];
  alreadyImported?: { id: string; importedAt: string };
  matching?: Omit<EntryMatchReport, "matchedToCatalog"> & { matchedToCatalog: number };
  sample: { name: string; price?: number; size?: string; key?: string }[];
  status: "ready" | "blocked" | "already_imported" | "imported" | "not_applied";
  applied?: ApplyStats;
  importId?: string;
}

export interface UploadReport {
  uploadName: string;
  fileHash: string;
  sizeBytes: number;
  mode: "preview" | "commit";
  repository: "json" | "postgres";
  errors: string[];
  entries: EntryReport[];
}

export interface UploadOptions {
  retailerId?: string;
  publishedAt?: string;
  force?: boolean;
  importedBy: ImportBatch["importedBy"];
  now?: number;
}

function summarizeIssues(issues: Issue[]) {
  const issueCounts: Record<string, number> = {};
  for (const i of issues) issueCounts[i.code] = (issueCounts[i.code] ?? 0) + 1;
  return {
    issueCounts,
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
  };
}

async function entryReport(e: AnalyzedEntry, r: PriceRepository, fileHash: string, catalog: Product[], map: BarcodeMap, feed: Record<string, FeedProduct>): Promise<EntryReport> {
  const { issueCounts, errors, warnings } = summarizeIssues(e.issues);
  const existing = await r.findImport(fileHash, e.entryName);
  let branchName: string | undefined;
  if (e.retailerId && e.storeId) branchName = (await r.getStores(e.retailerId)).find((s) => s.storeId === e.storeId)?.name;
  const matching = e.prices && e.retailerId ? matchRecords(e.prices, catalog, map, feed) : undefined;
  return {
    entryName: e.entryName,
    kind: e.kind,
    encoding: e.encoding,
    container: e.container,
    retailerId: e.retailerId,
    retailerName: e.retailerId ? RETAILER_BY_ID[e.retailerId]?.nameHe : undefined,
    chainId: e.chainId,
    storeId: e.storeId,
    branchName,
    publishedAt: e.publishedAt,
    publishedAtSource: e.publishedAtSource,
    counts: { total: e.totalRecords, valid: e.validRecords, errors, warnings },
    issueCounts,
    issues: e.issues.slice(0, MAX_ISSUES_IN_REPORT),
    issuesTruncated: e.issues.length > MAX_ISSUES_IN_REPORT,
    blockers: e.blockers,
    alreadyImported: existing ? { id: existing.id, importedAt: existing.importedAt } : undefined,
    matching: matching ? { ...matching, matchedToCatalog: matching.matchedToCatalog.length, suggestions: matching.suggestions.slice(0, 50), sizeConflicts: matching.sizeConflicts.slice(0, 100) } : undefined,
    sample: (e.prices?.slice(0, 8).map((p) => ({ name: p.name, price: p.price, size: `${p.quantity} ${p.unit}`, key: p.productKey })) ??
      e.promotions?.slice(0, 8).map((p) => ({ name: p.description ?? p.promotionId, key: p.items[0]?.productKey })) ??
      e.stores?.slice(0, 8).map((s) => ({ name: `${s.storeId} ${s.name ?? ""} ${s.city ?? ""}`.trim() })) ??
      []),
    status: e.blockers.length ? "blocked" : existing ? "already_imported" : "ready",
  };
}

/** Warns when files are imported out of the recommended order (Stores → PriceFull → PromoFull → updates). */
async function addOrderWarnings(entries: AnalyzedEntry[], r: PriceRepository) {
  const branchesWithPrices = new Set((await r.listPriceBranches()).map((b) => `${b.retailerId}:${b.storeId}`));
  for (const e of entries) {
    if (!e.retailerId || e.blockers.length) continue;
    const inUpload = (kind: string, sameStore: boolean) =>
      entries.some((x) => x !== e && x.retailerId === e.retailerId && x.kind?.startsWith(kind) && !x.blockers.length && (!sameStore || x.storeId === e.storeId));
    if (e.kind?.startsWith("price") && !inUpload("stores", false) && !(await r.getStores(e.retailerId)).length) {
      e.issues.push({ severity: "warning", code: "order_stores_missing", message: "קובץ הסניפים של הרשת טרם יובא – שם הסניף והעיר לא יוצגו עד שייובא" });
    }
    if (e.kind?.startsWith("promo") && !inUpload("price", true) && !branchesWithPrices.has(`${e.retailerId}:${e.storeId}`)) {
      e.issues.push({ severity: "warning", code: "order_prices_missing", message: "לסניף זה טרם יובאו מחירים – המבצעים יוצגו רק אחרי ייבוא קובץ מחירים" });
    }
  }
}

/** Parses and validates an upload and reports what an import would do. Writes nothing. */
export async function previewUpload(name: string, bytes: Uint8Array, opts: UploadOptions): Promise<UploadReport> {
  const r = await getPriceRepository();
  const analysis = analyzeUpload(name, bytes, { retailerId: opts.retailerId, publishedAt: opts.publishedAt, chainMap: await r.getChainMap(), now: opts.now, staleAfterMs: priceConfig.staleAfterMs });
  await addOrderWarnings(analysis.entries, r);
  const { map } = await readBarcodeMap();
  const feed = await r.getFeedProducts();
  const entries = await Promise.all(analysis.entries.map((e) => entryReport(e, r, analysis.fileHash, SEED_PRODUCTS, map, feed)));
  return { uploadName: name, fileHash: analysis.fileHash, sizeBytes: analysis.sizeBytes, mode: "preview", repository: r.kind, errors: analysis.errors, entries };
}

/** Imports every entry that has no blockers. Safe to repeat: identical files are detected and merges are idempotent. */
export async function commitUpload(name: string, bytes: Uint8Array, opts: UploadOptions): Promise<UploadReport> {
  assertWritable();
  const r = await getPriceRepository();
  const now = opts.now ?? Date.now();
  const analysis = analyzeUpload(name, bytes, { retailerId: opts.retailerId, publishedAt: opts.publishedAt, chainMap: await r.getChainMap(), now, staleAfterMs: priceConfig.staleAfterMs });
  await addOrderWarnings(analysis.entries, r);
  const { map } = await readBarcodeMap();
  const mappedKeys = invertMap(map);
  const report: UploadReport = { uploadName: name, fileHash: analysis.fileHash, sizeBytes: analysis.sizeBytes, mode: "commit", repository: r.kind, errors: analysis.errors, entries: [] };

  let archived = false;
  // Stores files first, so branch names are known for the price entries in the same archive.
  const ordered = [...analysis.entries].sort((a, b) => Number(b.kind === "stores") - Number(a.kind === "stores"));
  for (const [i, e] of ordered.entries()) {
    const feed = await r.getFeedProducts();
    const er = await entryReport(e, r, analysis.fileHash, SEED_PRODUCTS, map, feed);
    if (er.status === "blocked" || (er.status === "already_imported" && !opts.force)) {
      report.entries.push(er);
      continue;
    }
    const importedAt = new Date(now).toISOString();
    const batch: ImportBatch = {
      id: `${analysis.fileHash.slice(0, 12)}-${i}-${now.toString(36)}`,
      fileHash: analysis.fileHash,
      uploadName: name,
      entryName: e.entryName,
      kind: e.kind!,
      retailerId: e.retailerId!,
      chainId: e.chainId,
      subChainId: e.subChainId,
      storeId: e.storeId,
      publishedAt: e.publishedAt!,
      publishedAtSource: e.publishedAtSource!,
      importedAt,
      importedBy: opts.importedBy,
      provenance: OFFICIAL_PROVENANCE,
      counts: er.counts,
      applied: { written: 0, unchanged: 0, skippedOlder: 0, removed: 0 },
    };
    if (e.prices) {
      const current = await r.getBranchSnapshot(batch.retailerId, batch.storeId!);
      const { snapshot, stats } = mergePriceSnapshot(current, e.prices, batch);
      const newProducts: FeedProduct[] = e.prices
        .filter((p) => !feed[p.productKey] && !mappedKeys.has(p.productKey) && keyToProductId(p.productKey))
        .map((p) => ({
          productKey: p.productKey,
          barcode: p.barcode,
          internalRetailerId: p.barcode ? undefined : batch.retailerId,
          itemCode: p.itemCode,
          name: p.name,
          manufacturer: p.manufacturer,
          quantity: p.quantity,
          unit: p.unit,
          isWeighted: p.isWeighted,
          firstSeenImportId: batch.id,
          firstSeenAt: importedAt,
        }));
      if (stats.written || stats.removed || newProducts.length) await r.saveBranchSnapshot(snapshot, newProducts);
      batch.applied = stats;
    } else if (e.promotions) {
      const current = await r.getPromoSnapshot(batch.retailerId, batch.storeId!);
      const { snapshot, stats } = mergePromoSnapshot(current, e.promotions, batch);
      if (stats.written || stats.removed) await r.savePromoSnapshot(snapshot);
      batch.applied = stats;
    } else if (e.stores) {
      const stores: StoredBranch[] = e.stores.map((s) => ({
        retailerId: batch.retailerId,
        storeId: s.storeId,
        subChainId: s.subChainId,
        chainId: s.chainId ?? batch.chainId,
        name: s.name,
        address: s.address,
        city: s.city,
        cityIsCode: s.cityIsCode,
        zipCode: s.zipCode,
        publishedAt: batch.publishedAt,
        importId: batch.id,
        sourceFile: batch.entryName,
      }));
      await r.saveStores(batch.retailerId, stores);
      batch.applied = { written: stores.length, unchanged: 0, skippedOlder: 0, removed: 0 };
    }
    if (!archived) {
      await r.archiveUpload({ fileHash: analysis.fileHash, uploadName: name, sizeBytes: analysis.sizeBytes, uploadedAt: importedAt, uploadedBy: opts.importedBy }, bytes);
      archived = true;
    }
    await r.recordImport(batch, e.issues);
    if (batch.chainId) await r.learnChain(batch.chainId, batch.retailerId);
    report.entries.push({ ...er, status: batch.applied.written || batch.applied.removed ? "imported" : "not_applied", applied: batch.applied, importId: batch.id });
  }
  return report;
}

export interface SuggestionDetail extends Suggestion {
  productBrand: string;
  productSize: string;
  recordManufacturer?: string;
  recordSize: string;
  retailers: string[];
  priceRange?: [number, number];
}

export interface MatchingOverview {
  generatedAt: string;
  repository: "json" | "postgres";
  imports: number;
  branches: { retailerId: string; storeId: string; offers: number; name?: string; city?: string; lastFullPublishedAt?: string }[];
  /** Approved links with their source and the official prices they currently receive. */
  approved: (ApprovedMapping & { productName: string; offersByRetailer: Record<string, number> })[];
  /** Catalog products with at least one approved link that has prices. */
  matched: { productId: string; productName: string; keys: string[]; offersByRetailer: Record<string, number> }[];
  mappedWithoutOffers: { productId: string; productName: string; keys: string[] }[];
  unmatchedCatalog: { productId: string; productName: string; size: string }[];
  unmatchedRecords: { total: number; sample: { productKey: string; productId?: string; name: string; size: string; retailers: number }[] };
  duplicates: { importId: string; entryName: string; count: number }[];
  conflicts: { priceConflicts: { importId: string; entryName: string; count: number }[]; sizeConflicts: SizeConflict[] };
  /** Pending suggestions only (never applied automatically; rejected ones are hidden). */
  suggestions: SuggestionDetail[];
  rejectedCount: number;
  invalidMapEntries: string[];
}

const sizeText = (q: number, u: string) => `${Number(q.toFixed(3))} ${u}`;

/** Repository-wide report: approved / suggested matches, unmatched products, duplicates and conflicting records. */
export async function matchingOverview(): Promise<MatchingOverview> {
  const r = await getPriceRepository();
  const { map, approved, rejected, invalid } = await effectiveMappings();
  const feed = await r.getFeedProducts();
  const imports = await r.listImports();
  const stores = await r.getStores();
  const branches = (await r.listPriceBranches()).map((b) => {
    const s = stores.find((x) => x.retailerId === b.retailerId && x.storeId === b.storeId);
    return { ...b, name: s?.name, city: s?.cityIsCode ? undefined : s?.city };
  });
  const seedById = new Map(SEED_PRODUCTS.map((p) => [p.id, p]));
  const matched: MatchingOverview["matched"] = [];
  const mappedWithoutOffers: MatchingOverview["mappedWithoutOffers"] = [];
  const sizeConflicts: SizeConflict[] = [];
  const offersPerKey = new Map<string, Record<string, number>>();
  for (const p of SEED_PRODUCTS) {
    const keys = map[p.id];
    if (!keys) continue;
    const offers = await r.offersByKeys(keys);
    const ok = offers.filter((o) => sameSize(o, p));
    for (const o of offers.filter((x) => !sameSize(x, p))) {
      sizeConflicts.push({ productKey: o.productKey, recordName: o.name, against: "catalog", productId: p.id, productName: p.nameHe, expected: `${p.packageSize * (p.multipack ?? 1)} ${p.packageUnit}`, found: `${o.quantity} ${o.unit}` });
    }
    for (const o of ok) {
      const m = offersPerKey.get(o.productKey) ?? {};
      m[o.retailerId] = (m[o.retailerId] ?? 0) + 1;
      offersPerKey.set(o.productKey, m);
    }
    if (ok.length) {
      const offersByRetailer: Record<string, number> = {};
      for (const o of ok) offersByRetailer[o.retailerId] = (offersByRetailer[o.retailerId] ?? 0) + 1;
      matched.push({ productId: p.id, productName: `${p.nameHe} ${p.brand}`, keys, offersByRetailer });
    } else mappedWithoutOffers.push({ productId: p.id, productName: `${p.nameHe} ${p.brand}`, keys });
  }
  const mappedKeys = invertMap(map);
  const unmatchedKeys = Object.values(feed).filter((f) => !mappedKeys.has(f.productKey));
  const sampleKeys = unmatchedKeys.slice(0, 200);
  const offersForSample = await r.offersByKeys(sampleKeys.map((f) => f.productKey));
  for (const f of sampleKeys) {
    for (const o of offersForSample.filter((x) => x.productKey === f.productKey && !sameSize(x, f))) {
      sizeConflicts.push({ productKey: f.productKey, recordName: o.name, against: "feed", productId: keyToProductId(f.productKey) ?? f.productKey, productName: f.name, expected: `${f.quantity} ${f.unit}`, found: `${o.quantity} ${o.unit}` });
    }
  }
  const recent = imports.slice(-100);
  const duplicates: MatchingOverview["duplicates"] = [];
  const priceConflicts: MatchingOverview["conflicts"]["priceConflicts"] = [];
  for (const b of recent) {
    const issues = await r.getImportIssues(b.id);
    const dup = issues.filter((i) => i.code === "duplicate_record" || i.code === "duplicate_promotion" || i.code === "duplicate_store").length;
    const conf = issues.filter((i) => i.code === "conflicting_record").length;
    if (dup) duplicates.push({ importId: b.id, entryName: b.entryName, count: dup });
    if (conf) priceConflicts.push({ importId: b.id, entryName: b.entryName, count: conf });
  }
  const raw = matchRecords(unmatchedKeys.slice(0, 5000).map((f) => ({ ...f })), SEED_PRODUCTS, map, {})
    .suggestions.filter((s) => !rejected.has(`${s.productId}|${s.productKey}`))
    .slice(0, 100);
  const sugOffers = await r.offersByKeys([...new Set(raw.map((s) => s.productKey))]);
  const suggestions: SuggestionDetail[] = raw.map((s) => {
    const p = seedById.get(s.productId)!;
    const f = feed[s.productKey];
    const offers = sugOffers.filter((o) => o.productKey === s.productKey);
    const prices = offers.map((o) => o.price);
    return {
      ...s,
      productName: p.nameHe,
      productBrand: p.brand,
      productSize: sizeText(p.packageSize * (p.multipack ?? 1), p.packageUnit),
      recordManufacturer: f?.manufacturer,
      recordSize: f ? sizeText(f.quantity, f.unit) : "",
      retailers: [...new Set(offers.map((o) => o.retailerId))],
      priceRange: prices.length ? [Math.min(...prices), Math.max(...prices)] : undefined,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    repository: r.kind,
    imports: imports.length,
    branches,
    approved: approved.map((a) => ({ ...a, productName: seedById.get(a.productId) ? `${seedById.get(a.productId)!.nameHe} ${seedById.get(a.productId)!.brand}` : a.productId, offersByRetailer: offersPerKey.get(a.key) ?? {} })),
    matched,
    mappedWithoutOffers,
    unmatchedCatalog: SEED_PRODUCTS.filter((p) => !map[p.id]).map((p) => ({ productId: p.id, productName: `${p.nameHe} ${p.brand}`, size: sizeText(p.packageSize * (p.multipack ?? 1), p.packageUnit) })),
    unmatchedRecords: {
      total: unmatchedKeys.length,
      sample: sampleKeys.slice(0, 100).map((f) => ({
        productKey: f.productKey,
        productId: keyToProductId(f.productKey),
        name: f.name,
        size: `${f.quantity} ${f.unit}`,
        retailers: new Set(offersForSample.filter((o) => o.productKey === f.productKey).map((o) => o.retailerId)).size,
      })),
    },
    duplicates,
    conflicts: { priceConflicts, sizeConflicts: sizeConflicts.slice(0, 200) },
    suggestions,
    rejectedCount: rejected.size,
    invalidMapEntries: invalid,
  };
}

export type MappingAction = "approve" | "reject" | "unlink";

/**
 * Records a reviewed decision. "approve" links a catalog product to a verified identifier (refusing package-size
 * mismatches and identifiers already linked elsewhere); "reject" dismisses a suggestion; "unlink" removes an
 * approved link (from the file or the database). Decisions are stored in the repository, i.e. the database in
 * production, so they survive redeploys.
 */
export async function decideMapping(
  productId: string,
  identifier: string,
  action: MappingAction,
  by: MappingDecision["decidedBy"],
): Promise<{ ok: boolean; message: string }> {
  assertWritable();
  const product = SEED_PRODUCTS.find((p) => p.id === productId);
  if (!product) return { ok: false, message: "מוצר קטלוג לא נמצא" };
  const key = normalizeMapKey(identifier);
  if (!key) return { ok: false, message: "מזהה לא תקין: נדרש ברקוד GTIN תקין או קוד פנימי בפורמט i:<רשת>:<קוד>" };
  const r = await getPriceRepository();
  const decidedAt = new Date().toISOString();
  if (action !== "approve") {
    await r.saveMappingDecision({ productId, key, status: "rejected", decidedAt, decidedBy: by });
    return { ok: true, message: action === "unlink" ? "הקישור הוסר" : "ההצעה נדחתה ולא תוצג שוב" };
  }
  const feed = (await r.getFeedProducts())[key];
  const offers = await r.offersByKeys([key]);
  const observed = feed ?? offers[0];
  if (observed && !sameSize(observed, product)) {
    return { ok: false, message: `גודל האריזה שונה: בקטלוג ${product.packageSize * (product.multipack ?? 1)} ${product.packageUnit}, בקובץ ${observed.quantity} ${observed.unit} – לא ניתן לקשר וריאנטים שונים` };
  }
  const { map } = await effectiveMappings();
  const owner = invertMap(map).get(key);
  if (owner && owner !== productId) return { ok: false, message: `המזהה כבר מקושר למוצר ${owner}` };
  await r.saveMappingDecision({ productId, key, status: "approved", decidedAt, decidedBy: by });
  return { ok: true, message: observed ? "קושר ונבדק מול גודל האריזה בקובץ" : "קושר (טרם נמצאו רשומות עם מזהה זה)" };
}

/** Backwards-compatible helper: link (identifier) or unlink all links (null). */
export async function setCatalogMapping(productId: string, identifier: string | null, by: MappingDecision["decidedBy"] = "cli"): Promise<{ ok: boolean; message: string }> {
  if (identifier !== null) return decideMapping(productId, identifier, "approve", by);
  const { map } = await effectiveMappings();
  const keys = map[productId] ?? [];
  if (!keys.length) return { ok: false, message: "אין קישור להסרה" };
  for (const k of keys) await decideMapping(productId, k, "unlink", by);
  return { ok: true, message: "הקישור הוסר" };
}
