import type { PriceRecord, PromotionRecord } from "../ingest/records";
import type { ApplyStats, BranchSnapshot, ImportBatch, PromoSnapshot, StoredOffer, StoredPromotion } from "./types";

/**
 * Applies a price file to a branch snapshot.
 * - Full files (PriceFull) replace the branch's assortment, unless a full file published at the same time or
 *   later was already applied. Offers from update files that are newer than the full file are kept.
 * - Update files (Price) change only the records they contain, and only when they are newer than what is stored.
 * Re-applying the same file changes nothing, so repeated imports never create duplicates.
 */
export function mergePriceSnapshot(
  current: BranchSnapshot | undefined,
  records: PriceRecord[],
  batch: Pick<ImportBatch, "id" | "kind" | "retailerId" | "storeId" | "chainId" | "subChainId" | "publishedAt" | "entryName" | "importedAt">,
): { snapshot: BranchSnapshot; stats: ApplyStats } {
  const stats: ApplyStats = { written: 0, unchanged: 0, skippedOlder: 0, removed: 0 };
  const snapshot: BranchSnapshot = current
    ? { ...current, offers: { ...current.offers } }
    : { retailerId: batch.retailerId, storeId: batch.storeId!, chainId: batch.chainId, subChainId: batch.subChainId, offers: {} };
  const isFull = batch.kind === "price_full";
  if (isFull && snapshot.lastFullPublishedAt && snapshot.lastFullPublishedAt >= batch.publishedAt) {
    stats.skippedOlder = records.length;
    return { snapshot: current ?? snapshot, stats };
  }
  const toOffer = (r: PriceRecord): StoredOffer => ({
    productKey: r.productKey,
    itemCode: r.itemCode,
    barcode: r.barcode,
    name: r.name,
    manufacturer: r.manufacturer,
    quantity: r.quantity,
    unit: r.unit,
    isWeighted: r.isWeighted,
    price: r.price,
    unitOfMeasurePrice: r.unitOfMeasurePrice,
    priceChangedAt: r.priceChangedAt,
    publishedAt: batch.publishedAt,
    importId: batch.id,
    sourceFile: batch.entryName,
    importedAt: batch.importedAt,
  });
  const incoming = new Set(records.map((r) => r.productKey));
  for (const r of records) {
    const prev = snapshot.offers[r.productKey];
    if (prev && prev.publishedAt > batch.publishedAt) {
      stats.skippedOlder++;
      continue;
    }
    if (prev && prev.publishedAt === batch.publishedAt && prev.price === r.price && prev.quantity === r.quantity && prev.unit === r.unit) {
      stats.unchanged++;
      continue;
    }
    snapshot.offers[r.productKey] = toOffer(r);
    stats.written++;
  }
  if (isFull) {
    for (const [key, o] of Object.entries(snapshot.offers)) {
      if (!incoming.has(key) && o.publishedAt <= batch.publishedAt) {
        delete snapshot.offers[key];
        stats.removed++;
      }
    }
    snapshot.lastFullPublishedAt = batch.publishedAt;
  }
  return { snapshot, stats };
}

export function mergePromoSnapshot(
  current: PromoSnapshot | undefined,
  records: PromotionRecord[],
  batch: Pick<ImportBatch, "id" | "kind" | "retailerId" | "storeId" | "publishedAt" | "entryName">,
): { snapshot: PromoSnapshot; stats: ApplyStats } {
  const stats: ApplyStats = { written: 0, unchanged: 0, skippedOlder: 0, removed: 0 };
  const snapshot: PromoSnapshot = current
    ? { ...current, promotions: { ...current.promotions } }
    : { retailerId: batch.retailerId, storeId: batch.storeId!, promotions: {} };
  const isFull = batch.kind === "promo_full";
  if (isFull && snapshot.lastFullPublishedAt && snapshot.lastFullPublishedAt >= batch.publishedAt) {
    stats.skippedOlder = records.length;
    return { snapshot: current ?? snapshot, stats };
  }
  const incoming = new Set(records.map((r) => r.promotionId));
  for (const r of records) {
    const prev = snapshot.promotions[r.promotionId];
    if (prev && prev.publishedAt > batch.publishedAt) {
      stats.skippedOlder++;
      continue;
    }
    if (prev && prev.publishedAt === batch.publishedAt) {
      stats.unchanged++;
      continue;
    }
    const stored: StoredPromotion = { ...r, retailerId: batch.retailerId, storeId: batch.storeId!, publishedAt: batch.publishedAt, importId: batch.id, sourceFile: batch.entryName };
    snapshot.promotions[r.promotionId] = stored;
    stats.written++;
  }
  if (isFull) {
    for (const [id, p] of Object.entries(snapshot.promotions)) {
      if (!incoming.has(id) && p.publishedAt <= batch.publishedAt) {
        delete snapshot.promotions[id];
        stats.removed++;
      }
    }
    snapshot.lastFullPublishedAt = batch.publishedAt;
  }
  return { snapshot, stats };
}
