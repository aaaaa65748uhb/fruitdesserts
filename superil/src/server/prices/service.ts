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
import { OFFICIAL_PROVENANCE, type ApplyStats, type FeedProduct, type ImportBatch, type PriceRepository, type StoredBranch } from "./types";

let repo: PriceRepository | undefined;
export async function getPriceRepository(): Promise<PriceRepository> {
  if (repo) return repo;
  if (process.env.DATABASE_URL) {
    const { PrismaPriceRepository } = await import("./prisma-repo");
    repo = new PrismaPriceRepository();
  } else repo = new JsonPriceRepository();
  return repo;
}
/** For tests. */
export function setPriceRepository(r: PriceRepository | undefined) {
  repo = r;
}

export async function readBarcodeMap(file = priceConfig.barcodeMapFile): Promise<{ map: BarcodeMap; invalid: string[] }> {
  try {
    return parseBarcodeMap(JSON.parse(await fs.readFile(file, "utf8")));
  } catch {
    return { map: {}, invalid: [] };
  }
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

/** Parses and validates an upload and reports what an import would do. Writes nothing. */
export async function previewUpload(name: string, bytes: Uint8Array, opts: UploadOptions): Promise<UploadReport> {
  const r = await getPriceRepository();
  const analysis = analyzeUpload(name, bytes, { retailerId: opts.retailerId, publishedAt: opts.publishedAt, chainMap: await r.getChainMap(), now: opts.now, staleAfterMs: priceConfig.staleAfterMs });
  const { map } = await readBarcodeMap();
  const feed = await r.getFeedProducts();
  const entries = await Promise.all(analysis.entries.map((e) => entryReport(e, r, analysis.fileHash, SEED_PRODUCTS, map, feed)));
  return { uploadName: name, fileHash: analysis.fileHash, sizeBytes: analysis.sizeBytes, mode: "preview", repository: r.kind, errors: analysis.errors, entries };
}

/** Imports every entry that has no blockers. Safe to repeat: identical files are detected and merges are idempotent. */
export async function commitUpload(name: string, bytes: Uint8Array, opts: UploadOptions): Promise<UploadReport> {
  const r = await getPriceRepository();
  const now = opts.now ?? Date.now();
  const analysis = analyzeUpload(name, bytes, { retailerId: opts.retailerId, publishedAt: opts.publishedAt, chainMap: await r.getChainMap(), now, staleAfterMs: priceConfig.staleAfterMs });
  const { map } = await readBarcodeMap();
  const mappedKeys = invertMap(map);
  const report: UploadReport = { uploadName: name, fileHash: analysis.fileHash, sizeBytes: analysis.sizeBytes, mode: "commit", repository: r.kind, errors: analysis.errors, entries: [] };

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
    await r.recordImport(batch, e.issues);
    if (batch.chainId) await r.learnChain(batch.chainId, batch.retailerId);
    report.entries.push({ ...er, status: batch.applied.written || batch.applied.removed ? "imported" : "not_applied", applied: batch.applied, importId: batch.id });
  }
  return report;
}

export interface MatchingOverview {
  generatedAt: string;
  repository: "json" | "postgres";
  imports: number;
  branches: { retailerId: string; storeId: string; offers: number; name?: string; city?: string; lastFullPublishedAt?: string }[];
  matched: { productId: string; productName: string; keys: string[]; offersByRetailer: Record<string, number> }[];
  mappedWithoutOffers: { productId: string; productName: string; keys: string[] }[];
  unmatchedCatalog: { productId: string; productName: string }[];
  unmatchedRecords: { total: number; sample: { productKey: string; productId?: string; name: string; size: string; retailers: number }[] };
  duplicates: { importId: string; entryName: string; count: number }[];
  conflicts: { priceConflicts: { importId: string; entryName: string; count: number }[]; sizeConflicts: SizeConflict[] };
  suggestions: Suggestion[];
  invalidMapEntries: string[];
}

/** Repository-wide report: matched / unmatched products, duplicates and conflicting records. */
export async function matchingOverview(): Promise<MatchingOverview> {
  const r = await getPriceRepository();
  const { map, invalid } = await readBarcodeMap();
  const feed = await r.getFeedProducts();
  const imports = await r.listImports();
  const stores = await r.getStores();
  const branches = (await r.listPriceBranches()).map((b) => {
    const s = stores.find((x) => x.retailerId === b.retailerId && x.storeId === b.storeId);
    return { ...b, name: s?.name, city: s?.cityIsCode ? undefined : s?.city };
  });
  const matched: MatchingOverview["matched"] = [];
  const mappedWithoutOffers: MatchingOverview["mappedWithoutOffers"] = [];
  const sizeConflicts: SizeConflict[] = [];
  for (const p of SEED_PRODUCTS) {
    const keys = map[p.id];
    if (!keys) continue;
    const offers = await r.offersByKeys(keys);
    const ok = offers.filter((o) => sameSize(o, p));
    for (const o of offers.filter((x) => !sameSize(x, p))) {
      sizeConflicts.push({ productKey: o.productKey, recordName: o.name, against: "catalog", productId: p.id, productName: p.nameHe, expected: `${p.packageSize * (p.multipack ?? 1)} ${p.packageUnit}`, found: `${o.quantity} ${o.unit}` });
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
  const suggestions = matchRecords(
    unmatchedKeys.slice(0, 5000).map((f) => ({ ...f })),
    SEED_PRODUCTS,
    map,
    {},
  ).suggestions.slice(0, 100);
  return {
    generatedAt: new Date().toISOString(),
    repository: r.kind,
    imports: imports.length,
    branches,
    matched,
    mappedWithoutOffers,
    unmatchedCatalog: SEED_PRODUCTS.filter((p) => !map[p.id]).map((p) => ({ productId: p.id, productName: `${p.nameHe} ${p.brand}` })),
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
    invalidMapEntries: invalid,
  };
}

/** Links (or unlinks) a catalog product to a verified identifier after review. Refuses size mismatches. */
export async function setCatalogMapping(productId: string, identifier: string | null, file = priceConfig.barcodeMapFile): Promise<{ ok: boolean; message: string }> {
  const product = SEED_PRODUCTS.find((p) => p.id === productId);
  if (!product) return { ok: false, message: "מוצר קטלוג לא נמצא" };
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    raw = {};
  }
  if (identifier === null) {
    delete raw[productId];
    await fs.writeFile(file, JSON.stringify(raw, null, 2) + "\n");
    return { ok: true, message: "הקישור הוסר" };
  }
  const key = normalizeMapKey(identifier);
  if (!key) return { ok: false, message: "מזהה לא תקין: נדרש ברקוד GTIN תקין או קוד פנימי בפורמט i:<רשת>:<קוד>" };
  const r = await getPriceRepository();
  const feed = (await r.getFeedProducts())[key];
  const offers = await r.offersByKeys([key]);
  const observed = feed ?? offers[0];
  if (observed && !sameSize(observed, product)) {
    return { ok: false, message: `גודל האריזה שונה: בקטלוג ${product.packageSize * (product.multipack ?? 1)} ${product.packageUnit}, בקובץ ${observed.quantity} ${observed.unit} – לא ניתן לקשר וריאנטים שונים` };
  }
  const { map } = parseBarcodeMap(raw);
  const owner = invertMap(map).get(key);
  if (owner && owner !== productId) return { ok: false, message: `המזהה כבר מקושר למוצר ${owner}` };
  const existing = map[productId] ?? [];
  raw[productId] = [...new Set([...existing, key])];
  await fs.writeFile(file, JSON.stringify(raw, null, 2) + "\n");
  return { ok: true, message: observed ? "קושר ונבדק מול גודל האריזה בקובץ" : "קושר (טרם נמצאו רשומות עם מזהה זה)" };
}
