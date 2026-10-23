"use client";
import Link from "next/link";
import { RETAILER_BY_ID } from "@/data/retailers";
import { BASIS_LABEL_HE, formatPackage, type MeasureBasis } from "@/lib/units";
import type { PriceOffer, Product } from "@/lib/types";
import { AddToCart } from "./AddToCart";
import { FreshnessBadge } from "./FreshnessBadge";
import { Packshot } from "./Packshot";
import { Price } from "./Price";

export function ProductCard({ product, best, offerCount }: { product: Product; best?: PriceOffer; offerCount: number }) {
  return (
    <article className="flex flex-col rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md">
      <Link href={`/product/${product.id}`} className="block">
        <div className="grid place-items-center rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 py-3">
          <Packshot product={product} size={120} />
        </div>
        <p className="mt-3 text-xs text-slate-500">{product.brand}</p>
        <h3 className="font-extrabold leading-snug hover:underline">{product.nameHe}</h3>
        <p className="text-sm text-slate-600">{formatPackage(product)}</p>
      </Link>
      <div className="mt-3 flex-1">
        {best ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-500">החל מ-</span>
              <Price value={best.price} className="text-xl font-extrabold" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              <span>{RETAILER_BY_ID[best.retailerId]?.nameHe}</span>
              <FreshnessBadge status={best.freshness} />
            </div>
            {best.unitPrice !== undefined && best.unitPriceBasis && (
              <p className="mt-1 text-[11px] text-slate-500">
                <Price value={best.unitPrice} /> {BASIS_LABEL_HE[best.unitPriceBasis as MeasureBasis]} · {offerCount} רשתות
              </p>
            )}
          </>
        ) : (
          <FreshnessBadge status="unavailable" />
        )}
      </div>
      <div className="mt-3">
        <AddToCart product={product} compact />
      </div>
    </article>
  );
}
