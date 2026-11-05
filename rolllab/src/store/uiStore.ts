import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type Screen = 'intro' | 'build' | 'review' | 'checkout'
/** Box choreography used when a finished roll is packed into the cart. */
export type PackPhase = 'idle' | 'closing' | 'sealed' | 'leaving' | 'arriving'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'warn' | 'success'
}

interface UIState {
  screen: Screen
  cartOpen: boolean
  receiptOpen: boolean
  extrasOpen: boolean
  inspect: boolean
  muted: boolean
  lidOpen: boolean
  packPhase: PackPhase
  toast: Toast | null
  hint: string | null
  sceneReady: boolean
  setScreen: (s: Screen) => void
  setCartOpen: (v: boolean) => void
  setReceiptOpen: (v: boolean) => void
  setExtrasOpen: (v: boolean) => void
  setInspect: (v: boolean) => void
  toggleMuted: () => void
  setLidOpen: (v: boolean) => void
  setPackPhase: (p: PackPhase) => void
  showToast: (text: string, tone?: Toast['tone']) => void
  setHint: (hint: string | null) => void
  setSceneReady: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      screen: 'intro',
      cartOpen: false,
      receiptOpen: false,
      extrasOpen: false,
      inspect: false,
      muted: false,
      lidOpen: false,
      packPhase: 'idle',
      toast: null,
      hint: null,
      sceneReady: false,
      setScreen: (screen) => set({ screen, inspect: false, extrasOpen: false }),
      setCartOpen: (cartOpen) => set({ cartOpen }),
      setReceiptOpen: (receiptOpen) => set({ receiptOpen }),
      setExtrasOpen: (extrasOpen) => set({ extrasOpen }),
      setInspect: (inspect) => set({ inspect }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setLidOpen: (lidOpen) => set({ lidOpen }),
      setPackPhase: (packPhase) => set({ packPhase }),
      showToast: (text, tone = 'info') => {
        clearTimeout(toastTimer)
        const id = Date.now()
        set({ toast: { id, text, tone } })
        toastTimer = setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), 2800)
      },
      setHint: (hint) => set({ hint }),
      setSceneReady: () => set({ sceneReady: true }),
    }),
    {
      name: 'rolllab-ui-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ muted: s.muted }),
    },
  ),
)
