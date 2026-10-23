"use client";
import { CartPanel } from "@/components/CartDrawer";
import { BasketComparisonView } from "@/components/BasketComparisonView";

export function CartPageClient() {
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="h-[calc(100dvh-9rem)] min-h-[520px] overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
        <CartPanel full />
      </section>
      <section>
        <BasketComparisonView compact />
      </section>
    </div>
  );
}
