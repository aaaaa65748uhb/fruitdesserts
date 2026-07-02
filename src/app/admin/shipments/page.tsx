'use client';

import { useMemo, useState } from 'react';
import ShippingLabel from '@/components/ShippingLabel';
import StatusBadge from '@/components/StatusBadge';
import { getDataSource } from '@/lib/data';
import { SHIPMENT_STATUSES, type Order, type ShipmentStatus } from '@/lib/data/types';
import { useOrders } from '@/lib/hooks';
import { formatDateTime } from '@/lib/format';
import { getShippingMethod } from '@/lib/shipping';

export default function AdminShipmentsPage() {
  const { orders, loading } = useOrders();
  const [labelOrder, setLabelOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  const shippable = useMemo(() => orders.filter((o) => o.status !== 'בוטל'), [orders]);
  const pending = shippable.filter((o) => !o.trackingId);
  const shipments = shippable.filter((o) => o.trackingId);

  const createShipment = async (order: Order) => {
    setError(null);
    setCreating(order.id);
    try {
      await getDataSource().createShipment(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'יצירת המשלוח נכשלה');
    } finally {
      setCreating(null);
    }
  };

  const advanceStatus = async (order: Order) => {
    const index = SHIPMENT_STATUSES.indexOf(order.status as ShipmentStatus);
    if (index < 0 || index >= SHIPMENT_STATUSES.length - 1) return;
    setError(null);
    try {
      await getDataSource().updateOrderStatus(order.id, SHIPMENT_STATUSES[index + 1]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'עדכון הסטטוס נכשל');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-black">ניהול משלוחים 🚚</h2>
      <p className="-mt-4 text-sm text-squid-ink/60">
        שרשרת סטטוסים: {SHIPMENT_STATUSES.join(' ← ')}
      </p>

      {error && (
        <p className="rounded-2xl bg-squid-pink-light/60 px-4 py-3 font-bold text-squid-pink-dark">
          ❌ {error}
        </p>
      )}

      {/* הזמנות ללא משלוח */}
      <section className="card overflow-hidden">
        <h3 className="px-6 py-4 font-display text-lg font-bold">
          ממתינות ליצירת משלוח ({pending.length})
        </h3>
        {loading ? (
          <div className="p-8 text-center text-squid-ink/60">טוען...</div>
        ) : pending.length === 0 ? (
          <div className="p-8 text-center text-sm text-squid-ink/60">
            ✅ אין הזמנות שממתינות למשלוח
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>מס׳ הזמנה</th>
                  <th>לקוח</th>
                  <th>יעד</th>
                  <th>שיטת משלוח</th>
                  <th>תאריך</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((order) => (
                  <tr key={order.id}>
                    <td dir="ltr" className="font-mono text-xs font-bold">{order.orderNumber}</td>
                    <td className="font-bold">{order.customer.fullName}</td>
                    <td className="text-xs">{order.customer.city}</td>
                    <td className="text-xs">
                      {getShippingMethod(order.shippingMethod).emoji}{' '}
                      {getShippingMethod(order.shippingMethod).label}
                    </td>
                    <td className="text-xs text-squid-ink/60">{formatDateTime(order.createdAt)}</td>
                    <td>
                      <button
                        onClick={() => void createShipment(order)}
                        disabled={creating === order.id}
                        className="btn-primary !px-4 !py-1.5 text-xs"
                      >
                        {creating === order.id ? 'יוצר...' : 'יצירת משלוח 🏷️'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* משלוחים פעילים */}
      <section className="card overflow-hidden">
        <h3 className="px-6 py-4 font-display text-lg font-bold">משלוחים ({shipments.length})</h3>
        {shipments.length === 0 ? (
          <div className="p-8 text-center text-sm text-squid-ink/60">
            עדיין לא נוצרו משלוחים
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>מס׳ מעקב</th>
                  <th>מס׳ הזמנה</th>
                  <th>לקוח</th>
                  <th>כתובת</th>
                  <th>סטטוס</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((order) => {
                  const statusIndex = SHIPMENT_STATUSES.indexOf(order.status as ShipmentStatus);
                  const isLast = statusIndex === SHIPMENT_STATUSES.length - 1;
                  return (
                    <tr key={order.id}>
                      <td dir="ltr" className="font-mono text-xs font-bold text-squid-purple-dark">
                        {order.trackingId}
                      </td>
                      <td dir="ltr" className="font-mono text-xs">{order.orderNumber}</td>
                      <td>
                        <div className="font-bold">{order.customer.fullName}</div>
                        <div dir="ltr" className="text-xs text-squid-ink/60">{order.customer.phone}</div>
                      </td>
                      <td className="text-xs">
                        {order.customer.address}, {order.customer.city} {order.customer.zip}
                      </td>
                      <td><StatusBadge status={order.status} /></td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {!isLast && statusIndex >= 0 && (
                            <button
                              onClick={() => void advanceStatus(order)}
                              className="rounded-full bg-squid-purple-light/50 px-3 py-1 text-xs font-bold text-squid-purple-dark hover:bg-squid-purple-light"
                            >
                              קידום ל״{SHIPMENT_STATUSES[statusIndex + 1]}״ ←
                            </button>
                          )}
                          <button
                            onClick={() => setLabelOrder(order)}
                            className="rounded-full bg-squid-pink-light/50 px-3 py-1 text-xs font-bold text-squid-pink-dark hover:bg-squid-pink-light"
                          >
                            🖨️ תווית משלוח (PDF)
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {labelOrder && <ShippingLabel order={labelOrder} onClose={() => setLabelOrder(null)} />}
    </div>
  );
}
