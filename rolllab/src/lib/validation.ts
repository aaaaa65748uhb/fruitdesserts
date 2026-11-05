import type { CheckoutForm } from '../types'

export type FormErrors = Partial<Record<keyof CheckoutForm, string>>

/** Strips spaces, dashes, dots and brackets from a phone number. */
export function normalizePhone(raw: string) {
  return raw.replace(/[\s\-().]/g, '')
}

/**
 * Accepts Israeli numbers (05X-XXXXXXX, 0X-XXXXXXX, +972…) and other
 * international numbers in +E.164 form.
 */
export function validatePhone(raw: string): string | null {
  const p = normalizePhone(raw)
  if (!p) return 'Please enter a phone number so we can reach you about your order.'
  if (/^(?:\+972|972|0)(?:5\d|7\d|[2-4]|[89])\d{7}$/.test(p)) return null
  if (/^\+\d{8,15}$/.test(p)) return null
  return 'That phone number doesn’t look right — e.g. 050-123-4567 or +972 50 123 4567.'
}

export function validateCheckout(form: CheckoutForm): FormErrors {
  const e: FormErrors = {}
  const name = form.name.trim()
  if (name.length < 2) e.name = 'Please enter your name (at least 2 characters).'
  else if (name.length > 60) e.name = 'That name is a bit long — 60 characters max.'
  const phone = validatePhone(form.phone)
  if (phone) e.phone = phone
  if (form.method === 'delivery') {
    if (form.street.trim().length < 3) e.street = 'Please enter a street and number.'
    if (form.city.trim().length < 2) e.city = 'Please enter a city.'
  } else if (!form.pickupSlot) {
    e.pickupSlot = 'Please choose a pickup time.'
  }
  if (form.notes.length > 400) e.notes = 'Notes can be up to 400 characters.'
  return e
}
