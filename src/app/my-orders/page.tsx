'use client';

import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { useMyOrders } from '@/lib/hooks';
import { SHIPMENT_STATUSES } from '@/lib/data/types';
import { formatDateTime, formatPrice } from '@/lib/format';
import { getShippingMethod } from '@/lib/shipping';

export default function MyOrdersPage() {
  const { user, loading: authLoading, isDemo, signInWithGoogle, demoSignIn } = useAuth();
  const { orders, loading } = useMyOrders(user?.uid ?? null);

  if (authLoading) {
    return <div className="py-24 text-center text-squid-ink/60">טוען...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <span className="text-8xl">🔐</span>
        <h1 className="mt-6 font-display text-3xl font-black">ההזמנות שלי</h1>
        <p className="mt-2 text-squid-ink/60">
          כדי לצפות בהיסטוריית ההזמנות שלכם יש להתחבר עם חשבון Google
        </p>
        {isDemo ? (
          <button onClick={() => demoSignIn(false)} className="btn-primary mt-8">
            כניסת דמו כלקוח 👤
          </button>
        ) : (
          <button onClick={() => void signInWithGoogle()} className="btn-primary mt-8">
            התחברות עם Google
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 font-display text-4xl font-black">ההזמנות שלי 📦</h1>
      <p className="mb-8 text-squid-ink/60">שלום {user.displayName}! כאן כל ההזמנות שלכם</p>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card h-40 animate-pulse bg-squid-purple-light/30" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="text-6xl">🫧</span>
          <h2 className="mt-4 font-display text-xl font-bold">עדיין אין הזמנות</h2>
          <p className="mt-2 text-squid-ink/60">ההזמנה הראשונה שלכם מחכה ממש מעבר לפינה</p>
          <Link href="/shop" className="btn-primary mt-6">
            לחנות שלנו 🛍️
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const statusIndex = SHIPMENT_STATUSES.indexOf(
              order.status as (typeof SHIPMENT_STATUSES)[number],
            );
            return (
              <div key={order.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-squid-purple-light/30 px-6 py-4">
                  <div>
                    <span className="font-display font-black">
                      הזמנה <span dir="ltr" className="font-mono">{order.orderNumber}</span>
                    </span>
                    <span className="mx-2 text-squid-ink/40">·</span>
                    <span className="text-sm text-squid-ink/60">
                      {formatDateTime(order.createdAt)}
                    </span>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="p-6">
                  <ul className="flex flex-wrap gap-4">
                    {order.items.map((item) => (
                      <li key={item.productId} className="flex items-center gap-2 text-sm">
                        <span className="text-2xl">{item.emoji}</span>
                        {item.name} × {item.quantity}
                      </li>
                    ))}
                  </ul>

                  {/* פס התקדמות משלוח */}
                  {order.status !== 'בוטל' && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between">
                        {SHIPMENT_STATUSES.map((status, i) => (
                          <div key={status} className="flex flex-1 flex-col items-center gap-1">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                i <= statusIndex
                                  ? 'bg-squid-pink-dark text-white'
                                  : 'bg-squid-purple-light/50 text-squid-ink/40'
                              }`}
                            >
                              {i + 1}
                            </span>
                            <span
                              className={`text-xs ${
                                i <= statusIndex ? 'font-bold text-squid-ink' : 'text-squid-ink/40'
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-squid-purple-light/50 pt-4 text-sm">
                    <div className="text-squid-ink/70">
                      {getShippingMethod(order.shippingMethod).label}
                      {order.trackingId && (
                        <>
                          {' · '}מספר מעקב:{' '}
                          <span dir="ltr" className="font-mono font-bold text-squid-purple-dark">
                            {order.trackingId}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="font-display text-lg font-black">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
