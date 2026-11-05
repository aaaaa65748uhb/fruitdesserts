import { create } from 'zustand'

export type ToolKind = 'sauce' | 'topping' | 'filling'
export type PourPattern = 'drizzle' | 'zigzag' | 'spiral' | 'glaze'
export type Flow = 'thin' | 'medium' | 'thick'
export type Spread = 'pinch' | 'handful'

export interface HeldTool {
  kind: ToolKind
  id: string
}

export interface Hovered {
  kind: ToolKind | 'roll' | 'lid' | 'extra'
  id: string
}

interface ToolState {
  held: HeldTool | null
  /** The slot the held tool came from flies back when put down. */
  returning: HeldTool | null
  pattern: PourPattern
  flow: Flow
  spread: Spread
  /** Pouring or sprinkling right now. */
  active: boolean
  overRoll: boolean
  hovered: Hovered | null
  pickUp: (tool: HeldTool) => void
  putBack: () => void
  clearReturning: () => void
  setPattern: (p: PourPattern) => void
  setFlow: (f: Flow) => void
  setSpread: (s: Spread) => void
  setActive: (v: boolean) => void
  setOverRoll: (v: boolean) => void
  setHovered: (h: Hovered | null) => void
}

export const useTool = create<ToolState>()((set, get) => ({
  held: null,
  returning: null,
  pattern: 'drizzle',
  flow: 'medium',
  spread: 'pinch',
  active: false,
  overRoll: false,
  hovered: null,
  pickUp: (tool) => set({ held: tool, returning: null, active: false }),
  putBack: () => {
    const held = get().held
    if (!held) return
    set({ held: null, returning: held, active: false })
  },
  clearReturning: () => set({ returning: null }),
  setPattern: (pattern) => set({ pattern }),
  setFlow: (flow) => set({ flow }),
  setSpread: (spread) => set({ spread }),
  setActive: (active) => set({ active }),
  setOverRoll: (overRoll) => (get().overRoll === overRoll ? undefined : set({ overRoll })),
  setHovered: (hovered) => {
    const h = get().hovered
    if (h?.kind === hovered?.kind && h?.id === hovered?.id) return
    set({ hovered })
  },
}))

export const FLOW_RADIUS: Record<Flow, number> = { thin: 0.014, medium: 0.022, thick: 0.032 }
export const SPREAD_SIGMA: Record<Spread, number> = { pinch: 0.09, handful: 0.22 }
