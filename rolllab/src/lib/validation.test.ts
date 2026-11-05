import { describe, expect, it } from 'vitest'
import { validateCheckout, validatePhone } from './validation'
import { emptyForm } from '../store/cartStore'

describe('validatePhone', () => {
  it.each(['050-123-4567', '0501234567', '+972 50 123 4567', '972501234567', '03-1234567', '+44 7700 900123'])('accepts %s', (p) => {
    expect(validatePhone(p)).toBeNull()
  })
  it.each(['', '123', '050-12', 'hello', '+12'])('rejects %s', (p) => {
    expect(validatePhone(p)).not.toBeNull()
  })
})

describe('validateCheckout', () => {
  it('requires name and phone', () => {
    const e = validateCheckout({ ...emptyForm })
    expect(e.name).toBeTruthy()
    expect(e.phone).toBeTruthy()
  })
  it('requires an address only for delivery', () => {
    const base = { ...emptyForm, name: 'Dana', phone: '0501234567' }
    expect(validateCheckout({ ...base, method: 'pickup' })).toEqual({})
    const e = validateCheckout({ ...base, method: 'delivery' })
    expect(e.street).toBeTruthy()
    expect(e.city).toBeTruthy()
    expect(validateCheckout({ ...base, method: 'delivery', street: 'Herzl 10', city: 'Tel Aviv' })).toEqual({})
  })
})
