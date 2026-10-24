import type { Prisma } from "@prisma/client";
import { RETAILER_BY_ID } from "@/data/retailers";
import type { PackageUnit } from "@/lib/types";
import type { Issue, PromotionRecord } from "../ingest/records";
import { prisma } from "../providers/prisma-store";
import type {
  BranchSnapshot,
  FeedProduct,
  ImportBatch,
  OfferWithBranch,
  PriceRepository,
  PromoSnapshot,
  PromotionWithBranch,
  StoredBranch,
  StoredOffer,
  StoredPromotion,
} from "./types";

const iso = (d?: Date | null) => (d ? d.toISOString() : undefined);
const date = (s?: string) => (s ? new Date(s) : undefined);
const CHUNK = 5000;

type PriceRow = Awaited<ReturnType<ReturnType<typeof prisma>["officialPrice"]["findMany"]>>[number];

function toOffer(r: PriceRow): OfferWithBranch {
  return {
    retailerId: r.retailerId,
    storeId: r.storeId,
    productKey: r.productKey,
    itemCode: r.itemCode,
    barcode: r.barcode ?? undefined,
    name: r.name,
    manufacturer: r.manufacturer ?? undefined,
    quantity: r.quantity,
    unit: r.unit as PackageUnit,
    isWeighted: r.isWeighted,
    price: r.price,
    unitOfMeasurePrice: r.unitOfMeasurePrice ?? undefined,
    priceChangedAt: iso(r.priceChangedAt),
    publishedAt: r.publishedAt.toISOString(),
    importId: r.importId,
    sourceFile: r.sourceFile,
    importedAt: r.importedAt.toISOString(),
  };
}

/** PostgreSQL implementation of the price repository (used when DATABASE_URL is set). */
export class PrismaPriceRepository implements PriceRepository {
  readonly kind = "postgres" as const;

  async version() {
    const last = await prisma().importBatch.findFirst({ orderBy: { importedAt: "desc" }, select: { id: true } });
    return last?.id ?? "empty";
  }

  async listImports(): Promise<ImportBatch[]> {
    const rows = await prisma().importBatch.findMany({ orderBy: { importedAt: "asc" } });
    return rows.map((b) => ({
      id: b.id,
      fileHash: b.fileHash,
      uploadName: b.uploadName,
      entryName: b.entryName,
      kind: b.kind as ImportBatch["kind"],
      retailerId: b.retailerId,
      chainId: b.chainId ?? undefined,
      subChainId: b.subChainId ?? undefined,
      storeId: b.storeId ?? undefined,
      publishedAt: b.publishedAt.toISOString(),
      publishedAtSource: b.publishedAtSource as ImportBatch["publishedAtSource"],
      importedAt: b.importedAt.toISOString(),
      importedBy: b.importedBy as ImportBatch["importedBy"],
      provenance: b.provenance as ImportBatch["provenance"],
      counts: b.counts as ImportBatch["counts"],
      applied: b.applied as unknown as ImportBatch["applied"],
    }));
  }

  async findImport(fileHash: string, entryName: string) {
    return (await this.listImports()).find((b) => b.fileHash === fileHash && b.entryName === entryName);
  }

  async getChainMap() {
    const rows = await prisma().chainMapping.findMany();
    return Object.fromEntries(rows.map((r) => [r.chainId, r.retailerId]));
  }

  async learnChain(chainId: string, retailerId: string) {
    await prisma().chainMapping.upsert({ where: { chainId }, update: { retailerId }, create: { chainId, retailerId } });
  }

  async getFeedProducts() {
    const rows = await prisma().feedProduct.findMany();
    return Object.fromEntries(
      rows.map((f) => [
        f.productKey,
        {
          productKey: f.productKey,
          barcode: f.barcode ?? undefined,
          internalRetailerId: f.internalRetailerId ?? undefined,
          itemCode: f.itemCode,
          name: f.name,
          manufacturer: f.manufacturer ?? undefined,
          quantity: f.quantity,
          unit: f.unit as PackageUnit,
          isWeighted: f.isWeighted,
          firstSeenImportId: f.firstSeenImportId,
          firstSeenAt: f.firstSeenAt.toISOString(),
        } satisfies FeedProduct,
      ]),
    );
  }

  async getBranchSnapshot(retailerId: string, storeId: string): Promise<BranchSnapshot | undefined> {
    const state = await prisma().branchPriceState.findUnique({ where: { retailerId_storeId: { retailerId, storeId } } });
    if (!state) return undefined;
    const rows = await prisma().officialPrice.findMany({ where: { retailerId, storeId } });
    const offers: Record<string, StoredOffer> = {};
    for (const r of rows) {
      const o: StoredOffer & { retailerId?: string; storeId?: string } = toOffer(r);
      delete o.retailerId;
      delete o.storeId;
      offers[o.productKey] = o;
    }
    return { retailerId, storeId, chainId: state.chainId ?? undefined, subChainId: state.subChainId ?? undefined, lastFullPublishedAt: iso(state.lastFullPublishedAt), offers };
  }

  async saveBranchSnapshot(s: BranchSnapshot, newProducts: FeedProduct[]) {
    const rows: Prisma.OfficialPriceCreateManyInput[] = Object.values(s.offers).map((o) => ({
      retailerId: s.retailerId,
      storeId: s.storeId,
      productKey: o.productKey,
      itemCode: o.itemCode,
      barcode: o.barcode,
      name: o.name,
      manufacturer: o.manufacturer,
      quantity: o.quantity,
      unit: o.unit,
      isWeighted: o.isWeighted,
      price: o.price,
      unitOfMeasurePrice: o.unitOfMeasurePrice,
      priceChangedAt: date(o.priceChangedAt),
      publishedAt: new Date(o.publishedAt),
      importId: o.importId,
      sourceFile: o.sourceFile,
      importedAt: new Date(o.importedAt),
    }));
    await prisma().$transaction(
      async (tx) => {
        await tx.officialPrice.deleteMany({ where: { retailerId: s.retailerId, storeId: s.storeId } });
        for (let i = 0; i < rows.length; i += CHUNK) await tx.officialPrice.createMany({ data: rows.slice(i, i + CHUNK) });
        await tx.branchPriceState.upsert({
          where: { retailerId_storeId: { retailerId: s.retailerId, storeId: s.storeId } },
          update: { chainId: s.chainId, subChainId: s.subChainId, lastFullPublishedAt: date(s.lastFullPublishedAt) },
          create: { retailerId: s.retailerId, storeId: s.storeId, chainId: s.chainId, subChainId: s.subChainId, lastFullPublishedAt: date(s.lastFullPublishedAt) },
        });
        if (newProducts.length) {
          await tx.feedProduct.createMany({
            skipDuplicates: true,
            data: newProducts.map((f) => ({ ...f, firstSeenAt: new Date(f.firstSeenAt) })),
          });
        }
      },
      { timeout: 120_000 },
    );
  }

  async getPromoSnapshot(retailerId: string, storeId: string): Promise<PromoSnapshot | undefined> {
    const state = await prisma().branchPriceState.findUnique({ where: { retailerId_storeId: { retailerId, storeId } } });
    const rows = await prisma().officialPromotion.findMany({ where: { retailerId, storeId } });
    if (!rows.length && !state?.lastPromoFullAt) return undefined;
    return {
      retailerId,
      storeId,
      lastFullPublishedAt: iso(state?.lastPromoFullAt),
      promotions: Object.fromEntries(rows.map((r) => [r.promotionId, r.data as unknown as StoredPromotion])),
    };
  }

  async savePromoSnapshot(s: PromoSnapshot) {
    await prisma().$transaction(async (tx) => {
      await tx.officialPromotion.deleteMany({ where: { retailerId: s.retailerId, storeId: s.storeId } });
      await tx.officialPromotion.createMany({
        data: Object.values(s.promotions).map((p) => ({
          retailerId: s.retailerId,
          storeId: s.storeId,
          promotionId: p.promotionId,
          productKeys: p.items.map((i) => i.productKey),
          publishedAt: new Date(p.publishedAt),
          data: p as unknown as Prisma.InputJsonValue,
        })),
      });
      await tx.branchPriceState.upsert({
        where: { retailerId_storeId: { retailerId: s.retailerId, storeId: s.storeId } },
        update: { lastPromoFullAt: date(s.lastFullPublishedAt) },
        create: { retailerId: s.retailerId, storeId: s.storeId, lastPromoFullAt: date(s.lastFullPublishedAt) },
      });
    });
  }

  async saveStores(retailerId: string, stores: StoredBranch[]) {
    const r = RETAILER_BY_ID[retailerId];
    if (r) {
      await prisma().retailer.upsert({
        where: { id: r.id },
        update: {},
        create: { id: r.id, nameHe: r.nameHe, nameEn: r.nameEn, homepageUrl: r.homepageUrl, homepageVerified: r.homepageVerified, integration: r.integration },
      });
    }
    for (const s of stores) {
      const id = `${retailerId}:${s.storeId}`;
      const data = {
        retailerId,
        name: s.name ?? `סניף ${s.storeId}`,
        city: s.city ?? "",
        address: s.address,
        zipCode: s.zipCode,
        source: s.sourceFile,
        storeId: s.storeId,
        subChainId: s.subChainId,
        chainId: s.chainId,
        cityIsCode: s.cityIsCode,
        publishedAt: new Date(s.publishedAt),
        importId: s.importId,
      };
      const prev = await prisma().branch.findUnique({ where: { id } });
      if (prev?.publishedAt && prev.publishedAt.toISOString() > s.publishedAt) continue;
      await prisma().branch.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
  }

  async getStores(retailerId?: string): Promise<StoredBranch[]> {
    const rows = await prisma().branch.findMany({ where: { storeId: { not: null }, ...(retailerId ? { retailerId } : {}) } });
    return rows.map((b) => ({
      retailerId: b.retailerId,
      storeId: b.storeId!,
      subChainId: b.subChainId ?? undefined,
      chainId: b.chainId ?? undefined,
      name: b.name,
      address: b.address ?? undefined,
      city: b.city || undefined,
      cityIsCode: b.cityIsCode,
      zipCode: b.zipCode ?? undefined,
      publishedAt: iso(b.publishedAt) ?? "",
      importId: b.importId ?? "",
      sourceFile: b.source,
    }));
  }

  async listPriceBranches() {
    const states = await prisma().branchPriceState.findMany();
    const counts = await prisma().officialPrice.groupBy({ by: ["retailerId", "storeId"], _count: { _all: true } });
    return states
      .map((s) => ({
        retailerId: s.retailerId,
        storeId: s.storeId,
        offers: counts.find((c) => c.retailerId === s.retailerId && c.storeId === s.storeId)?._count._all ?? 0,
        lastFullPublishedAt: iso(s.lastFullPublishedAt),
      }))
      .filter((b) => b.offers > 0);
  }

  async offersByKeys(keys: string[]) {
    if (!keys.length) return [];
    return (await prisma().officialPrice.findMany({ where: { productKey: { in: keys } } })).map(toOffer);
  }

  async promotionsByKeys(keys: string[]): Promise<PromotionWithBranch[]> {
    if (!keys.length) return [];
    const rows = await prisma().officialPromotion.findMany({ where: { productKeys: { hasSome: keys } } });
    return rows.map((r) => r.data as unknown as StoredPromotion & PromotionRecord);
  }

  async recordImport(b: ImportBatch, issues: Issue[]) {
    await prisma().importBatch.create({
      data: {
        ...b,
        publishedAt: new Date(b.publishedAt),
        importedAt: new Date(b.importedAt),
        counts: b.counts,
        applied: b.applied as unknown as Prisma.InputJsonValue,
        issues: issues.slice(0, 5000) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getImportIssues(importId: string) {
    const b = await prisma().importBatch.findUnique({ where: { id: importId }, select: { issues: true } });
    return (b?.issues as unknown as Issue[]) ?? [];
  }
}
