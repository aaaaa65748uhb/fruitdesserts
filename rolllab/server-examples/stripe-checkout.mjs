/**
 * EXAMPLE ONLY — a tiny serverless function that turns a ROLL LAB order into a
 * Stripe Checkout page. Deploy it on Vercel / Netlify / Cloudflare, then build
 * the site with VITE_CHECKOUT_ENDPOINT=https://your-domain/api/checkout
 *
 * Needs: npm i stripe   and an environment variable STRIPE_SECRET_KEY.
 * Never put the secret key in the website itself.
 *
 * SECURITY: prices are re-calculated here with the same pricing engine the
 * website uses, so a customer cannot change the price in their browser.
 * Copy `src/engine`, `src/config` and `src/types.ts` next to this file (or
 * import them from a shared package) so `computeQuote` and `computeCartTotals`
 * are available.
 */
import Stripe from 'stripe'
import { computeQuote, computeCartTotals } from './engine/pricing.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const SITE = process.env.SITE_URL ?? 'https://your-domain.example'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const order = req.body

  // Re-price every roll on the server.
  const items = order.lines.map((l) => ({
    design: l.design,
    unitPrice: computeQuote(l.design).total,
    quantity: Math.max(1, Math.min(20, Math.round(l.quantity))),
  }))
  const totals = computeCartTotals(items, order.fulfillment.method)

  const line_items = items.map((it, i) => ({
    quantity: it.quantity,
    price_data: {
      currency: 'ils',
      unit_amount: Math.round(it.unitPrice * 100), // agorot
      product_data: { name: order.lines[i].name, description: order.lines[i].summary.slice(0, 300) },
    },
  }))
  if (totals.deliveryFee > 0) {
    line_items.push({ quantity: 1, price_data: { currency: 'ils', unit_amount: totals.deliveryFee * 100, product_data: { name: 'Delivery' } } })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items,
    metadata: { reference: order.reference, phone: order.customer.phone, method: order.fulfillment.method },
    success_url: `${SITE}/?paid=${order.reference}`,
    cancel_url: `${SITE}/?cancelled=${order.reference}`,
  })
  // TODO for production: save `order` + session.id in your database / send it to the kitchen.
  res.status(200).json({ url: session.url })
}
