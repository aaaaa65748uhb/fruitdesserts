'use client';

import Link from 'next/link';
import { useState } from 'react';
import OrderSummary from '@/components/OrderSummary';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/format';

export default function CartPage() {
  const { items, updateQuantity, removeItem, coupon, couponError, applyCoupon, removeCoupon } =
    useCart();
  const [couponInput, setCouponInput] = useState('');

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <span className="animate-bounce-soft inline-block text-8xl">🛒</span>
        <h1 className="mt-6 font-display text-3xl font-black">הסל שלכם ריק</h1>
        <p className="mt-2 text-squid-ink/60">
          זה הזמן למלא אותו בסקווישים רכים ומפנקים! 🫧
        </p>
        <Link href="/shop" className="btn-primary mt-8">
          לחנות שלנו 🛍️
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 font-display text-4xl font-black">סל הקניות שלי 🛒</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.productId} className="card flex items-center gap-4 p-4">
              <Link
                href={`/product/?id=${item.productId}`}
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-4xl"
                style={{ background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})` }}
              >
                {item.emoji}
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/?id=${item.productId}`}
                  className="font-display font-bold hover:text-squid-pink-dark"
                >
                  {item.name}
                </Link>
                <p className="text-sm text-squid-ink/60">{formatPrice(item.price)} ליחידה</p>
              </div>

              <div className="flex items-center rounded-full border-2 border-squid-purple-light">
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="px-3 py-1 text-lg font-bold text-squid-purple-dark"
                  aria-label="הפחתת כמות"
                >
                  −
                </button>
                <span className="w-7 text-center font-bold">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="px-3 py-1 text-lg font-bold text-squid-purple-dark"
                  aria-label="הוספת כמות"
                >
                  +
                </button>
              </div>

              <span className="w-20 text-left font-display font-black">
                {formatPrice(item.price * item.quantity)}
              </span>

              <button
                onClick={() => removeItem(item.productId)}
                className="rounded-full p-2 text-lg transition-colors hover:bg-squid-pink-light"
                aria-label={`הסרת ${item.name} מהסל`}
              >
                🗑️
              </button>
            </div>
          ))}

          {/* קופון */}
          <div className="card p-5">
            <h2 className="font-display font-bold">יש לכם קוד קופון? 🎟️</h2>
            {coupon ? (
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-squid-pink-light/50 px-4 py-3">
                <span className="font-bold text-squid-pink-dark">
                  ✅ הקופון <span dir="ltr" className="font-mono">{coupon.code}</span> הופעל — {coupon.percent}% הנחה!
                </span>
                <button onClick={removeCoupon} className="text-sm font-bold underline">
                  הסרה
                </button>
              </div>
            ) : (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (applyCoupon(couponInput)) setCouponInput('');
                }}
              >
                <input
                  type="text"
                  dir="ltr"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="WELCOME10"
                  className="input-field text-left font-mono"
                  aria-label="קוד קופון"
                />
                <button type="submit" className="btn-secondary shrink-0 !py-2">
                  הפעלה
                </button>
              </form>
            )}
            {couponError && !coupon && (
              <p className="mt-2 text-sm font-bold text-squid-pink-dark">❌ {couponError}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <OrderSummary />
          <Link href="/checkout" className="btn-primary w-full text-lg">
            המשך לתשלום 💳
          </Link>
          <Link href="/shop" className="block text-center font-bold text-squid-purple-dark hover:underline">
            ← המשך בקניות
          </Link>
        </div>
      </div>
    </div>
  );
}
