import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { catalog } from '../config/catalog'
import { canUseTopping, createEmptyDesign, toppingCount } from '../engine/customization'
import type { RollDesign, SauceStroke, ToppingPiece } from '../types'
import { uid } from '../lib/id'

const HISTORY_LIMIT = 60

interface BuilderState {
  design: RollDesign
  past: RollDesign[]
  /** Cart item being edited (null when building a fresh roll). */
  editingCartItemId: string | null
  /** Bumps whenever a fresh roll should drop into a new box. */
  rollSerial: number

  setBase: (id: string) => void
  setFilling: (id: string | null) => void
  toggleExtra: (id: string) => void
  setName: (name: string) => void

  beginStroke: (stroke: SauceStroke) => void
  updateStroke: (id: string, patch: Partial<SauceStroke>) => void
  /** Drops a stroke that ended up with no sauce (and its history entry). */
  discardStrokeIfEmpty: (id: string) => void
  removeSauce: (sauceId: string) => void

  beginBatch: (toppingId: string) => string
  addPieces: (batchId: string, pieces: ToppingPiece[]) => void
  discardBatchIfEmpty: (batchId: string) => void
  addToppingPieces: (toppingId: string, pieces: ToppingPiece[]) => void
  removeToppingPieces: (toppingId: string, count: number) => void
  removeTopping: (toppingId: string) => void

  /** Replace the roll on the counter (e.g. a chef's pick). Undo brings the old one back. */
  applyDesign: (design: RollDesign) => void
  undo: () => void
  reset: () => void
  loadDesign: (design: RollDesign, cartItemId: string | null) => void
  startNewRoll: () => void
}

export const useBuilder = create<BuilderState>()(
  persist(
    (set, get) => {
      /** Commit a new design and remember the previous one for undo. */
      const commit = (next: RollDesign) => {
        const { design, past } = get()
        set({ design: next, past: [...past, design].slice(-HISTORY_LIMIT) })
      }

      return {
        design: createEmptyDesign(),
        past: [],
        editingCartItemId: null,
        rollSerial: 0,

        setBase: (id) => {
          const { design } = get()
          if (design.baseId === id) return
          commit({ ...design, baseId: id })
        },
        setFilling: (id) => {
          const { design } = get()
          if (design.fillingId === id) return
          commit({ ...design, fillingId: id })
        },
        toggleExtra: (id) => {
          const { design } = get()
          const has = design.extras.includes(id)
          if (!has && design.extras.length >= catalog.limits.maxExtras) return
          commit({ ...design, extras: has ? design.extras.filter((e) => e !== id) : [...design.extras, id] })
        },
        setName: (name) => set({ design: { ...get().design, name } }),

        beginStroke: (stroke) => {
          const { design } = get()
          commit({ ...design, sauces: [...design.sauces, stroke] })
        },
        updateStroke: (id, patch) => {
          const { design } = get()
          set({
            design: { ...design, sauces: design.sauces.map((s) => (s.id === id ? { ...s, ...patch } : s)) },
          })
        },
        discardStrokeIfEmpty: (id) => {
          const { design, past } = get()
          const s = design.sauces.find((x) => x.id === id)
          if (!s || s.volume > 0) return
          set({ design: past.length ? past[past.length - 1] : design, past: past.slice(0, -1) })
        },
        removeSauce: (sauceId) => {
          const { design } = get()
          if (!design.sauces.some((s) => s.sauceId === sauceId)) return
          commit({ ...design, sauces: design.sauces.filter((s) => s.sauceId !== sauceId) })
        },

        beginBatch: (toppingId) => {
          const { design } = get()
          const id = uid('batch')
          commit({ ...design, toppings: [...design.toppings, { id, toppingId, pieces: [] }] })
          return id
        },
        addPieces: (batchId, pieces) => {
          const { design } = get()
          const batch = design.toppings.find((b) => b.id === batchId)
          if (!batch) return
          const t = catalog.toppings.find((x) => x.id === batch.toppingId)
          const room = (t?.maxPieces ?? 200) - toppingCount(design, batch.toppingId)
          if (room <= 0) return
          const add = pieces.slice(0, room)
          set({
            design: {
              ...design,
              toppings: design.toppings.map((b) => (b.id === batchId ? { ...b, pieces: [...b.pieces, ...add] } : b)),
            },
          })
        },
        discardBatchIfEmpty: (batchId) => {
          const { design, past } = get()
          const b = design.toppings.find((x) => x.id === batchId)
          if (!b || b.pieces.length > 0) return
          set({ design: past.length ? past[past.length - 1] : design, past: past.slice(0, -1) })
        },
        addToppingPieces: (toppingId, pieces) => {
          const { design } = get()
          if (!canUseTopping(design, toppingId).ok) return
          const t = catalog.toppings.find((x) => x.id === toppingId)
          const room = (t?.maxPieces ?? 200) - toppingCount(design, toppingId)
          if (room <= 0 || pieces.length === 0) return
          commit({ ...design, toppings: [...design.toppings, { id: uid('batch'), toppingId, pieces: pieces.slice(0, room) }] })
        },
        removeToppingPieces: (toppingId, count) => {
          const { design } = get()
          let remaining = count
          const next = [...design.toppings]
          // remove from the most recent batches first
          for (let i = next.length - 1; i >= 0 && remaining > 0; i--) {
            const b = next[i]
            if (b.toppingId !== toppingId || b.pieces.length === 0) continue
            const take = Math.min(remaining, b.pieces.length)
            next[i] = { ...b, pieces: b.pieces.slice(0, b.pieces.length - take) }
            remaining -= take
          }
          if (remaining === count) return
          commit({ ...design, toppings: next.filter((b) => b.pieces.length > 0) })
        },
        removeTopping: (toppingId) => {
          const { design } = get()
          if (!design.toppings.some((b) => b.toppingId === toppingId)) return
          commit({ ...design, toppings: design.toppings.filter((b) => b.toppingId !== toppingId) })
        },

        applyDesign: (next) => {
          const { design } = get()
          commit({ ...next, id: design.id })
        },
        undo: () => {
          const { past } = get()
          if (!past.length) return
          set({ design: past[past.length - 1], past: past.slice(0, -1) })
        },
        reset: () => {
          const { design } = get()
          commit({ ...createEmptyDesign(design.baseId, design.name), id: design.id })
        },
        loadDesign: (design, cartItemId) =>
          set({ design, past: [], editingCartItemId: cartItemId, rollSerial: get().rollSerial + 1 }),
        startNewRoll: () =>
          set({
            design: createEmptyDesign(get().design.baseId),
            past: [],
            editingCartItemId: null,
            rollSerial: get().rollSerial + 1,
          }),
      }
    },
    {
      name: 'rolllab-builder-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ design: s.design, editingCartItemId: s.editingCartItemId }),
    },
  ),
)
