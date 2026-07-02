'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { loadLastOrder } from '@/lib/checkout-session';
import type { Order } from '@/lib/data/types';
import { PAYMENT_METHOD_LABELS } from '@/lib/data/types';
import { formatDateTime, formatPrice } from '@/lib/format';
import { getShippingMethod } from '@/lib/shipping';

function OrderSuccessContent() {
  const [order, setOrder] = useState<Order | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOrder(loadLastOrder());
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="py-24 text-center text-squid-ink/60">טוען...</div>;
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <span className="text-7xl">🤔</span>
        <h1 className="mt-4 font-display text-2xl font-black">לא נמצאה הזמנה להצגה</h1>
        <p className="mt-2 text-squid-ink/60">ניתן לצפות בהזמנות קודמות בעמוד "ההזמנות שלי"</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/my-orders" className="btn-secondary">ההזמנות שלי</Link>
          <Link href="/shop" className="btn-primary">לחנות</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <span className="inline-block animate-pop text-8xl">🎉</span>
        <h1 className="mt-4 font-display text-4xl font-black text-squid-pink-dark">
          ההזמנה התקבלה בהצלחה!
        </h1>
        <p className="mt-3 text-lg text-squid-ink/70">
          תודה {order.customer.fullName.split(' ')[0]}! הסקווישים כבר מתרגשים לפגוש אתכם 🦑💗
        </p>
        <p className="mt-2 text-sm text-squid-ink/60">
          אישור הזמנה יישלח לכתובת <span className="font-bold">{order.customer.email}</span>
        </p>
      </div>

      <div className="card mt-10 overflow-hidden">
        <div className="bg-gradient-to-l from-squid-pink-light to-squid-purple-light px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-lg font-black">
              הזמנה מספר <span dir="ltr" className="font-mono">{order.orderNumber}</span>
            </span>
            <span className="text-sm text-squid-ink/70">{formatDateTime(order.createdAt)}</span>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <ul className="space-y-3">
            {order.items.map((item) => (
              <li key={item.productId} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-2xl">{item.emoji}</span>
                  <span>
                    {item.name} <span className="text-squid-ink/50">× {item.quantity}</span>
                  </span>
                </span>
                <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-squid-purple-light/50 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-squid-ink/70">סכום ביניים</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-squid-pink-dark">
                <dt>הנחת קופון ({order.couponCode})</dt>
                <dd>-{formatPrice(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-squid-ink/70">
                משלוח — {getShippingMethod(order.shippingMethod).label}
              </dt>
              <dd>{order.shippingCost === 0 ? 'חינם' : formatPrice(order.shippingCost)}</dd>
            </div>
            <div className="flex justify-between border-t border-squid-purple-light/50 pt-2 font-display text-lg font-black">
              <dt>סה״כ שולם</dt>
              <dd className="text-squid-pink-dark">{formatPrice(order.total)}</dd>
            </div>
          </dl>

          <div className="rounded-2xl bg-squid-cream p-4 text-sm">
            <p>
              <span className="font-bold">אמצעי תשלום:</span>{' '}
              {PAYMENT_METHOD_LABELS[order.paymentMethod]} (דמו)
            </p>
            <p className="mt-1">
              <span className="font-bold">כתובת למשלוח:</span> {order.customer.address},{' '}
              {order.customer.city} {order.customer.zip}
            </p>
            {order.customer.notes && (
              <p className="mt-1">
                <span className="font-bold">הערות:</span> {order.customer.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/my-orders" className="btn-secondary">
          מעקב אחר ההזמנה 📦
        </Link>
        <Link href="/shop" className="btn-primary">
          המשך בקניות 🛍️
        </Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-squid-ink/60">טוען...</div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}
