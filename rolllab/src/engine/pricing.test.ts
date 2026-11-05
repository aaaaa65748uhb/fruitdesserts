import { describe, expect, it } from 'vitest'
import { catalog } from '../config/catalog'
import { computeCartTotals, computeQuote } from './pricing'
import { canUseSauce, canUseTopping, createEmptyDesign } from './customization'
import type { RollDesign, SauceStroke, ToppingBatch, ToppingPiece } from '../types'

const stroke = (sauceId: string, volume: number): SauceStroke => ({
  id: Math.random().toString(36),
  sauceId,
  kind: 'line',
  points: [],
  drips: [],
  volume,
})
const piece = (): ToppingPiece => ({ x: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, sx: 1, sy: 1, sz: 1, c: 0, bornAt: 0, drop: 0 })
const batch = (toppingId: string, n: number): ToppingBatch => ({
  id: Math.random().toString(36),
  toppingId,
  pieces: Array.from({ length: n }, piece),
})

describe('PricingEngine', () => {
  it('charges only the base for an empty roll', () => {
    for (const b of catalog.bases) {
      const q = computeQuote(createEmptyDesign(b.id))
      expect(q.total).toBe(b.price)
      expect(q.lines).toHaveLength(1)
    }
  })

  it('adds filling, sauces, toppings and extras', () => {
    const d: RollDesign = {
      ...createEmptyDesign('pistachio'),
      fillingId: 'caramel',
      sauces: [stroke('pistachio', 0.01), stroke('pistachio', 0.002), stroke('white-chocolate', 0.006)],
      toppings: [batch('chopped-pistachio', 30), batch('chocolate-chips', 10)],
      extras: ['candle'],
    }
    const q = computeQuote(d)
    // 23 base + 4 caramel + 5 pistachio + 3 white choc + 4 chopped pist + 3 chips + 2 candle
    expect(q.total).toBe(44)
    expect(q.sauces).toBe(8)
    expect(q.toppings).toBe(7)
    expect(q.surcharges).toBe(0)
  })

  it('charges a sauce once no matter how many strokes', () => {
    const d = { ...createEmptyDesign('classic'), sauces: [stroke('lotus', 0.001), stroke('lotus', 0.001), stroke('lotus', 0.001)] }
    expect(computeQuote(d).sauces).toBe(4)
  })

  it('adds an extra-pour surcharge above the threshold', () => {
    const vol = catalog.pricing.saucePortionVolume * (catalog.pricing.sauceExtraThreshold + 0.1)
    const d = { ...createEmptyDesign('classic'), sauces: [stroke('salted-caramel', vol)] }
    const q = computeQuote(d)
    expect(q.surcharges).toBe(2)
    expect(q.total).toBe(18 + 4 + 2)
    expect(q.lines.some((l) => l.kind === 'surcharge' && l.label === 'Extra Salted Caramel')).toBe(true)
  })

  it('adds a double-portion topping surcharge', () => {
    const t = catalog.toppings.find((x) => x.id === 'hazelnut')!
    const d = { ...createEmptyDesign('classic'), toppings: [batch('hazelnut', Math.ceil(t.portion * catalog.pricing.toppingExtraThreshold))] }
    const q = computeQuote(d)
    expect(q.total).toBe(18 + t.price + t.extraCharge)
  })

  it('ignores empty topping batches', () => {
    const d = { ...createEmptyDesign('classic'), toppings: [batch('coconut', 0)] }
    expect(computeQuote(d).total).toBe(18)
  })

  it('enforces sauce and topping limits', () => {
    const d = {
      ...createEmptyDesign('classic'),
      sauces: ['lotus', 'strawberry', 'vanilla-glaze', 'dark-chocolate'].map((id) => stroke(id, 0.001)),
      toppings: ['sprinkles', 'coconut', 'hazelnut', 'almond-flakes', 'cookie-crumbs'].map((id) => batch(id, 3)),
    }
    expect(canUseSauce(d, 'lotus').ok).toBe(true)
    expect(canUseSauce(d, 'pistachio').ok).toBe(false)
    expect(canUseTopping(d, 'sprinkles').ok).toBe(true)
    expect(canUseTopping(d, 'chocolate-chips').ok).toBe(false)
  })
})

describe('Cart totals', () => {
  const item = (unitPrice: number, quantity: number) => ({
    id: 'x',
    design: createEmptyDesign(),
    unitPrice,
    quantity,
    thumbnail: null,
    addedAt: 0,
  })

  it('adds delivery fee below the free threshold', () => {
    const t = computeCartTotals([item(30, 2)], 'delivery')
    expect(t.subtotal).toBe(60)
    expect(t.deliveryFee).toBe(catalog.fulfillment.deliveryFee)
    expect(t.total).toBe(60 + catalog.fulfillment.deliveryFee)
  })

  it('makes delivery free above the threshold and for pickup', () => {
    expect(computeCartTotals([item(70, 2)], 'delivery').deliveryFee).toBe(0)
    expect(computeCartTotals([item(20, 1)], 'pickup').deliveryFee).toBe(0)
  })
})
