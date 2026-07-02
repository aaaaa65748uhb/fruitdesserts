'use client';

import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/format';
import { getShippingMethod } from '@/lib/shipping';

// סיכום הזמנה משותף לסל, ל-checkout ולעמוד התשלום
export default function OrderSummary({ showItems = false }: { showItems?: boolean }) {
  const { items, subtotal, discount, coupon, shippingCost, shippingMethod, total } = useCart();

  return (
    <div className="card p-6">
      <h2 className="font-display text-xl font-black">סיכום הזמנה 🧾</h2>

      {showItems && (
        <ul className="mt-4 space-y-2 border-b border-squid-purple-light/50 pb-4 text-sm">
          {items.map((item) => (
            <li key={item.productId} className="flex items-center justify-between gap-2">
              <span>
                {item.emoji} {item.name} × {item.quantity}
              </span>
              <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-squid-ink/70">סכום ביניים</dt>
          <dd className="font-bold">{formatPrice(subtotal)}</dd>
        </div>
        {discount > 0 && coupon && (
          <div className="flex justify-between text-squid-pink-dark">
            <dt>
              הנחת קופון ({coupon.code} — {coupon.percent}%)
            </dt>
            <dd className="font-bold">-{formatPrice(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-squid-ink/70">משלוח — {getShippingMethod(shippingMethod).label}</dt>
          <dd className="font-bold">{shippingCost === 0 ? 'חינם!' : formatPrice(shippingCost)}</dd>
        </div>
        <div className="flex justify-between border-t-2 border-squid-purple-light pt-3 font-display text-lg font-black">
          <dt>סה״כ לתשלום</dt>
          <dd className="text-squid-pink-dark">{formatPrice(total)}</dd>
        </div>
      </dl>
    </div>
  );
}
