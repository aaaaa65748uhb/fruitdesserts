import { SEED_SAMPLE_PRICES } from "@/data/seed-products";
import { computeUnitPrice } from "@/lib/units";
import type { PriceOffer, Product, ProviderStatus, Retailer } from "@/lib/types";
import type { OfferSource } from "./types";

/** Deterministic 32-bit hash so sample data is stable between runs and servers. */
export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Rounds to typical shelf-price endings (x.90 / x.50 / x.00) so sample data reads naturally. */
function shelfRound(n: number): number {
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac < 0.25) return Math.max(0.9, whole - 0.1);
  if (frac < 0.7) return whole + 0.5;
  return whole + 0.9;
}

/**
 * DEMONSTRATION offers. Every offer is marked `freshness: "sample"` and `sourceProvider: "superil-demo"`,
 * and the UI labels them "נתון לדוגמה". About 1 in 9 product/retailer pairs has no offer on purpose so the
 * missing-offer flows can be exercised.
 */
export class SampleOfferSource implements OfferSource {
  readonly id = "superil-demo";
  constructor(
    private readonly products: Map<string, Product>,
    private readonly retailers: Retailer[],
  ) {}

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      name: "נתוני הדגמה מובנים",
      kind: "prices",
      enabled: true,
      healthy: true,
      freshness: "sample",
      message: "מחירים לדוגמה שנוצרו לצורך פיתוח והדגמה. אינם מחירים אמיתיים.",
    };
  }

  async offersFor(productIds: string[]): Promise<PriceOffer[]> {
    const out: PriceOffer[] = [];
    for (const productId of productIds) {
      const product = this.products.get(productId);
      const base = SEED_SAMPLE_PRICES[productId];
      if (!product || base === undefined) continue;
      for (const r of this.retailers) {
        const h = hash32(`${productId}|${r.id}`);
        if (h % 9 === 0) continue; // deliberately missing
        const factor = 0.86 + ((h >>> 8) % 1000) / 1000 * 0.28; // 0.86 – 1.14
        const price = shelfRound(base * factor);
        const unit = computeUnitPrice(price, product);
        out.push({
          id: `sample:${r.id}:${productId}`,
          productId,
          retailerId: r.id,
          price,
          unitPrice: unit?.unitPrice,
          unitPriceBasis: unit?.basis,
          currency: "ILS",
          availability: "unknown",
          sourceProvider: this.id,
          freshness: "sample",
          matchConfidence: 1,
        });
      }
    }
    return out;
  }
}
