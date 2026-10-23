"use client";
import { ExternalLink } from "lucide-react";
import { RETAILER_BY_ID } from "@/data/retailers";
import { formatDateTimeHe } from "@/lib/format";
import { BASIS_LABEL_HE, type MeasureBasis } from "@/lib/units";
import type { PriceOffer } from "@/lib/types";
import { FreshnessBadge } from "./FreshnessBadge";
import { Price } from "./Price";

export function OfferTable({ offers }: { offers: PriceOffer[] }) {
  if (!offers.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">אין הצעות מחיר זמינות למוצר זה.</p>;
  const usable = offers.filter((o) => o.freshness !== "unavailable");
  const cheapest = usable.length ? Math.min(...usable.map((o) => o.price)) : undefined;
  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
      {offers.map((o) => {
        const r = RETAILER_BY_ID[o.retailerId];
        return (
          <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="h-3 w-3 rounded-full" style={{ background: r?.color }} />
            <span className="w-24 font-medium">{r?.nameHe ?? o.retailerId}</span>
            <FreshnessBadge status={o.freshness} />
            {o.lastVerifiedAt && <span className="hidden text-[11px] text-slate-500 sm:inline">עודכן {formatDateTimeHe(o.lastVerifiedAt)}</span>}
            {o.sourceUrl?.startsWith("https://") && (
              <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-slate-500 hover:text-brand-700" aria-label="לעמוד המוצר באתר הרשת">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <span className="mr-auto text-left">
              <Price value={o.price} className={`font-extrabold ${o.price === cheapest ? "text-brand-700" : ""}`} />
              {o.unitPrice !== undefined && o.unitPriceBasis && (
                <span className="block text-[11px] text-slate-500">
                  <Price value={o.unitPrice} /> {BASIS_LABEL_HE[o.unitPriceBasis as MeasureBasis]}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

