import { catalog as defaultCatalog } from '../config/catalog'
import type { Catalog, CartItem, Quote, QuoteLine, RollDesign } from '../types'
import { saucePortions, toppingPortions, usedSauceIds, usedToppingIds } from './customization'

/**
 * PricingEngine — the single source of truth for every price on the site.
 *
 *  total = base + filling + Σ sauces + Σ toppings + Σ extras + Σ surcharges
 *
 * A sauce or topping is charged once when used. If the customer pours or
 * sprinkles more than `extraThreshold` portions, its `extraCharge` is added as
 * a separate, clearly labelled surcharge line.
 */
export function computeQuote(design: RollDesign, cat: Catalog = defaultCatalog): Quote {
  const lines: QuoteLine[] = []
  const base = cat.bases.find((b) => b.id === design.baseId) ?? cat.bases[0]
  lines.push({ kind: 'base', refId: base.id, label: base.name, detail: 'Dough', amount: base.price })

  if (design.fillingId) {
    const f = cat.fillings.find((x) => x.id === design.fillingId)
    if (f) lines.push({ kind: 'filling', refId: f.id, label: f.name, detail: 'Filling', amount: f.price })
  }

  const surcharges: QuoteLine[] = []

  for (const id of usedSauceIds(design)) {
    const s = cat.sauces.find((x) => x.id === id)
    if (!s) continue
    const portions = saucePortions(design, id, cat)
    lines.push({ kind: 'sauce', refId: id, label: s.name, detail: `${portions.toFixed(1)} portions`, amount: s.price })
    if (portions >= cat.pricing.sauceExtraThreshold && s.extraCharge > 0) {
      surcharges.push({ kind: 'surcharge', refId: id, label: `Extra ${s.name}`, detail: 'Generous pour', amount: s.extraCharge })
    }
  }

  for (const id of usedToppingIds(design)) {
    const t = cat.toppings.find((x) => x.id === id)
    if (!t) continue
    const portions = toppingPortions(design, id, cat)
    lines.push({ kind: 'topping', refId: id, label: t.name, detail: `${portions.toFixed(1)} portions`, amount: t.price })
    if (portions >= cat.pricing.toppingExtraThreshold && t.extraCharge > 0) {
      surcharges.push({ kind: 'surcharge', refId: id, label: `Extra ${t.name}`, detail: 'Double portion', amount: t.extraCharge })
    }
  }

  for (const id of design.extras) {
    const e = cat.extras.find((x) => x.id === id)
    if (e) lines.push({ kind: 'extra', refId: id, label: e.name, detail: 'Extra', amount: e.price })
  }

  lines.push(...surcharges)

  const sum = (k: QuoteLine['kind']) => round2(lines.filter((l) => l.kind === k).reduce((a, l) => a + l.amount, 0))
  const quote: Quote = {
    lines,
    base: sum('base'),
    filling: sum('filling'),
    sauces: sum('sauce'),
    toppings: sum('topping'),
    extras: sum('extra'),
    surcharges: sum('surcharge'),
    total: 0,
  }
  quote.total = round2(quote.base + quote.filling + quote.sauces + quote.toppings + quote.extras + quote.surcharges)
  return quote
}

export interface CartTotals {
  itemCount: number
  subtotal: number
  deliveryFee: number
  total: number
  freeDeliveryRemaining: number
}

export function computeCartTotals(items: CartItem[], method: 'delivery' | 'pickup', cat: Catalog = defaultCatalog): CartTotals {
  const subtotal = round2(items.reduce((a, it) => a + it.unitPrice * it.quantity, 0))
  const itemCount = items.reduce((a, it) => a + it.quantity, 0)
  const qualifiesFree = subtotal >= cat.fulfillment.freeDeliveryOver
  const deliveryFee = method === 'delivery' && itemCount > 0 && !qualifiesFree ? cat.fulfillment.deliveryFee : 0
  return {
    itemCount,
    subtotal,
    deliveryFee,
    total: round2(subtotal + deliveryFee),
    freeDeliveryRemaining: qualifiesFree ? 0 : round2(cat.fulfillment.freeDeliveryOver - subtotal),
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
