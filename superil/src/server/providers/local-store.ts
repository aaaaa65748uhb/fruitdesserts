import { SEED_PRODUCTS } from "@/data/seed-products";
import type { Product, ProviderStatus } from "@/lib/types";
import type { ProductStore } from "./composite";
import type { OfficialPriceSource } from "./official-source";

/** Development catalog: curated seed products + products learned from imported official price files. */
export class LocalProductStore implements ProductStore {
  readonly id = "local-seed";
  constructor(private readonly official: OfficialPriceSource) {}

  async load(): Promise<Product[]> {
    const seed = await Promise.all(
      SEED_PRODUCTS.map(async (p) => {
        const barcode = await this.official.barcodeForSeed(p.id);
        return barcode ? { ...p, barcode } : p;
      }),
    );
    return [...seed, ...(await this.official.products())];
  }

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      name: "קטלוג מוצרים",
      kind: "catalog",
      enabled: true,
      healthy: true,
      freshness: "sample",
      message: `קטלוג שנאסף ידנית (פרטי אריזה לא אומתו מול היצרן), בתוספת מוצרים מקבצי מחירים רשמיים כשהם מיובאים.`,
    };
  }
}
