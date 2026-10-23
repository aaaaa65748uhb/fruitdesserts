import { RETAILERS } from "@/data/retailers";
import { searchProducts, type SearchFilters } from "@/lib/search";
import type { Branch, PriceOffer, Product, ProviderStatus, Retailer } from "@/lib/types";
import type { LocationQuery, OfferSource, ProductProvider } from "./types";

export interface ProductStore {
  readonly id: string;
  load(): Promise<Product[]>;
  status(): Promise<ProviderStatus>;
  branches?(retailerId?: string): Promise<Branch[]>;
}

/** Merges one product store with any number of offer sources. Failing sources degrade gracefully. */
export class CompositeProvider implements ProductProvider {
  readonly id: string;
  private cache?: { at: number; products: Product[]; byId: Map<string, Product> };

  constructor(
    private readonly store: ProductStore,
    private readonly offerSources: OfferSource[],
    private readonly branchSources: { branches(retailerId?: string): Promise<Branch[]> }[] = [],
  ) {
    this.id = `composite:${store.id}`;
  }

  private async catalog() {
    if (!this.cache || Date.now() - this.cache.at > 60_000) {
      const products = await this.store.load();
      this.cache = { at: Date.now(), products, byId: new Map(products.map((p) => [p.id, p])) };
    }
    return this.cache;
  }

  async getAllProducts() {
    return (await this.catalog()).products;
  }

  async searchProducts(query: string, filters?: SearchFilters, limit = 50) {
    return searchProducts((await this.catalog()).products, query, filters, limit).map((h) => h.product);
  }

  async getProductById(id: string) {
    return (await this.catalog()).byId.get(id);
  }

  async getProductByBarcode(barcode: string) {
    return (await this.catalog()).products.find((p) => p.barcode === barcode);
  }

  async getProductOffers(productId: string, location?: LocationQuery) {
    return (await this.getOffersForProducts([productId], location))[productId] ?? [];
  }

  async getOffersForProducts(productIds: string[], location?: LocationQuery) {
    const results = await Promise.allSettled(this.offerSources.map((s) => s.offersFor(productIds, location)));
    const out: Record<string, PriceOffer[]> = Object.fromEntries(productIds.map((id) => [id, []]));
    for (const r of results) {
      if (r.status !== "fulfilled") continue; // provider failure: other sources still answer
      for (const o of r.value) (out[o.productId] ??= []).push(o);
    }
    return out;
  }

  async getRetailers(): Promise<Retailer[]> {
    return RETAILERS;
  }

  async getBranches(retailerId?: string, location?: LocationQuery): Promise<Branch[]> {
    const lists = await Promise.allSettled(this.branchSources.map((s) => s.branches(retailerId)));
    const all = lists.flatMap((l) => (l.status === "fulfilled" ? l.value : []));
    const city = location?.city?.trim();
    const zip = location?.zipCode?.trim();
    return all.filter((b) => (!city || b.city.includes(city)) && (!zip || b.zipCode === zip));
  }

  async getDataFreshness(): Promise<ProviderStatus[]> {
    const statuses = await Promise.allSettled([this.store.status(), ...this.offerSources.map((s) => s.status())]);
    return statuses.map((s, i) =>
      s.status === "fulfilled"
        ? s.value
        : {
            id: i === 0 ? this.store.id : this.offerSources[i - 1].id,
            name: i === 0 ? this.store.id : this.offerSources[i - 1].id,
            kind: "prices" as const,
            enabled: true,
            healthy: false,
            freshness: "unavailable" as const,
            message: "הספק אינו זמין כרגע.",
          },
    );
  }
}
