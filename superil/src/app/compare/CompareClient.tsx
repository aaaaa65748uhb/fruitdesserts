"use client";
import { CoverageNotice } from "@/components/CoverageNotice";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCatalog, useOffers, useProduct, useSearch } from "@/client/queries";
import { AddToCart } from "@/components/AddToCart";
import { BasketComparisonView } from "@/components/BasketComparisonView";
import { OfferTable } from "@/components/OfferTable";
import { Packshot } from "@/components/Packshot";
import { Price } from "@/components/Price";
import { isUsableOffer, sortOffers, type OfferSort } from "@/lib/compare";
import { BASIS_LABEL_HE, formatPackage, sameBasis, totalBaseQuantity } from "@/lib/units";

export function CompareClient() {
  const [tab, setTab] = useState<"basket" | "product">("basket");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">השוואת מחירים</h1>
      <CoverageNotice className="mt-3" />
      <div className="mt-4 inline-flex rounded-full bg-slate-100 p-1" role="tablist">
        {(["basket", "product"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-5 py-2 font-bold ${tab === t ? "bg-white shadow-sm" : "text-slate-600"}`}>
            {t === "basket" ? "הסל שלי" : "מוצר בודד"}
          </button>
        ))}
      </div>
      <div className="mt-6">{tab === "basket" ? <BasketComparisonView /> : <ProductCompare />}</div>
    </div>
  );
}

function ProductCompare() {
  const catalog = useCatalog();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string>();
  const [sort, setSort] = useState<OfferSort>("price");
  const search = useSearch(q.trim());
  const results = useMemo(() => (search.data?.products ?? []).slice(0, 8).map((product) => ({ product })), [search.data]);
  const productQ = useProduct(selected);
  const product = productQ.data?.product;

  // Similar products: same category and same measurement basis, compared by normalized unit price.
  const similar = useMemo(() => {
    if (!product || !catalog.data) return [];
    return catalog.data.products.filter((p) => p.id !== product.id && p.category === product.category && sameBasis(p, product)).slice(0, 12);
  }, [product, catalog.data]);
  const similarOffers = useOffers(similar.map((p) => p.id));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <label className="relative block">
          <span className="sr-only">חיפוש מוצר להשוואה</span>
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חפשו מוצר להשוואה" className="w-full rounded-xl border border-slate-200 py-2.5 pr-9 pl-3" />
        </label>
        <ul className="mt-3 divide-y divide-slate-100">
          {results.map(({ product: p }) => (
            <li key={p.id}>
              <button type="button" onClick={() => setSelected(p.id)} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-right hover:bg-slate-50 ${selected === p.id ? "bg-brand-50" : ""}`}>
                <Packshot product={p} size={40} />
                <span className="flex-1">
                  <span className="block font-bold">{p.nameHe}</span>
                  <span className="text-xs text-slate-500">{p.brand} · {formatPackage(p)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        {!product ? (
          <p className="rounded-3xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-100">בחרו מוצר כדי לראות את המחירים בכל הרשתות.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-3xl bg-white p-4 ring-1 ring-slate-100">
              <Packshot product={product} size={80} />
              <div className="flex-1">
                <Link href={`/product/${product.id}`} className="text-xl font-extrabold hover:underline">{product.nameHe}</Link>
                <p className="text-sm text-slate-600">{product.brand} · {formatPackage(product)}</p>
              </div>
              <AddToCart product={product} compact />
            </div>
            <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-sm" role="group" aria-label="מיון">
              {(["price", "unitPrice"] as const).map((k) => (
                <button type="button" key={k} onClick={() => setSort(k)} className={`flex-1 rounded-full px-3 py-1 ${sort === k ? "bg-white font-bold shadow-sm" : ""}`}>
                  {k === "price" ? "לפי מחיר" : "לפי מחיר ליחידת מידה"}
                </button>
              ))}
            </div>
            <OfferTable offers={sortOffers(productQ.data?.offers ?? [], sort)} />
            {similar.length > 0 && (
              <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100">
                <h3 className="font-extrabold">מוצרים דומים – לפי מחיר ליחידת מידה</h3>
                <p className="text-xs text-slate-500">גדלים שונים מושווים רק לאחר נרמול ל{BASIS_LABEL_HE[totalBaseQuantity(product).basis]}. אלו מוצרים שונים, לא תחליף אוטומטי.</p>
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {similar
                    .map((p) => ({ p, best: sortOffers((similarOffers.data?.offers[p.id] ?? []).filter(isUsableOffer), "unitPrice")[0] }))
                    .sort((a, b) => (a.best?.unitPrice ?? Infinity) - (b.best?.unitPrice ?? Infinity))
                    .map(({ p, best }) => (
                      <li key={p.id} className="flex items-center gap-2 py-1.5">
                        <button type="button" onClick={() => setSelected(p.id)} className="flex-1 truncate text-right hover:underline">{p.nameHe} <span className="text-slate-500">{p.brand} · {formatPackage(p)}</span></button>
                        {best?.unitPrice !== undefined ? <Price value={best.unitPrice} className="font-bold" /> : <span className="text-slate-400">—</span>}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
