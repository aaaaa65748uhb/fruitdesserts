'use client';

import { useMemo } from 'react';
import { COUPONS } from '@/lib/coupons';
import { useOrders } from '@/lib/hooks';
import { formatPrice } from '@/lib/format';
import { SHIPPING_METHODS } from '@/lib/shipping';

// צבעי גרפים מאומתים (validate_palette): ורוד דורש תווית ערך ישירה — וכולן קיימות
const CHART_PINK = '#F2609F';
const CHART_PURPLE = '#7C5CE0';
const CHART_BLUE = '#0284C7';

const DAYS_BACK = 14;

export default function AdminAnalyticsPage() {
  const { orders, loading } = useOrders();
  const active = useMemo(() => orders.filter((o) => o.status !== 'בוטל'), [orders]);

  // הכנסות לפי יום — 14 הימים האחרונים
  const daily = useMemo(() => {
    const days: { label: string; total: number }[] = [];
    const now = new Date();
    for (let i = DAYS_BACK - 1; i >= 0; i--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(day.getTime() + 86_400_000);
      const total = active
        .filter((o) => o.createdAt >= day.getTime() && o.createdAt < next.getTime())
        .reduce((sum, o) => sum + o.total, 0);
      days.push({
        label: day.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
        total: Math.round(total * 100) / 100,
      });
    }
    return days;
  }, [active]);
  const maxDaily = Math.max(1, ...daily.map((d) => d.total));

  // מוצרים נמכרים
  const topProducts = useMemo(() => {
    const byProduct = new Map<string, { name: string; emoji: string; units: number }>();
    for (const order of active) {
      for (const item of order.items) {
        const entry = byProduct.get(item.productId) ?? { name: item.name, emoji: item.emoji, units: 0 };
        entry.units += item.quantity;
        byProduct.set(item.productId, entry);
      }
    }
    return [...byProduct.values()].sort((a, b) => b.units - a.units).slice(0, 5);
  }, [active]);
  const maxUnits = Math.max(1, ...topProducts.map((p) => p.units));

  // שימוש בקופונים
  const couponStats = useMemo(() => {
    const stats = COUPONS.map((coupon) => ({
      label: coupon.code,
      count: active.filter((o) => o.couponCode === coupon.code).length,
    }));
    stats.push({ label: 'ללא קופון', count: active.filter((o) => !o.couponCode).length });
    return stats;
  }, [active]);
  const maxCoupon = Math.max(1, ...couponStats.map((c) => c.count));

  // פילוח שיטות משלוח — סדר קטגוריות קבוע
  const shippingStats = useMemo(
    () =>
      SHIPPING_METHODS.map((method, i) => ({
        label: method.label,
        count: active.filter((o) => o.shippingMethod === method.id).length,
        color: [CHART_PINK, CHART_PURPLE, CHART_BLUE][i],
      })),
    [active],
  );
  const totalShipping = Math.max(1, shippingStats.reduce((sum, s) => sum + s.count, 0));

  if (loading) {
    return <div className="py-16 text-center text-squid-ink/60">טוען נתונים...</div>;
  }

  if (active.length === 0) {
    return (
      <div className="card p-12 text-center text-squid-ink/60">
        <span className="text-5xl">📈</span>
        <p className="mt-3 font-display text-lg font-bold text-squid-ink">עדיין אין נתונים להצגה</p>
        <p className="mt-1 text-sm">האנליטיקות יתמלאו אוטומטית עם ההזמנות הראשונות</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-black">אנליטיקות 📈</h2>

      {/* הכנסות לפי יום */}
      <section className="card p-6">
        <h3 className="font-display text-lg font-bold">הכנסות — {DAYS_BACK} הימים האחרונים</h3>
        <div className="mt-6 flex h-48 items-end gap-1.5" role="img" aria-label="גרף הכנסות יומי">
          {daily.map((day) => (
            <div key={day.label} className="group relative flex flex-1 flex-col items-center justify-end">
              <span className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded-lg bg-squid-ink px-2 py-1 text-xs font-bold text-white group-hover:block">
                {day.label} · {formatPrice(day.total)}
              </span>
              <div
                className="w-full max-w-8 rounded-t transition-opacity group-hover:opacity-80"
                style={{
                  height: `${Math.max(day.total > 0 ? 4 : 1, (day.total / maxDaily) * 100)}%`,
                  backgroundColor: day.total > 0 ? CHART_PURPLE : '#E9D5FF',
                  borderRadius: '4px 4px 0 0',
                }}
              />
              <span className="mt-1 hidden text-[10px] text-squid-ink/50 sm:block">{day.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* מוצרים נמכרים */}
        <section className="card p-6">
          <h3 className="font-display text-lg font-bold">המוצרים הנמכרים ביותר</h3>
          <div className="mt-5 space-y-3">
            {topProducts.map((product) => (
              <div key={product.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-bold">{product.emoji} {product.name}</span>
                  <span className="text-squid-ink/70">{product.units} יח׳</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-squid-pink-light/40">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(product.units / maxUnits) * 100}%`, backgroundColor: CHART_PINK }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* קופונים */}
        <section className="card p-6">
          <h3 className="font-display text-lg font-bold">שימוש בקופונים</h3>
          <div className="mt-5 space-y-3">
            {couponStats.map((stat) => (
              <div key={stat.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span dir="ltr" className="font-mono font-bold">{stat.label}</span>
                  <span className="text-squid-ink/70">{stat.count} הזמנות</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-squid-blue-light/50">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(stat.count / maxCoupon) * 100}%`, backgroundColor: CHART_BLUE }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* פילוח שיטות משלוח */}
      <section className="card p-6">
        <h3 className="font-display text-lg font-bold">פילוח שיטות משלוח</h3>
        <div className="mt-5 flex h-8 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="פילוח שיטות משלוח">
          {shippingStats.map(
            (stat) =>
              stat.count > 0 && (
                <div
                  key={stat.label}
                  style={{ width: `${(stat.count / totalShipping) * 100}%`, backgroundColor: stat.color }}
                  title={`${stat.label}: ${stat.count}`}
                />
              ),
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-sm">
          {shippingStats.map((stat) => (
            <span key={stat.label} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stat.color }} />
              <span className="font-bold">{stat.label}</span>
              <span className="text-squid-ink/60">
                {stat.count} ({Math.round((stat.count / totalShipping) * 100)}%)
              </span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
