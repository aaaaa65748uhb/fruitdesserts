import type { OrderPayload } from '../types'

/**
 * PAYMENT INTEGRATION POINT
 * =========================
 * Real card payments need a small server (secret API keys must never live in
 * the browser). The website talks to that server through ONE endpoint:
 *
 *   POST  VITE_CHECKOUT_ENDPOINT
 *   body: OrderPayload (JSON)
 *   →    { "url": "https://checkout.provider.com/…" }   // hosted payment page
 *
 * The server creates the payment session with your provider (Stripe Checkout,
 * PayPlus, Tranzila, Meshulam/Grow, Cardcom, PayPal…), stores the order and
 * returns the hosted payment page URL. The customer is redirected there and
 * comes back to the site afterwards. See README → "Connecting payments".
 *
 * Until VITE_CHECKOUT_ENDPOINT is set, `placeholderProvider` is used. It never
 * pretends a payment happened: it reports `not_configured` so the UI can say
 * so clearly.
 */

export type PaymentStart =
  | { status: 'redirect'; url: string }
  | { status: 'not_configured' }
  | { status: 'error'; message: string }

export interface PaymentProvider {
  id: string
  label: string
  configured: boolean
  start(order: OrderPayload): Promise<PaymentStart>
}

const placeholderProvider: PaymentProvider = {
  id: 'placeholder',
  label: 'Payment provider (not connected)',
  configured: false,
  async start() {
    return { status: 'not_configured' }
  },
}

function httpProvider(endpoint: string): PaymentProvider {
  return {
    id: 'http',
    label: 'Secure checkout',
    configured: true,
    async start(order) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order),
        })
        if (!res.ok) return { status: 'error', message: `The payment service answered ${res.status}. Please try again.` }
        const data = (await res.json()) as { url?: string }
        if (!data.url) return { status: 'error', message: 'The payment service did not return a payment page.' }
        return { status: 'redirect', url: data.url }
      } catch {
        return { status: 'error', message: 'We couldn’t reach the payment service. Check your connection and try again.' }
      }
    },
  }
}

const endpoint = (import.meta.env.VITE_CHECKOUT_ENDPOINT as string | undefined)?.trim()

export const paymentProvider: PaymentProvider = endpoint ? httpProvider(endpoint) : placeholderProvider
