"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { BasketComparison } from "@/lib/compare";
import type { CheckoutHandoff } from "@/lib/checkout";
import type { Branch, CategoryId, PriceOffer, Product, ProviderStatus, Retailer } from "@/lib/types";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `שגיאה ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: () => getJson<{ products: Product[] }>("/api/catalog"),
    staleTime: 5 * 60_000,
    select: (d) => ({ products: d.products, byId: Object.fromEntries(d.products.map((p) => [p.id, p])) as Record<string, Product> }),
  });
}

/** Products by id, for the cart and comparisons (never downloads the full catalog). */
export function useProductsByIds(ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["products-by-id", sorted],
    enabled: sorted.length > 0,
    queryFn: () => getJson<{ products: Product[] }>("/api/products/batch", post({ ids: sorted })),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    select: (d) => ({ products: d.products, byId: Object.fromEntries(d.products.map((p) => [p.id, p])) as Record<string, Product> }),
  });
}

export function useSearch(q: string, filters: { category?: CategoryId; brand?: string } = {}) {
  const sp = new URLSearchParams({ q });
  if (filters.category) sp.set("category", filters.category);
  if (filters.brand) sp.set("brand", filters.brand);
  return useQuery({
    queryKey: ["search", q, filters.category, filters.brand],
    queryFn: () => getJson<{ products: Product[]; suggestions: string[] }>(`/api/products?${sp}`),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["product", id],
    enabled: !!id,
    queryFn: () => getJson<{ product: Product; offers: PriceOffer[] }>(`/api/products/${encodeURIComponent(id!)}`),
  });
}

export function useOffers(productIds: string[]) {
  const ids = [...new Set(productIds)].sort();
  return useQuery({
    queryKey: ["offers", ids],
    enabled: ids.length > 0,
    queryFn: () => getJson<{ offers: Record<string, PriceOffer[]> }>("/api/offers", post({ productIds: ids })),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useBasketComparison(items: { productId: string; quantity: number }[]) {
  const key = items.map((i) => `${i.productId}:${i.quantity}`).sort();
  return useQuery({
    queryKey: ["compare", key],
    enabled: items.length > 0,
    queryFn: () => getJson<BasketComparison>("/api/basket/compare", post({ items })),
    placeholderData: keepPreviousData,
  });
}

export function useHandoff(retailerId: string | undefined, items: { productId: string; quantity: number }[]) {
  const key = items.map((i) => `${i.productId}:${i.quantity}`).sort();
  return useQuery({
    queryKey: ["handoff", retailerId, key],
    enabled: !!retailerId && items.length > 0,
    queryFn: () => getJson<CheckoutHandoff>("/api/checkout/handoff", post({ retailerId, items })),
  });
}

export function useRetailers() {
  return useQuery({ queryKey: ["retailers"], queryFn: () => getJson<{ retailers: Retailer[] }>("/api/retailers"), staleTime: Infinity });
}

export function useBranches(retailerId?: string, city?: string) {
  const sp = new URLSearchParams();
  if (retailerId) sp.set("retailerId", retailerId);
  if (city) sp.set("city", city);
  return useQuery({ queryKey: ["branches", retailerId, city], queryFn: () => getJson<{ branches: Branch[]; note?: string }>(`/api/branches?${sp}`) });
}

export function useProviderStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: () => getJson<{ providers: ProviderStatus[]; priceMode: "official" | "sample" | "mixed" | "none" }>("/api/status"),
    staleTime: 60_000,
  });
}
