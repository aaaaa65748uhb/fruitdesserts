import { SEED_PRODUCTS } from "@/data/seed-products";
import { freshnessFromPublication } from "@/lib/freshness";
import { computeUnitPrice } from "@/lib/units";
import type { Branch, PriceOffer, Product, Promotion, ProviderStatus } from "@/lib/types";
import { priceConfig } from "../prices/config";
import { keyToProductId, productIdToKey, sameSize, type BarcodeMap } from "../prices/matching";
import { effectiveMappings, getPriceRepository } from "../prices/service";
import type { FeedProduct, PromotionWithBranch, StoredBranch } from "../prices/types";
import type { LocationQuery, OfferSource } from "./types";

const seedById = new Map(SEED_PRODUCTS.map((p) => [p.id, p]));

export function promotionStatus(p: Pick<PromotionWithBranch, "startsAt" | "endsAt">, now = Date.now()): Promotion["status"] {
  if (!p.startsAt || !p.endsAt) return "unverified";
  if (Date.parse(p.startsAt) > now) return "upcoming";
  if (Date.parse(p.endsAt) < now) return "expired";
  return "active";
}

function toPromotion(p: PromotionWithBranch, now: number): Promotion {
  return {
    promotionId: p.promotionId,
    description: p.description ?? `מבצע ${p.promotionId}`,
    minQuantity: p.minQty,
    discountedPrice: p.discountedPrice,
    validFrom: p.startsAt,
    validUntil: p.endsAt,
    generalPublic: p.generalPublic,
    status: promotionStatus(p, now),
    // Promotion files do not state unambiguously whether DiscountedPrice is per unit or per bundle,
    // so official promotions are displayed but never applied to totals.
    verified: false,
  };
}

/**
 * Offers, products and branches from imported official price-transparency files.
 * - Prices are branch-specific; a branch filter never removes other retailers' offers.
 * - Records whose package size differs from the product's size are excluded (never treated as the same item).
 */
export class OfficialPriceSource implements OfferSource {
  readonly id = "official-price-files";
  // Caches are keyed on the repository's data version, so imports and mapping decisions take effect immediately.
  private mapCache?: { version: string; map: BarcodeMap };
  private officialCache?: { version: string; has: boolean };

  private async map() {
    const version = await (await getPriceRepository()).version();
    if (this.mapCache?.version !== version) this.mapCache = { version, map: (await effectiveMappings()).map };
    return this.mapCache.map;
  }

  async hasOfficialData(): Promise<boolean> {
    const repo = await getPriceRepository();
    const version = await repo.version();
    if (this.officialCache?.version !== version) this.officialCache = { version, has: (await repo.listPriceBranches()).length > 0 };
    return this.officialCache.has;
  }

  /** First mapped GTIN of a curated product, for display. */
  async barcodeForSeed(productId: string): Promise<string | undefined> {
    return (await this.map())[productId]?.find((k) => k.startsWith("g:"))?.slice(2);
  }

  async products(): Promise<Product[]> {
    const repo = await getPriceRepository();
    const map = await this.map();
    const mapped = new Set(Object.values(map).flat());
    return Object.values(await repo.getFeedProducts())
      .filter((f) => !mapped.has(f.productKey))
      .map((f) => feedToProduct(f))
      .filter((p): p is Product => !!p);
  }

  async branches(retailerId?: string): Promise<Branch[]> {
    const repo = await getPriceRepository();
    const stores = await repo.getStores(retailerId);
    const withPrices = await repo.listPriceBranches();
    const out = new Map<string, Branch>();
    for (const s of stores) out.set(`${s.retailerId}:${s.storeId}`, storeToBranch(s));
    for (const b of withPrices) {
      if (retailerId && b.retailerId !== retailerId) continue;
      const id = `${b.retailerId}:${b.storeId}`;
      if (!out.has(id)) out.set(id, { id, retailerId: b.retailerId, name: `סניף ${b.storeId}`, city: "", source: "קובץ מחירים (ללא קובץ סניפים)" });
    }
    return [...out.values()];
  }

  /** Public coverage summary: which retailers/branches have official prices and when they were published. */
  async coverage(): Promise<{ retailerId: string; branches: { storeId: string; name?: string; lastPublishedAt?: string }[] }[]> {
    const repo = await getPriceRepository();
    const [branches, stores] = await Promise.all([repo.listPriceBranches(), repo.getStores()]);
    const out = new Map<string, { storeId: string; name?: string; lastPublishedAt?: string }[]>();
    for (const b of branches) {
      const s = stores.find((x) => x.retailerId === b.retailerId && x.storeId === b.storeId);
      const list = out.get(b.retailerId) ?? [];
      list.push({ storeId: b.storeId, name: s ? branchLabel(s) : undefined, lastPublishedAt: b.lastFullPublishedAt });
      out.set(b.retailerId, list);
    }
    return [...out].map(([retailerId, list]) => ({ retailerId, branches: list }));
  }

  async status(): Promise<ProviderStatus> {
    const repo = await getPriceRepository();
    const branches = await repo.listPriceBranches();
    const imports = await repo.listImports();
    const latest = branches.map((b) => b.lastFullPublishedAt).filter(Boolean).sort().at(-1) ?? imports.map((i) => i.publishedAt).sort().at(-1);
    return {
      id: this.id,
      name: "קבצי שקיפות מחירים רשמיים",
      kind: "prices",
      enabled: true,
      healthy: true,
      freshness: branches.length ? freshnessFromPublication(latest, priceConfig.verifiedMaxAgeMs, priceConfig.staleAfterMs) : "unavailable",
      lastUpdated: latest,
      // Public text: coverage only – no file counts or storage details.
      message: branches.length
        ? `מחירים רשמיים זמינים עבור ${new Set(branches.map((b) => b.retailerId)).size} רשתות ו-${branches.length} סניפים. הקבצים מיובאים ידנית – לא בזמן אמת.`
        : "טרם יובאו קבצי מחירים רשמיים.",
    };
  }

  async offersFor(productIds: string[], location?: LocationQuery): Promise<PriceOffer[]> {
    const repo = await getPriceRepository();
    const map = await this.map();
    const feed = await repo.getFeedProducts();
    const keysById = new Map<string, { keys: string[]; ref?: Product | FeedProduct }>();
    for (const id of productIds) {
      const seed = seedById.get(id);
      if (seed) {
        if (map[id]) keysById.set(id, { keys: map[id], ref: seed });
        continue;
      }
      const key = productIdToKey(id);
      if (key) keysById.set(id, { keys: [key], ref: feed[key] });
    }
    const allKeys = [...new Set([...keysById.values()].flatMap((v) => v.keys))];
    if (!allKeys.length) return [];
    const [offers, promos, stores] = await Promise.all([repo.offersByKeys(allKeys), repo.promotionsByKeys(allKeys), repo.getStores()]);
    const storeName = new Map(stores.map((s) => [`${s.retailerId}:${s.storeId}`, branchLabel(s)]));
    const now = Date.now();
    const filterRetailer = location?.branchId?.split(":")[0];
    const out: PriceOffer[] = [];
    for (const [productId, { keys, ref }] of keysById) {
      for (const o of offers) {
        if (!keys.includes(o.productKey)) continue;
        if (ref && !sameSize(o, ref)) continue; // different variant / package size
        const branchId = `${o.retailerId}:${o.storeId}`;
        if (location?.branchId && o.retailerId === filterRetailer && branchId !== location.branchId) continue;
        const unit = computeUnitPrice(o.price, { packageSize: o.quantity, packageUnit: o.unit });
        const branchPromos = promos
          .filter((p) => p.retailerId === o.retailerId && p.storeId === o.storeId && p.items.some((i) => i.productKey === o.productKey && !i.isGift))
          .map((p) => toPromotion(p, now))
          .sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));
        out.push({
          id: `off:${branchId}:${o.productKey}`,
          productId,
          retailerId: o.retailerId,
          branchId,
          branchName: storeName.get(branchId),
          price: o.price,
          unitPrice: unit?.unitPrice,
          unitPriceBasis: unit?.basis,
          currency: "ILS",
          availability: "unknown",
          sourceProvider: this.id,
          lastVerifiedAt: o.publishedAt,
          publishedAt: o.publishedAt,
          importedAt: o.importedAt,
          priceChangedAt: o.priceChangedAt,
          sourceFile: o.sourceFile,
          importId: o.importId,
          freshness: freshnessFromPublication(o.publishedAt, priceConfig.verifiedMaxAgeMs, priceConfig.staleAfterMs, now),
          matchConfidence: 1,
          promotions: branchPromos.length ? branchPromos : undefined,
        });
      }
    }
    return out;
  }
}

export function branchLabel(s: StoredBranch): string | undefined {
  const city = s.city && !s.cityIsCode ? s.city : undefined;
  const parts = [s.name, city].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function storeToBranch(s: StoredBranch): Branch {
  return {
    id: `${s.retailerId}:${s.storeId}`,
    retailerId: s.retailerId,
    name: s.name ?? `סניף ${s.storeId}`,
    city: s.city && !s.cityIsCode ? s.city : "",
    address: s.address,
    zipCode: s.zipCode,
    source: `קובץ סניפים רשמי ${s.sourceFile}`,
  };
}

export function feedToProduct(f: FeedProduct): Product | undefined {
  const id = keyToProductId(f.productKey);
  if (!id) return undefined;
  return {
    id,
    nameHe: f.name,
    brand: f.manufacturer ?? "לא צוין",
    category: "other",
    barcode: f.barcode,
    packageSize: f.quantity,
    packageUnit: f.unit,
    manufacturer: f.manufacturer,
    productDescription: f.barcode ? undefined : "קוד פנימי של הרשת – ההשוואה אפשרית רק בתוך אותה רשת.",
    provenance: "price_feed",
    imageSource: "placeholder-generated",
    packaging: { shape: f.isWeighted ? "produce" : "box", color: "#e2e8f0", accent: "#334155" },
    createdAt: f.firstSeenAt,
    updatedAt: f.firstSeenAt,
  };
}
