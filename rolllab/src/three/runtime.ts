import * as THREE from 'three'
import { create } from 'zustand'
import type { RollData } from './rollGeometry'
import type { SauceDrip } from '../types'
import { type CounterLayout, wideLayout } from './layout'

/**
 * Mutable runtime shared by the 3D components (outside React state so that
 * per-frame updates never trigger re-renders).
 */
export const runtime = {
  rollGroup: null as THREE.Group | null,
  rollMesh: null as THREE.Mesh | null,
  rollData: null as RollData | null,
  layout: wideLayout() as CounterLayout,
  /** Current spin of the roll on its paper (radians) and spin velocity. */
  spin: 0,
  spinVel: 0,
  /** Live pour: the stroke being poured right now. */
  live: {
    strokeId: null as string | null,
    kind: 'line' as 'line' | 'pool',
    points: [] as number[],
    pool: null as null | { x: number; z: number; radius: number; thickness: number },
    version: 0,
    sauceId: '',
  },
  /** Stream from nozzle to roll (world space) while pouring. */
  stream: {
    visible: false,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    radius: 0.02,
    color: '#fff',
  },
  /** World position the held tool should move to and how it is posed. */
  held: {
    target: new THREE.Vector3(0, 1.2, 2),
    pose: 'carry' as 'carry' | 'pour' | 'sprinkle' | 'pipe',
    shaking: false,
  },
  /** Screen-space anchor for the hover tooltip. */
  tooltipAnchor: new THREE.Vector3(),
  tooltipVisible: false,
  /** Time the dough was last swapped (for the "pop" animation). */
  popAt: 0,
  /** Camera snapshot helper registered by the canvas. */
  snapshot: null as null | (() => Promise<string | null>),
}

/** Small reactive store for values the 3D layer needs to react to. */
interface RuntimeStore {
  surfaceVersion: number
  layoutMode: CounterLayout['mode']
  liveStrokeId: string | null
  liveDrips: SauceDrip[]
  bumpSurface: () => void
  setLayoutMode: (m: CounterLayout['mode']) => void
  setLive: (id: string | null) => void
  addLiveDrip: (d: SauceDrip) => void
}

export const useRuntime = create<RuntimeStore>()((set, get) => ({
  surfaceVersion: 0,
  layoutMode: 'wide',
  liveStrokeId: null,
  liveDrips: [],
  bumpSurface: () => set({ surfaceVersion: get().surfaceVersion + 1 }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setLive: (liveStrokeId) => set({ liveStrokeId, liveDrips: [] }),
  addLiveDrip: (d) => set({ liveDrips: [...get().liveDrips, d] }),
}))
