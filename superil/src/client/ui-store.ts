"use client";
import { create } from "zustand";

interface UiState {
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  toast: { id: number; text: string } | null;
  showToast: (text: string) => void;
}

export const useUi = create<UiState>()((set) => ({
  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
  toast: null,
  showToast: (text) => set({ toast: { id: Date.now(), text } }),
}));
