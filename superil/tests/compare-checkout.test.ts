import { describe, expect, it } from "vitest";
import { RETAILERS, RETAILER_BY_ID } from "@/data/retailers";
import { SEED_PRODUCTS } from "@/data/seed-products";
import { buildCheckoutHandoff, safeExternalUrl } from "@/lib/checkout";
import { compareBasket, linePrice, sortOffers } from "@/lib/compare";
import { effectiveFreshness } from "@/lib/freshness";
import type { PriceOffer, Retailer } from "@/lib/types";

const offer = (p: Partial<PriceOffer> & Pick<PriceOffer, "productId" | "retailerId" | "price">): PriceOffer => ({
  id: `${p.retailerId}:${p.productId}`,
  currency: "ILS",
  availability: "unknown",
  sourceProvider: "test",
  freshness: "cached",
  matchConfidence: 1,
  lastVerifiedAt: new Date().toISOString(),
  ...p,
});
const R = (id: string, extra: Partial<Retailer> = {}): Retailer => ({ ...RETAILER_BY_ID.shufersal, id, nameHe: id, ...extra });

describe("offer sorting", () => {
  const offers = [
    offer({ productId: "a", retailerId: "x", price: 10, unitPrice: 1 }),
    offer({ productId: "a", retailerId: "y", price: 8, unitPrice: 2 }),
    offer({ productId: "a", retailerId: "z", price: 1, freshness: "unavailable" }),
  ];
  it("sorts by total price with unusable offers last", () => {
    expect(sortOffers(offers, "price").map((o) => o.retailerId)).toEqual(["y", "x", "z"]);
  });
  it("sorts by unit price", () => {
    expect(sortOffers(offers, "unitPrice").map((o) => o.retailerId)).toEqual(["x", "y", "z"]);
  });
  it("applies only verified promotions whose conditions are met", () => {
    const promo = offer({ productId: "a", retailerId: "x", price: 10, promotion: { description: "2 ב-15", promoPrice: 7.5, minQuantity: 2, verified: true } });
    expect(linePrice(promo, 1)).toBe(10);
    expect(linePrice(promo, 2)).toBe(15);
    const unverified = { ...promo, promotion: { ...promo.promotion!, verified: false } };
    expect(linePrice(unverified, 2)).toBe(20);
  });
});

describe("basket comparison", () => {
  const retailers = [R("a"), R("b"), R("c", { deliveryFee: 30 })];
  const offersByProduct = {
    p1: [offer({ productId: "p1", retailerId: "a", price: 5 }), offer({ productId: "p1", retailerId: "b", price: 4 }), offer({ productId: "p1", retailerId: "c", price: 6 })],
    p2: [offer({ productId: "p2", retailerId: "a", price: 10 }), offer({ productId: "p2", retailerId: "c", price: 9 })],
  };
  const lines = [{ productId: "p1", quantity: 2 }, { productId: "p2", quantity: 1 }];
  const result = compareBasket(lines, offersByProduct, retailers);

  it("computes per-retailer totals with quantities", () => {
    const a = result.baskets.find((b) => b.retailerId === "a")!;
    expect(a.itemsSubtotal).toBe(20);
    expect(a.complete).toBe(true);
  });
  it("never names a retailer with missing items as cheapest", () => {
    const b = result.baskets.find((x) => x.retailerId === "b")!;
    expect(b.itemsSubtotal).toBe(8); // cheapest number, but incomplete
    expect(b.complete).toBe(false);
    expect(b.missingProductIds).toEqual(["p2"]);
    expect(result.cheapestCompleteRetailerId).toBe("a");
    expect(result.potentialSavings).toBe(1); // c: 21 vs a: 20
  });
  it("only estimates a final total when the delivery fee is known", () => {
    expect(result.baskets.find((x) => x.retailerId === "a")!.estimatedFinalTotal).toBeUndefined();
    expect(result.baskets.find((x) => x.retailerId === "c")!.estimatedFinalTotal).toBe(51);
    expect(result.notes.some((n) => n.includes("דמי משלוח"))).toBe(true);
  });
  it("builds a split basket and warns about multiple deliveries", () => {
    expect(result.split.total).toBe(17); // p1@b 8 + p2@c 9
    expect(result.split.retailerIds.sort()).toEqual(["b", "c"]);
    expect(result.notes.some((n) => n.includes("פיצול"))).toBe(true);
  });
  it("handles products with no price anywhere", () => {
    const r = compareBasket([{ productId: "ghost", quantity: 1 }], {}, retailers);
    expect(r.cheapestCompleteRetailerId).toBeUndefined();
    expect(r.split.missingProductIds).toEqual(["ghost"]);
    expect(r.baskets.every((b) => b.freshness === "unavailable")).toBe(true);
  });
  it("flags sample-only comparisons", () => {
    const sample = { p1: [offer({ productId: "p1", retailerId: "a", price: 5, freshness: "sample" })] };
    expect(compareBasket([{ productId: "p1", quantity: 1 }], sample, [R("a")]).dataIsSampleOnly).toBe(true);
  });
});

describe("freshness", () => {
  it("downgrades stale data instead of presenting it as current", () => {
    const now = Date.parse("2026-10-23T12:00:00Z");
    expect(effectiveFreshness("live", "2026-10-23T11:00:00Z", now)).toBe("live");
    expect(effectiveFreshness("live", "2026-10-20T11:00:00Z", now)).toBe("cached");
    expect(effectiveFreshness("cached", "2026-09-01T11:00:00Z", now)).toBe("unavailable");
    expect(effectiveFreshness("cached", undefined, now)).toBe("unavailable");
    expect(effectiveFreshness("sample", undefined, now)).toBe("sample");
  });
});

describe("checkout handoff", () => {
  const products = Object.fromEntries(SEED_PRODUCTS.slice(0, 3).map((p) => [p.id, p]));
  const [p1, p2, p3] = SEED_PRODUCTS;
  const offers = { [p1.id]: [offer({ productId: p1.id, retailerId: "shufersal", price: 5 })], [p2.id]: [offer({ productId: p2.id, retailerId: "rami-levy", price: 9 })] };
  const h = buildCheckoutHandoff(RETAILER_BY_ID.shufersal, [{ productId: p1.id, quantity: 3 }, { productId: p2.id, quantity: 1 }, { productId: p3.id, quantity: 1 }], products, offers);

  it("separates matched and missing products for the chosen retailer", () => {
    expect(h.matched.map((l) => l.productId)).toEqual([p1.id]);
    expect(h.missing.map((l) => l.productId)).toEqual([p2.id, p3.id]);
    expect(h.knownSubtotal).toBe(15);
  });
  it("points only to the retailer's official https site and explains manual transfer", () => {
    expect(h.destinationUrl).toBe("https://www.shufersal.co.il/");
    expect(h.integration).toBe("homepage_handoff");
    expect(h.instructions.join(" ")).toContain("להוסיף את המוצרים מחדש");
    expect(h.checklistText).toContain("3 × ");
    expect(h.whatsappUrl.startsWith("https://wa.me/?text=")).toBe(true);
  });
  it("rejects non-https destinations", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("http://example.com")).toBeUndefined();
    const bad = buildCheckoutHandoff({ ...RETAILERS[0], homepageUrl: "javascript:alert(1)" }, [], {}, {});
    expect(bad.destinationUrl).toBe("about:blank");
  });
  it("every retailer in the directory has a safe https homepage", () => {
    for (const r of RETAILERS) expect(safeExternalUrl(r.homepageUrl)).toBeDefined();
  });
});
