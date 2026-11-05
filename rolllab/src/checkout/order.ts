import { catalog } from '../config/catalog'
import { summarizeDesign } from '../engine/customization'
import { computeCartTotals } from '../engine/pricing'
import type { CartItem, CheckoutForm, OrderPayload } from '../types'

export function orderReference() {
  const d = new Date()
  const stamp = `${d.getFullYear() % 100}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `RL-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function rollTitle(item: CartItem, index: number) {
  return item.design.name.trim() || `Roll #${index + 1}`
}

/** Builds the payload that would be sent to the bakery / payment provider. */
export function buildOrder(items: CartItem[], form: CheckoutForm): OrderPayload {
  const totals = computeCartTotals(items, form.method)
  return {
    reference: orderReference(),
    createdAt: new Date().toISOString(),
    currency: catalog.currency.code,
    customer: { name: form.name.trim(), phone: form.phone.trim() },
    fulfillment:
      form.method === 'delivery'
        ? { method: 'delivery', address: [form.street.trim(), form.apartment.trim(), form.city.trim()].filter(Boolean).join(', ') }
        : { method: 'pickup', pickupSlot: form.pickupSlot },
    notes: form.notes.trim(),
    lines: items.map((it, i) => ({
      name: rollTitle(it, i),
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      lineTotal: it.unitPrice * it.quantity,
      summary: summarizeDesign(it.design),
      design: it.design,
    })),
    subtotal: totals.subtotal,
    deliveryFee: totals.deliveryFee,
    total: totals.total,
  }
}

/** Plain-text version of the order (copy / WhatsApp). */
export function orderText(o: OrderPayload) {
  const cur = catalog.currency.symbol
  const lines = [
    `ROLL LAB order ${o.reference}`,
    '',
    ...o.lines.map((l) => `• ${l.quantity}× ${l.name} — ${cur}${l.lineTotal}\n   ${l.summary}`),
    '',
    `Subtotal: ${cur}${o.subtotal}`,
    o.deliveryFee ? `Delivery: ${cur}${o.deliveryFee}` : null,
    `Total: ${cur}${o.total}`,
    '',
    `Name: ${o.customer.name}`,
    `Phone: ${o.customer.phone}`,
    o.fulfillment.method === 'delivery' ? `Delivery to: ${o.fulfillment.address}` : `Pickup: ${o.fulfillment.pickupSlot}`,
    o.notes ? `Notes: ${o.notes}` : null,
  ]
  return lines.filter((l) => l !== null).join('\n')
}
