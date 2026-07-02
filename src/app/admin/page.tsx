'use client';

import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { useOrders, useProducts } from '@/lib/hooks';
import { formatDateTime, formatPrice } from '@/lib/format';

export default function AdminDashboardPage() {
  const { orders, loading: ordersLoading } = useOrders();
  const { products, loading: productsLoading } = useProducts();

  const activeOrders = orders.filter((o) => o.status !== 'בוטל');
  const revenue = activeOrders.reduce((sum, o) => sum + o.total, 0);
  const avgOrder = activeOrders.length > 0 ? revenue / activeOrders.length : 0;
  const lowStock = products.filter((p) => p.active && p.stock <= 5);
  const recentOrders = orders.slice(0, 6);

  const kpis = [
    { emoji: '💰', label: 'סה״כ הכנסות', value: formatPrice(revenue) },
    { emoji: '🧾', label: 'הזמנות', value: String(activeOrders.length) },
    { emoji: '🛒', label: 'ממוצע להזמנה', value: formatPrice(avgOrder) },
    { emoji: '⚠️', label: 'מוצרים אוזלים', value: String(lowStock.length) },
  ];

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card flex items-center gap-4 p-5">
            <span className="text-4xl">{kpi.emoji}</span>
            <div>
              <p className="text-sm text-squid-ink/60">{kpi.label}</p>
              <p className="font-display text-2xl font-black">
                {ordersLoading && productsLoading ? '...' : kpi.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* הזמנות אחרונות */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="font-display text-xl font-black">הזמנות אחרונות</h2>
            <Link href="/admin/orders" className="text-sm font-bold text-squid-purple-dark hover:underline">
              לכל ההזמנות ←
            </Link>
          </div>
          {ordersLoading ? (
            <div className="p-6 text-squid-ink/60">טוען הזמנות...</div>
          ) : recentOrders.length === 0 ? (
            <div className="p-10 text-center text-squid-ink/60">
              <span className="text-4xl">🫧</span>
              <p className="mt-2">עדיין אין הזמנות — הן יופיעו כאן בזמן אמת</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>מס׳ הזמנה</th>
                    <th>לקוח</th>
                    <th>סכום</th>
                    <th>סטטוס</th>
                    <th>תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td dir="ltr" className="font-mono text-xs">{order.orderNumber}</td>
                      <td className="font-bold">{order.customer.fullName}</td>
                      <td>{formatPrice(order.total)}</td>
                      <td><StatusBadge status={order.status} /></td>
                      <td className="text-xs text-squid-ink/60">{formatDateTime(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* התראות מלאי */}
        <section className="card p-6">
          <h2 className="font-display text-xl font-black">התראות מלאי ⚠️</h2>
          {productsLoading ? (
            <p className="mt-4 text-squid-ink/60">טוען...</p>
          ) : lowStock.length === 0 ? (
            <p className="mt-4 text-sm text-squid-ink/60">✅ כל המוצרים במלאי תקין</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {lowStock.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-2 rounded-2xl bg-squid-pink-light/40 px-4 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span className="text-xl">{product.emoji}</span>
                    {product.name}
                  </span>
                  <span className={`text-sm font-black ${product.stock === 0 ? 'text-squid-pink-dark' : 'text-amber-600'}`}>
                    {product.stock === 0 ? 'אזל!' : `נשארו ${product.stock}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/products" className="btn-secondary mt-5 w-full !py-2 text-sm">
            ניהול מלאי ←
          </Link>
        </section>
      </div>
    </div>
  );
}
