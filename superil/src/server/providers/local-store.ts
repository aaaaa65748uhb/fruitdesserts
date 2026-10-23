import { SEED_PRODUCTS } from "@/data/seed-products";
import type { Product, ProviderStatus } from "@/lib/types";
import type { ProductStore } from "./composite";
import type { PriceFeedSource } from "./feed-store";

/** Development catalog: curated seed products + products discovered in imported price files. */
export class LocalProductStore implements ProductStore {
  readonly id = "local-seed";
  constructor(private readonly feed: PriceFeedSource) {}

  async load(): Promise<Product[]> {
    const seed = await Promise.all(
      SEED_PRODUCTS.map(async (p) => {
        const barcode = await this.feed.barcodeForSeed(p.id);
        return barcode ? { ...p, barcode } : p;
      }),
    );
    return [...seed, ...(await this.feed.products())];
  }

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      name: "קטלוג פיתוח מובנה",
      kind: "catalog",
      enabled: true,
      healthy: true,
      freshness: "sample",
      message: `${SEED_PRODUCTS.length} מוצרים לדוגמה. פרטי האריזה לא אומתו מול היצרנים; אין ברקודים מומצאים.`,
    };
  }
}
