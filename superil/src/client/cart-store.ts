"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartLine } from "@/lib/types";

export const MAX_QTY = 99;
/** Repeated add actions for the same product within this window are treated as one (e.g. key repeat). */
export const ADD_DEDUPE_MS = 350;

interface CartState {
  lines: Record<string, CartLine>;
  lastAdd: { productId: string; at: number } | null;
  add: (productId: string, quantity?: number, now?: number) => boolean;
  setQuantity: (productId: string, quantity: number) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  selectRetailer: (productId: string, retailerId: string | undefined) => void;
  clear: () => void;
}

const clampQty = (q: number) => Math.max(0, Math.min(MAX_QTY, Math.floor(q)));

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: {},
      lastAdd: null,
      add: (productId, quantity = 1, now = Date.now()) => {
        const { lastAdd, lines } = get();
        if (lastAdd && lastAdd.productId === productId && now - lastAdd.at < ADD_DEDUPE_MS) return false;
        const existing = lines[productId];
        const qty = clampQty((existing?.quantity ?? 0) + quantity);
        if (qty <= 0) return false;
        set({
          lines: { ...lines, [productId]: { ...existing, productId, quantity: qty, addedAt: existing?.addedAt ?? now } },
          lastAdd: { productId, at: now },
        });
        return true;
      },
      setQuantity: (productId, quantity) => {
        const lines = { ...get().lines };
        const qty = clampQty(quantity);
        if (!lines[productId]) return;
        if (qty === 0) delete lines[productId];
        else lines[productId] = { ...lines[productId], quantity: qty };
        set({ lines });
      },
      increment: (productId) => get().setQuantity(productId, (get().lines[productId]?.quantity ?? 0) + 1),
      decrement: (productId) => get().setQuantity(productId, (get().lines[productId]?.quantity ?? 0) - 1),
      remove: (productId) => {
        const lines = { ...get().lines };
        delete lines[productId];
        set({ lines });
      },
      selectRetailer: (productId, retailerId) => {
        const line = get().lines[productId];
        if (line) set({ lines: { ...get().lines, [productId]: { ...line, selectedRetailerId: retailerId } } });
      },
      clear: () => set({ lines: {}, lastAdd: null }),
    }),
    {
      name: "superil-cart-v1",
      skipHydration: true,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
      // Reconcile persisted data: drop malformed lines and clamp quantities.
      merge: (persisted, current) => {
        const raw = (persisted as { lines?: Record<string, CartLine> } | undefined)?.lines ?? {};
        const lines: Record<string, CartLine> = {};
        for (const [id, l] of Object.entries(raw)) {
          if (!l || typeof l.productId !== "string" || l.productId !== id) continue;
          const q = clampQty(Number(l.quantity));
          if (q > 0) lines[id] = { productId: id, quantity: q, selectedRetailerId: l.selectedRetailerId, addedAt: Number(l.addedAt) || 0 };
        }
        return { ...current, lines };
      },
    },
  ),
);

export function cartLineList(lines: Record<string, CartLine>): CartLine[] {
  return Object.values(lines).sort((a, b) => a.addedAt - b.addedAt);
}

export function cartItemCount(lines: Record<string, CartLine>): number {
  return Object.values(lines).reduce((n, l) => n + l.quantity, 0);
}
