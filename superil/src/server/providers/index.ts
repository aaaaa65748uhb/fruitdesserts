import "server-only";
import { RETAILERS } from "@/data/retailers";
import { SEED_PRODUCTS } from "@/data/seed-products";
import type { PriceOffer, Product, ProviderStatus } from "@/lib/types";
import { priceConfig } from "../prices/config";
import { ChpAdapter } from "./chp-adapter";
import { CompositeProvider, type ProductStore } from "./composite";
import { LocalProductStore } from "./local-store";
import { OfficialPriceSource } from "./official-source";
import { SampleOfferSource } from "./sample-offers";
import type { LocationQuery, OfferSource, ProductProvider } from "./types";

let provider: ProductProvider | undefined;
let official: OfficialPriceSource | undefined;

export function getOfficialSource(): OfficialPriceSource {
  return (official ??= new OfficialPriceSource());
}

export type PriceMode = "official" | "sample" | "mixed" | "none";

/** Which kind of prices the site is currently showing (drives banners and labels). */
export async function getPriceMode(): Promise<PriceMode> {
  const hasOfficial = await getOfficialSource().hasOfficialData();
  const sample = samplePricesEnabled(hasOfficial);
  if (hasOfficial && sample) return "mixed";
  if (hasOfficial) return "official";
  return sample ? "sample" : "none";
}

function samplePricesEnabled(hasOfficial: boolean) {
  const mode = priceConfig.samplePrices;
  return mode === "on" || (mode === "auto" && !hasOfficial);
}

/**
 * Sample (demonstration) offers are switched off automatically once any official price file has been imported
 * (SAMPLE_PRICES=auto), so sample prices are never shown alongside, or mistaken for, real prices.
 */
class GatedSampleSource implements OfferSource {
  readonly id: string;
  constructor(private readonly inner: OfferSource) {
    this.id = inner.id;
  }
  async status(): Promise<ProviderStatus> {
    const s = await this.inner.status();
    const on = samplePricesEnabled(await getOfficialSource().hasOfficialData());
    return on ? s : { ...s, enabled: false, message: "כבוי – יובאו מחירים רשמיים (SAMPLE_PRICES=auto)." };
  }
  async offersFor(ids: string[], location?: LocationQuery): Promise<PriceOffer[]> {
    if (!samplePricesEnabled(await getOfficialSource().hasOfficialData())) return [];
    return (await this.inner.offersFor(ids, location)).filter((o) => o.freshness === "sample");
  }
}

class MergedStore implements ProductStore {
  readonly id: string;
  constructor(private readonly base: ProductStore, private readonly extra: () => Promise<Product[]>) {
    this.id = base.id;
  }
  async load() {
    const off = getOfficialSource();
    const base = await Promise.all(
      (await this.base.load()).map(async (p) => {
        const barcode = p.barcode ?? (await off.barcodeForSeed(p.id));
        return barcode ? { ...p, barcode } : p;
      }),
    );
    const ids = new Set(base.map((p) => p.id));
    return [...base, ...(await this.extra()).filter((p) => !ids.has(p.id))];
  }
  status() {
    return this.base.status();
  }
}

/**
 * Chooses the active provider:
 * - DATABASE_URL set  → PostgreSQL catalog; official prices in PostgreSQL tables.
 * - otherwise         → bundled catalog; official prices in the JSON store (data/imported).
 * Sample offers are gated (see above). The CHP adapter stays disabled without written authorization.
 */
export async function getProvider(): Promise<ProductProvider> {
  if (provider) return provider;
  const off = getOfficialSource();
  if (process.env.DATABASE_URL) {
    const { PrismaProductStore } = await import("./prisma-store");
    const store = new MergedStore(new PrismaProductStore(), () => off.products());
    const sample = new SampleOfferSource(new Map(SEED_PRODUCTS.map((p) => [p.id, p])), RETAILERS);
    provider = new CompositeProvider(store, [off, new GatedSampleSource(sample), new ChpAdapter()], [off]);
  } else {
    const sample = new SampleOfferSource(new Map(SEED_PRODUCTS.map((p) => [p.id, p])), RETAILERS);
    provider = new CompositeProvider(new LocalProductStore(off), [off, new GatedSampleSource(sample), new ChpAdapter()], [off]);
  }
  return provider;
}
