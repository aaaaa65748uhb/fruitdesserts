import type { SearchFilters } from "@/lib/search";
import type { Branch, PriceOffer, Product, ProviderStatus, Retailer } from "@/lib/types";

export interface LocationQuery {
  city?: string;
  zipCode?: string;
  branchId?: string;
}

/** Contract every catalog/price source implements, so sources can be swapped without touching the UI. */
export interface ProductProvider {
  readonly id: string;
  searchProducts(query: string, filters?: SearchFilters, limit?: number): Promise<Product[]>;
  getAllProducts(): Promise<Product[]>;
  getProductById(id: string): Promise<Product | undefined>;
  getProductByBarcode(barcode: string): Promise<Product | undefined>;
  getProductOffers(productId: string, location?: LocationQuery): Promise<PriceOffer[]>;
  getOffersForProducts(productIds: string[], location?: LocationQuery): Promise<Record<string, PriceOffer[]>>;
  getRetailers(): Promise<Retailer[]>;
  getBranches(retailerId?: string, location?: LocationQuery): Promise<Branch[]>;
  getDataFreshness(): Promise<ProviderStatus[]>;
}

/** A source of retailer offers that can be merged into a catalog provider. */
export interface OfferSource {
  readonly id: string;
  status(): Promise<ProviderStatus>;
  offersFor(productIds: string[], location?: LocationQuery): Promise<PriceOffer[]>;
}

export class ProviderError extends Error {
  constructor(
    public readonly providerId: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${providerId}] ${message}`);
  }
}
