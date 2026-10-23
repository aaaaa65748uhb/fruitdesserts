import { beforeEach, describe, expect, it } from "vitest";
import { chooseOffer } from "@/client/cart-pricing";
import { ADD_DEDUPE_MS, MAX_QTY, cartItemCount, cartLineList, useCart } from "@/client/cart-store";
import type { PriceOffer } from "@/lib/types";

const o = (retailerId: string, price: number, freshness: PriceOffer["freshness"] = "sample"): PriceOffer => ({
  id: retailerId, productId: "p", retailerId, price, currency: "ILS", availability: "unknown", sourceProvider: "t", freshness, matchConfidence: 1,
});

describe("cart store", () => {
  beforeEach(() => {
    localStorage.clear();
    useCart.getState().clear();
  });

  it("adds, increments and keeps one line per product", () => {
    const { add } = useCart.getState();
    expect(add("a", 1, 1000)).toBe(true);
    expect(add("a", 2, 5000)).toBe(true);
    expect(add("b", 1, 6000)).toBe(true);
    const lines = useCart.getState().lines;
    expect(Object.keys(lines)).toEqual(["a", "b"]);
    expect(lines.a.quantity).toBe(3);
    expect(cartItemCount(lines)).toBe(4);
  });

  it("ignores accidental repeated adds of the same product", () => {
    const { add } = useCart.getState();
    add("a", 1, 1000);
    expect(add("a", 1, 1000 + ADD_DEDUPE_MS - 1)).toBe(false);
    expect(add("a", 1, 1000 + ADD_DEDUPE_MS + 1)).toBe(true);
    expect(useCart.getState().lines.a.quantity).toBe(2);
  });

  it("changes quantities, clamps, and removes at zero", () => {
    const s = useCart.getState();
    s.add("a", 1, 1);
    s.increment("a");
    expect(useCart.getState().lines.a.quantity).toBe(2);
    s.setQuantity("a", 500);
    expect(useCart.getState().lines.a.quantity).toBe(MAX_QTY);
    s.decrement("a");
    expect(useCart.getState().lines.a.quantity).toBe(MAX_QTY - 1);
    s.setQuantity("a", 0);
    expect(useCart.getState().lines.a).toBeUndefined();
  });

  it("persists to localStorage and reconciles malformed data on rehydrate", async () => {
    useCart.getState().add("milk", 2, 1);
    const raw = JSON.parse(localStorage.getItem("superil-cart-v1")!);
    expect(raw.state.lines.milk.quantity).toBe(2);
    localStorage.setItem(
      "superil-cart-v1",
      JSON.stringify({ state: { lines: { milk: { productId: "milk", quantity: 3, addedAt: 1 }, bad: { productId: "other", quantity: 1 }, neg: { productId: "neg", quantity: -4 } } }, version: 1 }),
    );
    await useCart.persist.rehydrate();
    const lines = useCart.getState().lines;
    expect(Object.keys(lines)).toEqual(["milk"]);
    expect(cartLineList(lines)[0].quantity).toBe(3);
  });

  it("clears the cart", () => {
    useCart.getState().add("a", 1, 1);
    useCart.getState().clear();
    expect(cartItemCount(useCart.getState().lines)).toBe(0);
  });
});

describe("offer choice for cart lines", () => {
  const offers = [o("x", 5), o("y", 4), o("z", 3, "unavailable")];
  it("defaults to the cheapest usable offer", () => {
    expect(chooseOffer(offers)?.retailerId).toBe("y");
  });
  it("prefers the user's preferred retailer when it has a price", () => {
    expect(chooseOffer(offers, undefined, "x")?.retailerId).toBe("x");
    expect(chooseOffer(offers, undefined, "nope")?.retailerId).toBe("y");
  });
  it("never silently switches away from an explicitly selected retailer", () => {
    expect(chooseOffer(offers, "z")).toBeUndefined();
  });
});
