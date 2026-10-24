import type { PackageUnit } from "@/lib/types";
import type { FileKind } from "../ingest/filename";
import type { PublishedAtSource } from "../ingest/analyze";
import type { Issue, PromotionRecord } from "../ingest/records";

export const OFFICIAL_PROVENANCE = "official-price-transparency-file";

/** One imported file (or one entry of an archive). */
export interface ImportBatch {
  id: string;
  fileHash: string;
  uploadName: string;
  entryName: string;
  kind: FileKind;
  retailerId: string;
  chainId?: string;
  subChainId?: string;
  storeId?: string;
  publishedAt: string;
  publishedAtSource: PublishedAtSource;
  importedAt: string;
  importedBy: "cli" | "admin-web";
  provenance: typeof OFFICIAL_PROVENANCE;
  counts: { total: number; valid: number; errors: number; warnings: number };
  applied: ApplyStats;
}

export interface ApplyStats {
  written: number;
  unchanged: number;
  skippedOlder: number;
  removed: number;
}

export interface StoredOffer {
  productKey: string;
  itemCode: string;
  barcode?: string;
  name: string;
  manufacturer?: string;
  quantity: number;
  unit: PackageUnit;
  isWeighted: boolean;
  price: number;
  unitOfMeasurePrice?: number;
  priceChangedAt?: string;
  publishedAt: string;
  importId: string;
  sourceFile: string;
  importedAt: string;
}

export interface BranchSnapshot {
  retailerId: string;
  storeId: string;
  chainId?: string;
  subChainId?: string;
  lastFullPublishedAt?: string;
  offers: Record<string, StoredOffer>;
}

export interface StoredPromotion extends PromotionRecord {
  retailerId: string;
  storeId: string;
  publishedAt: string;
  importId: string;
  sourceFile: string;
}

export interface PromoSnapshot {
  retailerId: string;
  storeId: string;
  lastFullPublishedAt?: string;
  promotions: Record<string, StoredPromotion>;
}

export interface StoredBranch {
  retailerId: string;
  storeId: string;
  subChainId?: string;
  chainId?: string;
  name?: string;
  address?: string;
  city?: string;
  cityIsCode: boolean;
  zipCode?: string;
  publishedAt: string;
  importId: string;
  sourceFile: string;
}

/** Product identity learned from price files, keyed by productKey (first observation wins). */
export interface FeedProduct {
  productKey: string;
  barcode?: string;
  internalRetailerId?: string;
  itemCode: string;
  name: string;
  manufacturer?: string;
  quantity: number;
  unit: PackageUnit;
  isWeighted: boolean;
  firstSeenImportId: string;
  firstSeenAt: string;
}

export interface OfferWithBranch extends StoredOffer {
  retailerId: string;
  storeId: string;
}

export type PromotionWithBranch = StoredPromotion;

export interface StoredReport {
  importIds: string[];
  createdAt: string;
  report: unknown;
  issues: Issue[];
}

/** Persistence for official price data. Implemented with JSON files (no DB) and PostgreSQL (Prisma). */
export interface PriceRepository {
  readonly kind: "json" | "postgres";
  listImports(): Promise<ImportBatch[]>;
  findImport(fileHash: string, entryName: string): Promise<ImportBatch | undefined>;
  getChainMap(): Promise<Record<string, string>>;
  learnChain(chainId: string, retailerId: string): Promise<void>;
  getFeedProducts(): Promise<Record<string, FeedProduct>>;
  getBranchSnapshot(retailerId: string, storeId: string): Promise<BranchSnapshot | undefined>;
  saveBranchSnapshot(s: BranchSnapshot, newProducts: FeedProduct[]): Promise<void>;
  getPromoSnapshot(retailerId: string, storeId: string): Promise<PromoSnapshot | undefined>;
  savePromoSnapshot(s: PromoSnapshot): Promise<void>;
  saveStores(retailerId: string, stores: StoredBranch[]): Promise<void>;
  getStores(retailerId?: string): Promise<StoredBranch[]>;
  /** Branch ids that have price data (retailerId:storeId). */
  listPriceBranches(): Promise<{ retailerId: string; storeId: string; offers: number; lastFullPublishedAt?: string }[]>;
  offersByKeys(keys: string[]): Promise<OfferWithBranch[]>;
  promotionsByKeys(keys: string[]): Promise<PromotionWithBranch[]>;
  recordImport(batch: ImportBatch, issues: Issue[]): Promise<void>;
  getImportIssues(importId: string): Promise<Issue[]>;
  /** Changes whenever data changes; used to invalidate caches. */
  version(): Promise<string>;
}
