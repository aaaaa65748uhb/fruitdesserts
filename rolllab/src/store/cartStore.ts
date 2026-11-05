import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CartItem, CheckoutForm, RollDesign } from '../types'
import { uid } from '../lib/id'
import { catalog } from '../config/catalog'

interface CartState {
  items: CartItem[]
  form: CheckoutForm
  add: (design: RollDesign, unitPrice: number, thumbnail: string | null) => string
  replace: (id: string, design: RollDesign, unitPrice: number, thumbnail: string | null) => void
  setQuantity: (id: string, quantity: number) => void
  remove: (id: string) => void
  clear: () => void
  updateForm: (patch: Partial<CheckoutForm>) => void
}

export const emptyForm: CheckoutForm = {
  name: '',
  phone: '',
  method: 'pickup',
  street: '',
  city: '',
  apartment: '',
  pickupSlot: catalog.fulfillment.pickupSlots[0] ?? '',
  notes: '',
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      form: emptyForm,
      add: (design, unitPrice, thumbnail) => {
        const id = uid('item')
        set({ items: [...get().items, { id, design, unitPrice, quantity: 1, thumbnail, addedAt: Date.now() }] })
        return id
      },
      replace: (id, design, unitPrice, thumbnail) => {
        const exists = get().items.some((i) => i.id === id)
        if (!exists) {
          get().add(design, unitPrice, thumbnail)
          return
        }
        set({ items: get().items.map((i) => (i.id === id ? { ...i, design, unitPrice, thumbnail: thumbnail ?? i.thumbnail } : i)) })
      },
      setQuantity: (id, quantity) => {
        const q = Math.max(1, Math.min(20, Math.round(quantity)))
        set({ items: get().items.map((i) => (i.id === id ? { ...i, quantity: q } : i)) })
      },
      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      clear: () => set({ items: [] }),
      updateForm: (patch) => set({ form: { ...get().form, ...patch } }),
    }),
    {
      name: 'rolllab-cart-v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
