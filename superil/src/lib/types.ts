// Core domain model. Product identity is kept strictly separate from retailer-specific offers.

export type CategoryId =
  | "snacks"
  | "drinks"
  | "dairy"
  | "dairy-alt"
  | "pasta-rice"
  | "canned-sauces"
  | "breakfast-baking"
  | "bakery"
  | "cleaning-care"
  | "produce"
  | "home"
  | "other";

export type PackageUnit = "g" | "kg" | "ml" | "l" | "unit";

/** How trustworthy the product's identity data is. */
export type ProductProvenance =
  | "curated_demo" // hand-curated demonstration record; details not verified against the manufacturer
  | "price_feed" // created from a retailer's published price-transparency file
  | "external_catalog"; // from an authorized external catalog provider

export type PackagingShape = "box" | "bag" | "bottle" | "can" | "carton" | "jar" | "tub" | "roll" | "loaf" | "produce";

export interface Product {
  id: string;
  nameHe: string;
  nameEn?: string;
  brand: string;
  category: CategoryId;
  /** GTIN/EAN. Only set when it comes from a verifiable source — never invented. */
  barcode?: string;
  packageSize: number;
  packageUnit: PackageUnit;
  /** Number of units in a multipack (e.g. 6 bottles). Defaults to 1. */
  multipack?: number;
  imageUrl?: string;
  imageSource?: string;
  imageLicense?: string;
  manufacturer?: string;
  dietaryTags?: string[];
  productDescription?: string;
  provenance: ProductProvenance;
  /** Visual hints for generated placeholder packaging (not official artwork). */
  packaging: { shape: PackagingShape; color: string; accent: string };
  createdAt: string;
  updatedAt: string;
}

/** Status labels shown to users. Must reflect the underlying data honestly. */
export type FreshnessStatus =
  | "live" // מחיר מאומת – from an official file published recently that passed validation
  | "cached" // מחיר שמור – from an official file, older than the verified window but not stale
  | "stale" // מחיר לא עדכני – too old to rely on; shown with its date, excluded from totals
  | "sample" // נתון לדוגמה – demonstration data, not a real price
  | "unavailable"; // מחיר לא זמין

export type AvailabilityStatus = "in_stock" | "out_of_stock" | "unknown";

export interface Promotion {
  description: string;
  /** Effective price per unit when the promotion applies, if computable. */
  promoPrice?: number;
  minQuantity?: number;
  validUntil?: string;
  /** Only verified promotions are applied to totals. Official-file promotions are never auto-applied. */
  verified: boolean;
  /** For official promotions: current only when dates are valid and now is within them. */
  status?: "active" | "upcoming" | "expired" | "unverified";
  validFrom?: string;
  /** false = club/coupon restricted, undefined = not stated in the file. */
  generalPublic?: boolean;
  promotionId?: string;
  discountedPrice?: number;
}

export interface PriceOffer {
  id: string;
  productId: string;
  retailerId: string;
  branchId?: string;
  price: number;
  /** Price per 100g / 100ml / unit, computed by the server. */
  unitPrice?: number;
  unitPriceBasis?: string;
  currency: "ILS";
  promotion?: Promotion;
  availability: AvailabilityStatus;
  sourceProvider: string;
  sourceUrl?: string;
  lastVerifiedAt?: string;
  freshness: FreshnessStatus;
  /** Confidence that this offer refers to exactly this product (barcode match = 1). */
  matchConfidence: number;
  /** Official-file provenance (absent for sample data). */
  publishedAt?: string;
  importedAt?: string;
  /** PriceUpdateDate from the file: when the retailer last changed this price. */
  priceChangedAt?: string;
  sourceFile?: string;
  importId?: string;
  /** Branch name/city, only when a Stores file supplied them. */
  branchName?: string;
  /** Other promotions found in the promo file for this item (not applied to totals). */
  promotions?: Promotion[];
}

export type IntegrationLevel =
  | "official_api" // tested, authorized API (none yet)
  | "deep_link" // documented product/cart deep links
  | "homepage_handoff" // we can only send the user to the official store + a checklist
  | "none";

export interface Retailer {
  id: string;
  nameHe: string;
  nameEn: string;
  color: string;
  textColor: string;
  homepageUrl: string;
  /** Whether the homepage URL was supplied/verified by the project owner. */
  homepageVerified: boolean;
  onlineShopping: boolean;
  integration: IntegrationLevel;
  /** Delivery fee in ₪ only when officially published and verified. */
  deliveryFee?: number;
  minimumOrder?: number;
  notes?: string;
}

export interface Branch {
  id: string;
  retailerId: string;
  name: string;
  city: string;
  address?: string;
  zipCode?: string;
  source: string;
}

export interface CartLine {
  productId: string;
  quantity: number;
  /** Retailer whose offer the user selected, if any. */
  selectedRetailerId?: string;
  addedAt: number;
}

export interface ProviderStatus {
  id: string;
  name: string;
  kind: "catalog" | "prices" | "checkout";
  enabled: boolean;
  healthy: boolean;
  freshness: FreshnessStatus;
  lastUpdated?: string;
  message: string;
}
