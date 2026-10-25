"use client";
import { create } from "zustand";

/** Mutable per-frame player data (kept out of React state to avoid re-renders every frame). */
export const playerLive = { x: 0, z: 0, yaw: 0, pitch: 0 };

/** Where the first-person cart's basket currently is (written by FirstPersonCart, read by pickup effects). */
export const cartLive = { x: 0, z: 0, visible: false };

/** Touch input, written by the on-screen joystick / look pad and read in the frame loop. */
export const touchInput = { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0 };

export interface Focus {
  blockIndex: number;
  facing: number;
  productId: string;
}

interface StoreState {
  started: boolean;
  locked: boolean;
  focus: Focus | null;
  panelProductId: string | null;
  searchOpen: boolean;
  helpOpen: boolean;
  teleport: { x: number; z: number; yaw: number; pitch?: number; id: number } | null;
  pickups: { id: number; productId: string; from: [number, number, number] }[];
  set: (patch: Partial<Omit<StoreState, "set" | "requestTeleport" | "addPickup" | "removePickup">>) => void;
  requestTeleport: (x: number, z: number, yaw: number, pitch?: number) => void;
  addPickup: (productId: string, from: [number, number, number]) => void;
  removePickup: (id: number) => void;
}

export const useStore3d = create<StoreState>()((set) => ({
  started: false,
  locked: false,
  focus: null,
  panelProductId: null,
  searchOpen: false,
  helpOpen: false,
  teleport: null,
  pickups: [],
  set: (patch) => set(patch),
  requestTeleport: (x, z, yaw, pitch) => set({ teleport: { x, z, yaw, pitch, id: Date.now() } }),
  addPickup: (productId, from) => set((s) => ({ pickups: [...s.pickups.slice(-4), { id: Date.now() + Math.random(), productId, from }] })),
  removePickup: (id) => set((s) => ({ pickups: s.pickups.filter((p) => p.id !== id) })),
}));
