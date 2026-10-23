import { promises as fs } from "fs";
import path from "path";
import { effectiveFreshness } from "@/lib/freshness";
import { computeUnitPrice } from "@/lib/units";
import type { Branch, PriceOffer, Product, ProviderStatus } from "@/lib/types";
import type { FeedItem } from "./price-feed-parser";
import type { LocationQuery, OfferSource } from "./types";

/** Format written by `npm run import:feed`. */
export interface ImportedFeed {
  retailerId: string;
  chainId?: string;
  storeId?: string;
  sourceFile: string;
  importedAt: string;
  items: FeedItem[];
}

export const IMPORTED_DIR = path.join(process.cwd(), "data", "imported");
export const BARCODE_MAP_FILE = path.join(process.cwd(), "data", "barcode-map.json");

export function feedProductId(barcode: string): string {
  return `gtin-${barcode}`;
}

/**
 * Offers and products from price-transparency files imported by the operator.
 * Offers are "cached" (מחיר שמור) with the PriceUpdateDate from the file; they are branch-specific and are
 * never extrapolated to other branches.
 */
export class PriceFeedSource implements OfferSource {
  readonly id = "price-transparency-files";
  private loadedAt = 0;
  private feeds: ImportedFeed[] = [];
  /** seed product id -> barcode, manually reviewed by the operator. */
  private barcodeMap: Record<string, string> = {};

  private async load() {
    if (Date.now() - this.loadedAt < 60_000) return;
    this.loadedAt = Date.now();
    const feeds: ImportedFeed[] = [];
    try {
      for (const f of await fs.readdir(IMPORTED_DIR)) {
        if (!f.endsWith(".json")) continue;
        try {
          feeds.push(JSON.parse(await fs.readFile(path.join(IMPORTED_DIR, f), "utf8")) as ImportedFeed);
        } catch {
          // A corrupt import file must not break the catalog.
        }
      }
    } catch {
      // Directory missing: no imported feeds.
    }
    this.feeds = feeds;
    try {
      this.barcodeMap = JSON.parse(await fs.readFile(BARCODE_MAP_FILE, "utf8"));
    } catch {
      this.barcodeMap = {};
    }
  }

  /** Products that exist only in feeds (not mapped to a curated seed product). */
  async products(): Promise<Product[]> {
    await this.load();
    const mapped = new Set(Object.values(this.barcodeMap));
    const byBarcode = new Map<string, Product>();
    for (const feed of this.feeds) {
      for (const item of feed.items) {
        if (!item.barcode || mapped.has(item.barcode) || byBarcode.has(item.barcode)) continue;
        if (!item.quantity || !item.unit) continue; // cannot represent package size honestly
        byBarcode.set(item.barcode, {
          id: feedProductId(item.barcode),
          nameHe: item.name,
          brand: item.manufacturer ?? "לא צוין",
          category: "other",
          barcode: item.barcode,
          packageSize: item.quantity,
          packageUnit: item.unit,
          manufacturer: item.manufacturer,
          provenance: "price_feed",
          imageSource: "placeholder-generated",
          packaging: { shape: "box", color: "#e2e8f0", accent: "#334155" },
          createdAt: feed.importedAt,
          updatedAt: feed.importedAt,
        });
      }
    }
    return [...byBarcode.values()];
  }

  async barcodeForSeed(productId: string): Promise<string | undefined> {
    await this.load();
    return this.barcodeMap[productId];
  }

  async branches(retailerId?: string): Promise<Branch[]> {
    await this.load();
    const seen = new Map<string, Branch>();
    for (const f of this.feeds) {
      if (!f.storeId || (retailerId && f.retailerId !== retailerId)) continue;
      const id = `${f.retailerId}:${f.storeId}`;
      seen.set(id, {
        id,
        retailerId: f.retailerId,
        name: `סניף ${f.storeId}`,
        city: "לא ידוע",
        source: `קובץ מחירים ${f.sourceFile}`,
      });
    }
    return [...seen.values()];
  }

  async status(): Promise<ProviderStatus> {
    await this.load();
    const items = this.feeds.reduce((n, f) => n + f.items.length, 0);
    const latest = this.feeds.map((f) => f.importedAt).sort().at(-1);
    return {
      id: this.id,
      name: "קבצי שקיפות מחירים (חוק המזון)",
      kind: "prices",
      enabled: true,
      healthy: true,
      freshness: this.feeds.length ? "cached" : "unavailable",
      lastUpdated: latest,
      message: this.feeds.length
        ? `${this.feeds.length} קבצים יובאו, ${items.toLocaleString("he-IL")} פריטים.`
        : "לא יובאו עדיין קבצי מחירים. ראו docs/INTEGRATIONS.md להוראות ייבוא.",
    };
  }

  async offersFor(productIds: string[], location?: LocationQuery): Promise<PriceOffer[]> {
    await this.load();
    if (!this.feeds.length) return [];
    const wanted = new Map<string, string>(); // barcode -> productId
    for (const id of productIds) {
      if (id.startsWith("gtin-")) wanted.set(id.slice(5), id);
      else if (this.barcodeMap[id]) wanted.set(this.barcodeMap[id], id);
    }
    const out: PriceOffer[] = [];
    for (const feed of this.feeds) {
      const branchId = feed.storeId ? `${feed.retailerId}:${feed.storeId}` : undefined;
      if (location?.branchId && branchId !== location.branchId) continue;
      for (const item of feed.items) {
        const productId = item.barcode && wanted.get(item.barcode);
        if (!productId) continue;
        const unit =
          item.quantity && item.unit
            ? computeUnitPrice(item.price, { packageSize: item.quantity, packageUnit: item.unit })
            : undefined;
        const lastVerifiedAt = item.priceUpdateDate ?? feed.importedAt;
        out.push({
          id: `feed:${branchId ?? feed.retailerId}:${item.barcode}`,
          productId,
          retailerId: feed.retailerId,
          branchId,
          price: item.price,
          unitPrice: unit?.unitPrice,
          unitPriceBasis: unit?.basis,
          currency: "ILS",
          availability: "unknown",
          sourceProvider: this.id,
          lastVerifiedAt,
          freshness: effectiveFreshness("cached", lastVerifiedAt),
          matchConfidence: 1,
        });
      }
    }
    return out;
  }
}
