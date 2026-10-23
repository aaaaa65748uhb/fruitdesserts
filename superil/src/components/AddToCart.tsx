"use client";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/client/cart-store";
import { useUi } from "@/client/ui-store";
import type { Product } from "@/lib/types";
import { QuantityStepper } from "./QuantityStepper";

export function AddToCart({ product, withQuantity = false, compact = false }: { product: Product; withQuantity?: boolean; compact?: boolean }) {
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.lines[product.id]?.quantity ?? 0);
  const showToast = useUi((s) => s.showToast);
  const [qty, setQty] = useState(1);
  const onAdd = () => {
    if (add(product.id, qty)) showToast(`${qty > 1 ? `${qty} × ` : ""}${product.nameHe} נוסף לסל`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {withQuantity && <QuantityStepper value={qty} onChange={setQty} min={1} label={product.nameHe} />}
      <button
        type="button"
        onClick={onAdd}
        className={`inline-flex items-center justify-center gap-2 rounded-full bg-brand-700 font-bold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.98] ${compact ? "px-3 py-1.5 text-sm" : "px-5 py-2.5"}`}
      >
        <ShoppingCart className="h-4 w-4" />
        הוספה לסל
      </button>
      {inCart > 0 && <span className="text-xs text-slate-500">בסל: <span className="num">{inCart}</span></span>}
    </div>
  );
}
