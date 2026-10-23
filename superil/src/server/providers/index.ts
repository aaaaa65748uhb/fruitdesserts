import "server-only";
import { RETAILERS } from "@/data/retailers";
import { SEED_PRODUCTS } from "@/data/seed-products";
import { ChpAdapter } from "./chp-adapter";
import { CompositeProvider } from "./composite";
import { PriceFeedSource } from "./feed-store";
import { LocalProductStore } from "./local-store";
import { SampleOfferSource } from "./sample-offers";
import type { ProductProvider } from "./types";

let provider: ProductProvider | undefined;

/**
 * Chooses the active provider:
 * - DATABASE_URL set  → PostgreSQL (Prisma) catalog + offers.
 * - otherwise         → bundled development catalog + sample offers + imported price-transparency files.
 * The CHP adapter is always registered but stays disabled without written authorization.
 */
export async function getProvider(): Promise<ProductProvider> {
  if (provider) return provider;
  if (process.env.DATABASE_URL) {
    const { PrismaProductStore, PrismaOfferSource } = await import("./prisma-store");
    provider = new CompositeProvider(new PrismaProductStore(), [new PrismaOfferSource(), new ChpAdapter()]);
  } else {
    const feed = new PriceFeedSource();
    const sample = new SampleOfferSource(new Map(SEED_PRODUCTS.map((p) => [p.id, p])), RETAILERS);
    provider = new CompositeProvider(new LocalProductStore(feed), [sample, feed, new ChpAdapter()], [feed]);
  }
  return provider;
}
