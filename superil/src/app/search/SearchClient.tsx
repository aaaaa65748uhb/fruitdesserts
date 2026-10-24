"use client";
import { CoverageNotice } from "@/components/CoverageNotice";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useOffers, useSearch } from "@/client/queries";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES } from "@/lib/categories";
import { isUsableOffer, sortOffers } from "@/lib/compare";
import type { CategoryId } from "@/lib/types";

export function SearchClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  const category = (sp.get("category") as CategoryId | null) ?? undefined;
  const brand = sp.get("brand") ?? undefined;
  useEffect(() => setQ(sp.get("q") ?? ""), [sp]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, isError } = useSearch(debounced, { category, brand });
  const products = useMemo(() => data?.products ?? [], [data]);
  const offersQ = useOffers(products.map((p) => p.id));
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, "he")), [products]);

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "q" && debounced) next.set("q", debounced);
    router.replace(`/search?${next}`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">חיפוש מוצרים</h1>
      <CoverageNotice className="mt-3" />
      <form role="search" className="relative mt-4 max-w-2xl" onSubmit={(e) => { e.preventDefault(); setParam("q", q.trim()); }}>
        <Search className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="שם מוצר, מותג או ברקוד" aria-label="חיפוש מוצר" className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pr-12 pl-4 text-lg shadow-sm outline-none focus:border-brand-500" />
      </form>
      {data?.suggestions && debounced && data.suggestions.length > 0 && products.length === 0 && (
        <p className="mt-2 text-sm text-slate-600">אולי התכוונתם ל: {data.suggestions.join(" · ")}</p>
      )}

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="סינון לפי מחלקה">
        <button type="button" onClick={() => setParam("category")} className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${!category ? "bg-brand-700 text-white ring-brand-700" : "bg-white ring-slate-200"}`}>הכל</button>
        {CATEGORIES.map((c) => (
          <button type="button" key={c.id} onClick={() => setParam("category", c.id)} className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${category === c.id ? "bg-brand-700 text-white ring-brand-700" : "bg-white ring-slate-200"}`}>
            {c.nameHe}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="brand" className="text-slate-600">מותג:</label>
        <select id="brand" value={brand ?? ""} onChange={(e) => setParam("brand", e.target.value || undefined)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
          <option value="">כל המותגים</option>
          {(brand && !brands.includes(brand) ? [brand, ...brands] : brands).map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        {brand && (
          <button type="button" onClick={() => setParam("brand")} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1"><X className="h-3 w-3" /> ניקוי</button>
        )}
        <span className="mr-auto text-slate-500">{products.length} תוצאות</span>
      </div>

      {isError && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800">החיפוש אינו זמין כרגע. נסו שוב.</p>}
      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-80 animate-pulse rounded-3xl bg-slate-200/60" />)}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {products.map((p) => {
            const offers = offersQ.data?.offers[p.id] ?? [];
            return <ProductCard key={p.id} product={p} best={sortOffers(offers.filter(isUsableOffer), "price")[0]} offerCount={offers.filter(isUsableOffer).length} />;
          })}
        </div>
      )}
      {!isLoading && products.length === 0 && <p className="mt-10 text-center text-slate-500">לא נמצאו מוצרים. נסו מילה אחרת או מחקו את הסינון.</p>}
    </div>
  );
}
