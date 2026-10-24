"use client";
import { ExternalLink, Tag } from "lucide-react";
import { RETAILER_BY_ID } from "@/data/retailers";
import { isUsableOffer } from "@/lib/compare";
import { formatDateTimeHe } from "@/lib/format";
import { BASIS_LABEL_HE, type MeasureBasis } from "@/lib/units";
import type { PriceOffer, Promotion } from "@/lib/types";
import { FreshnessBadge } from "./FreshnessBadge";
import { Price } from "./Price";

const PROMO_STATUS: Record<NonNullable<Promotion["status"]>, { label: string; cls: string }> = {
  active: { label: "בתוקף לפי קובץ המבצעים", cls: "bg-emerald-50 text-emerald-800" },
  upcoming: { label: "טרם התחיל", cls: "bg-slate-100 text-slate-600" },
  expired: { label: "הסתיים", cls: "bg-slate-100 text-slate-500 line-through" },
  unverified: { label: "תאריכים לא אומתו", cls: "bg-amber-50 text-amber-800" },
};

export function branchText(o: PriceOffer): string | undefined {
  if (!o.branchId) return undefined;
  if (o.branchName) return o.branchName;
  return `סניף ${o.branchId.split(":")[1]} (פרטי הסניף לא יובאו)`;
}

export function OfferTable({ offers }: { offers: PriceOffer[] }) {
  if (!offers.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">אין מחירים זמינים למוצר זה.</p>;
  const usable = offers.filter(isUsableOffer);
  const cheapest = usable.length ? Math.min(...usable.map((o) => o.price)) : undefined;
  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
      {offers.map((o) => {
        const r = RETAILER_BY_ID[o.retailerId];
        const branch = branchText(o);
        const promos = (o.promotions ?? []).filter((p) => p.status !== "expired").slice(0, 3);
        return (
          <li key={o.id} className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r?.color }} />
              <span className="min-w-0">
                <span className="block font-medium">{r?.nameHe ?? o.retailerId}</span>
                {branch && <span className="block truncate text-[11px] text-slate-500">{branch}</span>}
              </span>
              <FreshnessBadge status={o.freshness} />
              {o.sourceUrl?.startsWith("https://") && (
                <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-slate-500 hover:text-brand-700" aria-label="לעמוד המוצר באתר הרשת">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <span className={`mr-auto text-left ${isUsableOffer(o) ? "" : "opacity-60"}`}>
                <Price value={o.price} className={`font-extrabold ${o.price === cheapest && isUsableOffer(o) ? "text-brand-700" : ""}`} />
                {o.unitPrice !== undefined && o.unitPriceBasis && (
                  <span className="block text-[11px] text-slate-500">
                    <Price value={o.unitPrice} /> {BASIS_LABEL_HE[o.unitPriceBasis as MeasureBasis]}
                  </span>
                )}
              </span>
            </div>
            {(o.publishedAt || o.priceChangedAt) && (
              <p className="mt-1 text-[11px] text-slate-500" title={o.sourceFile ? `קובץ מקור: ${o.sourceFile}` : undefined}>
                {o.publishedAt && <>קובץ המחירים פורסם {formatDateTimeHe(o.publishedAt)}</>}
                {o.priceChangedAt && <> · המחיר שונה לאחרונה {formatDateTimeHe(o.priceChangedAt)}</>}
                {o.freshness === "stale" && <span className="text-rose-700"> · לא נכלל בחישובי הסל</span>}
              </p>
            )}
            {promos.map((p) => (
              <p key={p.promotionId ?? p.description} className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                <Tag className="h-3 w-3 text-slate-400" />
                <span className="text-slate-700">{p.description}</span>
                {p.status && <span className={`rounded px-1.5 ${PROMO_STATUS[p.status].cls}`}>{PROMO_STATUS[p.status].label}</span>}
                {p.validUntil && p.status !== "unverified" && <span className="text-slate-500">עד {formatDateTimeHe(p.validUntil)}</span>}
                {p.generalPublic === false && <span className="rounded bg-slate-100 px-1.5 text-slate-600">למועדון / קופון בלבד</span>}
                {p.generalPublic === undefined && p.status && <span className="text-slate-500">תנאי זכאות לא צוינו</span>}
                <span className="text-slate-400">· לא נכלל בחישוב</span>
              </p>
            ))}
          </li>
        );
      })}
    </ul>
  );
}
