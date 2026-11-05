import type { CheckoutForm } from '../types'

export type ErrorKey =
  | 'nameRequired'
  | 'nameTooLong'
  | 'phoneRequired'
  | 'phoneInvalid'
  | 'streetRequired'
  | 'cityRequired'
  | 'slotRequired'
  | 'notesTooLong'

/** Field → message key (the UI turns keys into words in the current language). */
export type FormErrors = Partial<Record<keyof CheckoutForm, ErrorKey>>

/** Strips spaces, dashes, dots and brackets from a phone number. */
export function normalizePhone(raw: string) {
  return raw.replace(/[\s\-().\u200e\u200f]/g, '')
}

/**
 * Accepts Israeli numbers (05X-XXXXXXX, 0X-XXXXXXX, +972…) and other
 * international numbers in +E.164 form.
 */
export function validatePhone(raw: string): ErrorKey | null {
  const p = normalizePhone(raw)
  if (!p) return 'phoneRequired'
  if (/^(?:\+972|972|0)(?:5\d|7\d|[2-4]|[89])\d{7}$/.test(p)) return null
  if (/^\+\d{8,15}$/.test(p)) return null
  return 'phoneInvalid'
}

export function validateCheckout(form: CheckoutForm): FormErrors {
  const e: FormErrors = {}
  const name = form.name.trim()
  if (name.length < 2) e.name = 'nameRequired'
  else if (name.length > 60) e.name = 'nameTooLong'
  const phone = validatePhone(form.phone)
  if (phone) e.phone = phone
  if (form.method === 'delivery') {
    if (form.street.trim().length < 3) e.street = 'streetRequired'
    if (form.city.trim().length < 2) e.city = 'cityRequired'
  } else if (!form.pickupSlot) {
    e.pickupSlot = 'slotRequired'
  }
  if (form.notes.length > 400) e.notes = 'notesTooLong'
  return e
}
