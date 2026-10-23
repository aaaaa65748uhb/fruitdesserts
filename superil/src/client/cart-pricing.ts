"use client";
import { useMemo } from "react";
import { isUsableOffer, linePrice, sortOffers } from "@/lib/compare";
import { FRESHNESS_RANK } from "@/lib/freshness";
import { roundMoney } from "@/lib/format";
import type { CartLine, FreshnessStatus, PriceOffer, Product } from "@/lib/types";
import { cartLineList, useCart } from "./cart-store";
import { useCatalog, useOffers } from "./queries";
import { useSettings } from "./settings-store";

export interface PricedLine {
  line: CartLine;
  product?: Product;
  /** Offer used for the displayed price: user-selected retailer → preferred retailer → cheapest usable. */
  offer?: PriceOffer;
  offers: PriceOffer[];
  subtotal?: number;
  status: "priced" | "no_price" | "unknown_product" | "loading";
}

export function chooseOffer(offers: PriceOffer[], selectedRetailerId?: string, preferredRetailerId?: string): PriceOffer | undefined {
  const usable = offers.filter(isUsableOffer);
  const pick = (rid?: string) => (rid ? sortOffers(usable.filter((o) => o.retailerId === rid), "price")[0] : undefined);
  if (selectedRetailerId) return pick(selectedRetailerId); // never silently switch away from the user's choice
  return pick(preferredRetailerId) ?? sortOffers(usable, "price")[0];
}

export function useCartPricing() {
  const lines = useCart((s) => s.lines);
  const preferred = useSettings((s) => s.preferredRetailerId);
  const list = useMemo(() => cartLineList(lines), [lines]);
  const catalog = useCatalog();
  const offersQ = useOffers(list.map((l) => l.productId));

  return useMemo(() => {
    const priced: PricedLine[] = list.map((line) => {
      if (catalog.isLoading) return { line, offers: [], status: "loading" };
      const product = catalog.data?.byId[line.productId];
      if (!product) return { line, offers: [], status: "unknown_product" };
      const offers = offersQ.data?.offers[line.productId] ?? [];
      if (!offersQ.data) return { line, product, offers, status: "loading" };
      const offer = chooseOffer(offers, line.selectedRetailerId, preferred);
      if (!offer) return { line, product, offers, status: "no_price" };
      return { line, product, offers, offer, subtotal: linePrice(offer, line.quantity), status: "priced" };
    });
    const knownSubtotal = roundMoney(priced.reduce((s, p) => s + (p.subtotal ?? 0), 0));
    const worstFreshness = priced
      .filter((p) => p.offer)
      .reduce<FreshnessStatus>((w, p) => (FRESHNESS_RANK[p.offer!.freshness] > FRESHNESS_RANK[w] ? p.offer!.freshness : w), "live");
    return {
      lines: priced,
      itemCount: list.reduce((n, l) => n + l.quantity, 0),
      knownSubtotal,
      unpricedCount: priced.filter((p) => p.status === "no_price" || p.status === "unknown_product").length,
      worstFreshness: priced.some((p) => p.offer) ? worstFreshness : ("unavailable" as FreshnessStatus),
      loading: catalog.isLoading || offersQ.isLoading,
    };
  }, [list, catalog.data, catalog.isLoading, offersQ.data, offersQ.isLoading, preferred]);
}
