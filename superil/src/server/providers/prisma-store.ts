import { PrismaClient } from "@prisma/client";
import { effectiveFreshness } from "@/lib/freshness";
import type {
  AvailabilityStatus,
  CategoryId,
  FreshnessStatus,
  PackageUnit,
  PackagingShape,
  PriceOffer,
  Product,
  ProductProvenance,
  Promotion,
  ProviderStatus,
} from "@/lib/types";
import type { ProductStore } from "./composite";
import type { LocationQuery, OfferSource } from "./types";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export function prisma(): PrismaClient {
  return (globalForPrisma.prisma ??= new PrismaClient());
}

type DbProduct = Awaited<ReturnType<PrismaClient["product"]["findMany"]>>[number];

export function fromDbProduct(p: DbProduct): Product {
  return {
    id: p.id,
    nameHe: p.nameHe,
    nameEn: p.nameEn ?? undefined,
    brand: p.brand,
    category: p.category as CategoryId,
    barcode: p.barcode ?? undefined,
    packageSize: p.packageSize,
    packageUnit: p.packageUnit as PackageUnit,
    multipack: p.multipack ?? undefined,
    imageUrl: p.imageUrl ?? undefined,
    imageSource: p.imageSource ?? undefined,
    imageLicense: p.imageLicense ?? undefined,
    manufacturer: p.manufacturer ?? undefined,
    dietaryTags: p.dietaryTags.length ? p.dietaryTags : undefined,
    productDescription: p.productDescription ?? undefined,
    provenance: p.provenance as ProductProvenance,
    packaging: { shape: p.packagingShape as PackagingShape, color: p.packagingColor, accent: p.packagingAccent },
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export class PrismaProductStore implements ProductStore {
  readonly id = "postgres";
  async load(): Promise<Product[]> {
    return (await prisma().product.findMany()).map(fromDbProduct);
  }
  async status(): Promise<ProviderStatus> {
    try {
      const count = await prisma().product.count();
      return { id: this.id, name: "מסד נתונים PostgreSQL", kind: "catalog", enabled: true, healthy: true, freshness: "cached", message: `${count} מוצרים במסד הנתונים.` };
    } catch {
      return { id: this.id, name: "מסד נתונים PostgreSQL", kind: "catalog", enabled: true, healthy: false, freshness: "unavailable", message: "אין חיבור למסד הנתונים." };
    }
  }
}

export class PrismaOfferSource implements OfferSource {
  readonly id = "postgres-offers";
  async status(): Promise<ProviderStatus> {
    const count = await prisma().priceOffer.count();
    const latest = await prisma().priceOffer.findFirst({ orderBy: { lastVerifiedAt: "desc" }, where: { lastVerifiedAt: { not: null } } });
    return { id: this.id, name: "הצעות מחיר במסד הנתונים", kind: "prices", enabled: true, healthy: true, freshness: latest ? "cached" : "sample", lastUpdated: latest?.lastVerifiedAt?.toISOString(), message: `${count} הצעות מחיר.` };
  }
  async offersFor(productIds: string[], location?: LocationQuery): Promise<PriceOffer[]> {
    const rows = await prisma().priceOffer.findMany({
      where: { productId: { in: productIds }, ...(location?.branchId ? { OR: [{ branchId: location.branchId }, { branchId: null }] } : {}) },
    });
    return rows.map((o) => {
      const lastVerifiedAt = o.lastVerifiedAt?.toISOString();
      return {
        id: o.id,
        productId: o.productId,
        retailerId: o.retailerId,
        branchId: o.branchId ?? undefined,
        price: o.price,
        unitPrice: o.unitPrice ?? undefined,
        unitPriceBasis: o.unitPriceBasis ?? undefined,
        currency: "ILS",
        promotion: (o.promotionJson as Promotion | null) ?? undefined,
        availability: o.availability as AvailabilityStatus,
        sourceProvider: o.sourceProvider,
        sourceUrl: o.sourceUrl ?? undefined,
        lastVerifiedAt,
        freshness: effectiveFreshness(o.freshness as FreshnessStatus, lastVerifiedAt),
        matchConfidence: o.matchConfidence,
      };
    });
  }
}
