"use client";
import { AlertTriangle, ArrowLeft, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCartPricing } from "@/client/cart-pricing";
import { useCart } from "@/client/cart-store";
import { useUi } from "@/client/ui-store";
import { normalizeText } from "@/lib/search";
import { formatPackage } from "@/lib/units";
import { RETAILER_BY_ID } from "@/data/retailers";
import { FreshnessBadge } from "./FreshnessBadge";
import { Packshot } from "./Packshot";
import { Price } from "./Price";
import { QuantityStepper } from "./QuantityStepper";

export function CartDrawer() {
  const open = useUi((s) => s.cartOpen);
  const setOpen = useUi((s) => s.setCartOpen);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="סל הקניות">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="סגירת הסל" onClick={() => setOpen(false)} />
      <div ref={panelRef} tabIndex={-1} className="animate-drawer absolute inset-y-0 left-0 flex w-full max-w-md flex-col bg-white shadow-2xl outline-none">
        <CartPanel onClose={() => setOpen(false)} />
      </div>
    </div>
  );
}

export function CartPanel({ onClose, full = false }: { onClose?: () => void; full?: boolean }) {
  const pricing = useCartPricing();
  const { setQuantity, remove, clear } = useCart();
  const [filter, setFilter] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const shown = useMemo(() => {
    const f = normalizeText(filter);
    if (!f) return pricing.lines;
    return pricing.lines.filter((l) => l.product && normalizeText(`${l.product.nameHe} ${l.product.brand}`).includes(f));
  }, [filter, pricing.lines]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-extrabold">
          סל הקניות <span className="num text-slate-400">({pricing.itemCount})</span>
        </h2>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100" aria-label="סגירה">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {pricing.lines.length === 0 ? (
        <div className="grid flex-1 place-items-center p-10 text-center text-slate-500">
          <div>
            <p className="mb-4 text-lg font-medium">הסל ריק</p>
            <Link href="/store" onClick={onClose} className="rounded-full bg-brand-700 px-5 py-2.5 font-bold text-white">
              כניסה לסופר
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-5 pt-3">
            <label className="relative flex-1">
              <span className="sr-only">חיפוש בסל</span>
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="חיפוש בסל" className="w-full rounded-full border border-slate-200 py-1.5 pr-9 pl-3 text-sm" />
            </label>
            {confirmClear ? (
              <span className="flex items-center gap-1 text-sm">
                <button type="button" className="rounded-full bg-red-600 px-3 py-1.5 font-bold text-white" onClick={() => { clear(); setConfirmClear(false); }}>
                  לרוקן?
                </button>
                <button type="button" className="rounded-full px-2 py-1.5 text-slate-600" onClick={() => setConfirmClear(false)}>ביטול</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> ריקון
              </button>
            )}
          </div>
          <ul className={`min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto px-5 ${full ? "" : ""}`}>
            {shown.map(({ line, product, offer, subtotal, status }) => (
              <li key={line.productId} className="flex gap-3 py-3">
                {product ? <Packshot product={product} size={56} className="shrink-0 rounded-lg bg-slate-50" /> : <div className="h-14 w-14 rounded-lg bg-slate-100" />}
                <div className="min-w-0 flex-1">
                  {product ? (
                    <Link href={`/product/${product.id}`} onClick={onClose} className="block truncate font-bold hover:underline">
                      {product.nameHe} <span className="font-normal text-slate-500">{product.brand}</span>
                    </Link>
                  ) : (
                    <p className="font-bold text-slate-500">מוצר שאינו זמין עוד בקטלוג</p>
                  )}
                  {product && <p className="text-xs text-slate-500">{formatPackage(product)}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {status === "priced" && offer && (
                      <>
                        <span className="text-slate-600">{RETAILER_BY_ID[offer.retailerId]?.nameHe}</span>
                        <FreshnessBadge status={offer.freshness} />
                      </>
                    )}
                    {status === "no_price" && (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {line.selectedRetailerId ? `אין מחיר ב${RETAILER_BY_ID[line.selectedRetailerId]?.nameHe ?? "רשת שנבחרה"}` : "אין מחיר זמין"}
                      </span>
                    )}
                    {status === "unknown_product" && <span className="text-red-700">יש להסיר מהסל</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <QuantityStepper size="sm" value={line.quantity} onChange={(v) => setQuantity(line.productId, v)} label={product?.nameHe ?? ""} />
                    <div className="text-left">
                      {subtotal !== undefined ? <Price value={subtotal} className="font-bold" /> : <span className="text-sm text-slate-400">—</span>}
                      <button type="button" onClick={() => remove(line.productId)} className="mr-2 text-xs text-slate-400 hover:text-red-600" aria-label={`הסרת ${product?.nameHe ?? "מוצר"}`}>
                        הסרה
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">סכום ביניים למוצרים</span>
              <Price value={pricing.knownSubtotal} className="text-xl font-extrabold" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <FreshnessBadge status={pricing.worstFreshness} />
              <span>לא כולל דמי משלוח או חיובים נוספים שאינם ידועים.</span>
              {pricing.unpricedCount > 0 && <span className="text-amber-700">{pricing.unpricedCount} מוצרים ללא מחיר אינם נכללים בסכום.</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/compare" onClick={onClose} className="rounded-full border border-brand-700 py-2.5 text-center font-bold text-brand-800 hover:bg-brand-50">
                השוואת רשתות
              </Link>
              <Link href="/checkout" onClick={onClose} className="inline-flex items-center justify-center gap-1 rounded-full bg-brand-700 py-2.5 font-bold text-white hover:bg-brand-800">
                להמשך קנייה <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
            {!full && (
              <Link href="/cart" onClick={onClose} className="block text-center text-sm text-slate-600 underline">
                לעמוד הסל המלא
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
