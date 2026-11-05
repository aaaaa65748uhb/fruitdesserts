import { catalog } from '../config/catalog'
import { summarizeDesign } from '../engine/customization'
import { computeCartTotals } from '../engine/pricing'
import type { CartItem, CheckoutForm, OrderPayload } from '../types'
import { currentLang, tr } from '../i18n'

export function orderReference() {
  const d = new Date()
  const stamp = `${d.getFullYear() % 100}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `RL-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function rollTitle(item: CartItem, index: number) {
  return item.design.name.trim() || tr().rollN(index + 1)
}

/** The display text of a pickup slot (the first slot means "as soon as possible"). */
export function slotLabel(slot: string) {
  return slot === catalog.fulfillment.pickupSlots[0] ? tr().asap : slot
}

export function pickupAddress() {
  return currentLang() === 'he' && catalog.fulfillment.pickupAddressHe ? catalog.fulfillment.pickupAddressHe : catalog.fulfillment.pickupAddress
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
        : { method: 'pickup', pickupSlot: slotLabel(form.pickupSlot) },
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

/** Plain-text version of the order (copy / WhatsApp), in the customer's language. */
export function orderText(o: OrderPayload) {
  const t = tr()
  const cur = catalog.currency.symbol
  const lines = [
    t.orderTitle(o.reference),
    '',
    ...o.lines.map((l) => `• ${l.quantity}× ${l.name} — ${cur}${l.lineTotal}\n   ${l.summary}`),
    '',
    `${t.oSubtotal}: ${cur}${o.subtotal}`,
    o.deliveryFee ? `${t.oDelivery}: ${cur}${o.deliveryFee}` : null,
    `${t.oTotal}: ${cur}${o.total}`,
    '',
    `${t.oName}: ${o.customer.name}`,
    `${t.oPhone}: ${o.customer.phone}`,
    o.fulfillment.method === 'delivery' ? `${t.oDeliverTo}: ${o.fulfillment.address}` : `${t.oPickup}: ${o.fulfillment.pickupSlot}`,
    o.notes ? `${t.oNotes}: ${o.notes}` : null,
  ]
  return lines.filter((l) => l !== null).join('\n')
}
