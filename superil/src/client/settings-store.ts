"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type GraphicsQuality = "auto" | "high" | "low";

interface SettingsState {
  locale: "he" | "en";
  mouseSensitivity: number;
  moveSpeed: number;
  graphics: GraphicsQuality;
  sound: boolean;
  /** Show the shopping cart you push in the 3D store. */
  showCart: boolean;
  preferredRetailerId?: string;
  preferredCity?: string;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      locale: "he",
      mouseSensitivity: 1,
      moveSpeed: 1,
      graphics: "auto",
      sound: true,
      showCart: true,
      set: (patch) => set(patch),
    }),
    { name: "superil-settings-v1", skipHydration: true, storage: createJSONStorage(() => localStorage) },
  ),
);
