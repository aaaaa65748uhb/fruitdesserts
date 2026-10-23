"use client";
import { useMemo, useState } from "react";
import { AddToCart } from "@/components/AddToCart";
import { OfferTable } from "@/components/OfferTable";
import { sortOffers, type OfferSort } from "@/lib/compare";
import type { PriceOffer, Product } from "@/lib/types";

export function ProductOffers({ product, initialOffers }: { product: Product; initialOffers: PriceOffer[] }) {
  const [sort, setSort] = useState<OfferSort>("price");
  const offers = useMemo(() => sortOffers(initialOffers, sort), [initialOffers, sort]);
  return (
    <section className="mt-6">
      <AddToCart product={product} withQuantity />
      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">מחירים ברשתות</h2>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-sm" role="group" aria-label="מיון">
          {(["price", "unitPrice"] as const).map((k) => (
            <button type="button" key={k} onClick={() => setSort(k)} aria-pressed={sort === k} className={`rounded-full px-3 py-1 ${sort === k ? "bg-white font-bold shadow-sm" : ""}`}>
              {k === "price" ? "מחיר" : "מחיר ליחידת מידה"}
            </button>
          ))}
        </div>
      </div>
      <OfferTable offers={offers} />
      <p className="mt-2 text-xs text-slate-500">מבצעים מוצגים רק כאשר הם מאומתים. מחיר בסניף אחד אינו מעיד על מחיר או מלאי בסניף אחר.</p>
    </section>
  );
}
