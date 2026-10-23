import { FRESHNESS_RANK } from "./freshness";
import { roundMoney } from "./format";
import type { FreshnessStatus, PriceOffer, Retailer } from "./types";

export type OfferSort = "price" | "unitPrice";

/** Offers that may be used in calculations: priced and not marked unavailable or out of stock. */
export function isUsableOffer(o: PriceOffer): boolean {
  return o.freshness !== "unavailable" && o.availability !== "out_of_stock" && Number.isFinite(o.price) && o.price >= 0;
}

export function sortOffers(offers: PriceOffer[], by: OfferSort): PriceOffer[] {
  const key = (o: PriceOffer) => (by === "unitPrice" ? o.unitPrice ?? Number.POSITIVE_INFINITY : o.price);
  return [...offers].sort((a, b) => {
    const ua = isUsableOffer(a) ? 0 : 1;
    const ub = isUsableOffer(b) ? 0 : 1;
    if (ua !== ub) return ua - ub; // unusable offers always last
    return key(a) - key(b) || FRESHNESS_RANK[a.freshness] - FRESHNESS_RANK[b.freshness];
  });
}

/** Line price for a quantity, applying a promotion only when it is verified and its conditions are met. */
export function linePrice(offer: PriceOffer, quantity: number): number {
  const promo = offer.promotion;
  if (promo?.verified && promo.promoPrice !== undefined && quantity >= (promo.minQuantity ?? 1)) {
    return roundMoney(promo.promoPrice * quantity);
  }
  return roundMoney(offer.price * quantity);
}

export interface BasketLineInput {
  productId: string;
  quantity: number;
}

export interface RetailerBasket {
  retailerId: string;
  itemsSubtotal: number;
  pricedItems: number;
  missingProductIds: string[];
  /** Worst data freshness among the offers used. */
  freshness: FreshnessStatus;
  deliveryFee?: number;
  minimumOrder?: number;
  meetsMinimumOrder?: boolean;
  /** Only set when every item is priced AND the delivery fee is known. */
  estimatedFinalTotal?: number;
  complete: boolean;
  lines: { productId: string; quantity: number; offerId: string; unitPrice: number; subtotal: number }[];
}

export interface BasketComparison {
  baskets: RetailerBasket[];
  /** Cheapest retailer among complete baskets only; undefined when no basket is complete. */
  cheapestCompleteRetailerId?: string;
  /** Savings of the cheapest complete basket vs the most expensive complete basket (items only). */
  potentialSavings?: number;
  split: SplitBasket;
  dataIsSampleOnly: boolean;
  notes: string[];
}

export interface SplitBasket {
  total: number;
  retailerIds: string[];
  missingProductIds: string[];
  lines: { productId: string; quantity: number; retailerId: string; offerId: string; subtotal: number }[];
}

function worse(a: FreshnessStatus, b: FreshnessStatus): FreshnessStatus {
  return FRESHNESS_RANK[a] >= FRESHNESS_RANK[b] ? a : b;
}

export function compareBasket(
  lines: BasketLineInput[],
  offersByProduct: Record<string, PriceOffer[]>,
  retailers: Retailer[],
): BasketComparison {
  const valid = lines.filter((l) => l.quantity > 0);
  const baskets: RetailerBasket[] = retailers.map((r) => {
    const basket: RetailerBasket = {
      retailerId: r.id,
      itemsSubtotal: 0,
      pricedItems: 0,
      missingProductIds: [],
      freshness: "live",
      deliveryFee: r.deliveryFee,
      minimumOrder: r.minimumOrder,
      complete: false,
      lines: [],
    };
    for (const line of valid) {
      const best = sortOffers(
        (offersByProduct[line.productId] ?? []).filter((o) => o.retailerId === r.id && isUsableOffer(o)),
        "price",
      )[0];
      if (!best) {
        basket.missingProductIds.push(line.productId);
        continue;
      }
      const subtotal = linePrice(best, line.quantity);
      basket.itemsSubtotal = roundMoney(basket.itemsSubtotal + subtotal);
      basket.pricedItems++;
      basket.freshness = worse(basket.freshness, best.freshness);
      basket.lines.push({ productId: line.productId, quantity: line.quantity, offerId: best.id, unitPrice: best.price, subtotal });
    }
    if (basket.pricedItems === 0) basket.freshness = "unavailable";
    basket.complete = valid.length > 0 && basket.missingProductIds.length === 0;
    if (basket.minimumOrder !== undefined) basket.meetsMinimumOrder = basket.itemsSubtotal >= basket.minimumOrder;
    if (basket.complete && basket.deliveryFee !== undefined) {
      basket.estimatedFinalTotal = roundMoney(basket.itemsSubtotal + basket.deliveryFee);
    }
    return basket;
  });

  const complete = baskets.filter((b) => b.complete).sort((a, b) => a.itemsSubtotal - b.itemsSubtotal);
  const notes: string[] = [];
  let cheapestCompleteRetailerId: string | undefined;
  let potentialSavings: number | undefined;
  if (complete.length > 0) {
    cheapestCompleteRetailerId = complete[0].retailerId;
    if (complete.length > 1) potentialSavings = roundMoney(complete[complete.length - 1].itemsSubtotal - complete[0].itemsSubtotal);
  } else if (valid.length > 0) {
    notes.push("לאף רשת אין מחיר לכל המוצרים בסל, ולכן לא ניתן לקבוע איזו רשת הזולה ביותר.");
  }
  if (baskets.some((b) => b.complete && b.deliveryFee === undefined)) {
    notes.push("דמי משלוח אינם ידועים – הסכומים כוללים מוצרים בלבד ואינם מחיר סופי.");
  }

  // Split basket: cheapest usable offer per product across all retailers.
  const split: SplitBasket = { total: 0, retailerIds: [], missingProductIds: [], lines: [] };
  const used = new Set<string>();
  for (const line of valid) {
    const best = sortOffers((offersByProduct[line.productId] ?? []).filter(isUsableOffer), "price")[0];
    if (!best) {
      split.missingProductIds.push(line.productId);
      continue;
    }
    const subtotal = linePrice(best, line.quantity);
    split.total = roundMoney(split.total + subtotal);
    used.add(best.retailerId);
    split.lines.push({ productId: line.productId, quantity: line.quantity, retailerId: best.retailerId, offerId: best.id, subtotal });
  }
  split.retailerIds = [...used];
  if (split.retailerIds.length > 1) {
    notes.push(`פיצול הסל בין ${split.retailerIds.length} רשתות עשוי לחייב דמי משלוח נפרדים בכל רשת.`);
  }

  const usedOffers = baskets.flatMap((b) => b.lines.map((l) => l.offerId));
  const allOffers = Object.values(offersByProduct).flat();
  const dataIsSampleOnly =
    usedOffers.length > 0 && usedOffers.every((id) => allOffers.find((o) => o.id === id)?.freshness === "sample");
  if (dataIsSampleOnly) notes.unshift("ההשוואה מבוססת על נתונים לדוגמה בלבד ואינה משקפת מחירים אמיתיים.");

  return { baskets, cheapestCompleteRetailerId, potentialSavings, split, dataIsSampleOnly, notes };
}
