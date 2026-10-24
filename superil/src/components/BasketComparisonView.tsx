"use client";
import { AlertTriangle, ArrowLeft, Crown, Info, Split } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { cartLineList, useCart } from "@/client/cart-store";
import { useBasketComparison, useProductsByIds } from "@/client/queries";
import { RETAILER_BY_ID } from "@/data/retailers";
import { FreshnessBadge } from "./FreshnessBadge";
import { MapPin } from "lucide-react";
import { Price } from "./Price";

export function BasketComparisonView({ compact = false }: { compact?: boolean }) {
  const lines = useCart((s) => s.lines);
  const items = useMemo(() => cartLineList(lines).map((l) => ({ productId: l.productId, quantity: l.quantity })), [lines]);
  const { data, isLoading, isError } = useBasketComparison(items);
  const catalog = useProductsByIds(items.map((i) => i.productId));
  const name = (id: string) => catalog.data?.byId[id]?.nameHe ?? id;

  if (!items.length) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
        <p className="text-lg font-bold">הסל ריק</p>
        <p className="mt-1 text-slate-600">הוסיפו מוצרים מהסופר או מהחיפוש כדי להשוות בין הרשתות.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/store" className="rounded-full bg-brand-700 px-5 py-2.5 font-bold text-white">לסופר</Link>
          <Link href="/search" className="rounded-full bg-slate-100 px-5 py-2.5 font-bold">לחיפוש</Link>
        </div>
      </div>
    );
  }
  if (isError) return <p className="rounded-2xl bg-red-50 p-4 text-red-800">ההשוואה אינה זמינה כרגע.</p>;
  if (isLoading || !data) return <div className="h-96 animate-pulse rounded-3xl bg-slate-200/60" />;

  const sorted = [...data.baskets].sort((a, b) => Number(b.complete) - Number(a.complete) || b.pricedItems - a.pricedItems || a.itemsSubtotal - b.itemsSubtotal);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h2 className="text-xl font-extrabold">השוואת הסל בין הרשתות</h2>
        <p className="text-sm text-slate-600">
          {items.length} מוצרים · חישוב בשרת לפי המחירים הידועים, ללא מחירים שנשלחו מהדפדפן.
        </p>
        {data.notes.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {data.notes.map((n) => (
              <li key={n} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${n.includes("לדוגמה") ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700"}`}>
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> {n}
              </li>
            ))}
          </ul>
        )}
        {data.cheapestCompleteRetailerId && data.potentialSavings !== undefined && data.potentialSavings > 0 && (
          <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
            הפרש של <Price value={data.potentialSavings} className="font-extrabold" /> בין הסל המלא הזול ליקר ביותר (מוצרים בלבד{data.dataIsSampleOnly ? ", לפי נתונים לדוגמה" : ""}).
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {sorted.map((b) => {
          const r = RETAILER_BY_ID[b.retailerId];
          const cheapest = b.retailerId === data.cheapestCompleteRetailerId;
          return (
            <li key={b.retailerId} className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${cheapest ? "ring-2 ring-brand-500" : "ring-slate-100"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: r?.color, color: r?.textColor }}>{r?.nameHe}</span>
                {cheapest && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-800">
                    <Crown className="h-3.5 w-3.5" /> הזול ביותר מבין הסלים המלאים
                  </span>
                )}
                <FreshnessBadge status={b.freshness} />
                {b.branchId && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                    <MapPin className="h-3.5 w-3.5" />
                    {b.branchName ?? `סניף ${b.branchId.split(":")[1]} (פרטי הסניף לא יובאו)`}
                    {b.branchesCompared && b.branchesCompared > 1 ? ` · הסניף המשתלם מבין ${b.branchesCompared}` : ""}
                  </span>
                )}
                <span className="mr-auto text-left">
                  {b.pricedItems > 0 ? <Price value={b.itemsSubtotal} className="text-xl font-extrabold" /> : <span className="text-sm font-bold text-slate-400">אין מחירים</span>}
                  <span className="block text-[11px] text-slate-500">
                    מוצרים בלבד · <span className="num">{b.pricedItems}/{items.length}</span> עם מחיר
                  </span>
                </span>
              </div>
              {!compact || b.missingProductIds.length ? (
                <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  <span>דמי משלוח: {b.deliveryFee !== undefined ? <Price value={b.deliveryFee} /> : "לא ידועים"}</span>
                  <span>הזמנת מינימום: {b.minimumOrder !== undefined ? <Price value={b.minimumOrder} /> : "לא ידועה"}</span>
                  <span className="sm:col-span-2">
                    סה&quot;כ משוער: {b.estimatedFinalTotal !== undefined ? <Price value={b.estimatedFinalTotal} className="font-bold" /> : "לא ניתן לחשב – חסרים נתונים"}
                  </span>
                  {b.missingProductIds.length > 0 && (
                    <span className="flex items-start gap-1 text-amber-800 sm:col-span-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      חסר מחיר עבור: {b.missingProductIds.map(name).join(", ")}
                    </span>
                  )}
                </div>
              ) : null}
              <div className="mt-3 flex justify-end">
                <Link href={`/checkout?retailer=${b.retailerId}`} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
                  להמשך קנייה ב{r?.nameHe} <ArrowLeft className="h-4 w-4" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h3 className="flex items-center gap-2 font-extrabold"><Split className="h-5 w-5 text-brand-700" /> פיצול הסל בין רשתות</h3>
        <p className="mt-1 text-sm text-slate-600">המחיר הזול ביותר לכל מוצר, בכל רשת שהיא.</p>
        <div className="mt-3 flex items-baseline gap-2">
          <Price value={data.split.total} className="text-2xl font-extrabold" />
          <span className="text-sm text-slate-500">ב-{data.split.retailerIds.length} רשתות, מוצרים בלבד</span>
        </div>
        {data.split.retailerIds.length > 1 && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">הזמנה מכמה רשתות פירושה כמה הזמנות נפרדות – ייתכנו דמי משלוח בכל אחת מהן, כך שהחיסכון בפועל עשוי להיות קטן יותר או להיעלם.</p>
        )}
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {data.split.lines.map((l) => (
            <li key={l.productId} className="flex items-center gap-2 py-1.5">
              <span className="num w-6 text-slate-500">{l.quantity}×</span>
              <span className="flex-1 truncate">{name(l.productId)}</span>
              <span className="text-xs text-slate-500">{RETAILER_BY_ID[l.retailerId]?.nameHe}</span>
              <Price value={l.subtotal} className="font-bold" />
            </li>
          ))}
        </ul>
        {data.split.missingProductIds.length > 0 && <p className="mt-2 text-xs text-amber-800">אין מחיר בשום רשת עבור: {data.split.missingProductIds.map(name).join(", ")}</p>}
      </div>
    </div>
  );
}
