'use client';

import { Fragment, useMemo, useState } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { getDataSource } from '@/lib/data';
import { ORDER_STATUSES, type Order, type OrderStatus } from '@/lib/data/types';
import { PAYMENT_METHOD_LABELS } from '@/lib/data/types';
import { useOrders } from '@/lib/hooks';
import { formatDateTime, formatPrice } from '@/lib/format';
import { getShippingMethod } from '@/lib/shipping';

export default function AdminOrdersPage() {
  const { orders, loading } = useOrders();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('הכל');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        if (statusFilter !== 'הכל' && order.status !== statusFilter) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          return (
            order.orderNumber.toLowerCase().includes(q) ||
            order.customer.fullName.toLowerCase().includes(q) ||
            order.customer.email.toLowerCase().includes(q) ||
            order.customer.phone.includes(q)
          );
        }
        return true;
      }),
    [orders, search, statusFilter],
  );

  const changeStatus = async (order: Order, status: OrderStatus) => {
    setUpdateError(null);
    try {
      await getDataSource().updateOrderStatus(order.id, status);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'עדכון הסטטוס נכשל');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-black">ניהול הזמנות 🧾</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי מס׳ הזמנה, שם, אימייל או טלפון..."
            className="input-field !w-72 !py-2 text-sm"
            aria-label="חיפוש הזמנות"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field !w-auto !py-2 text-sm"
            aria-label="סינון לפי סטטוס"
          >
            <option value="הכל">כל הסטטוסים</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      {updateError && (
        <p className="rounded-2xl bg-squid-pink-light/60 px-4 py-3 font-bold text-squid-pink-dark">
          ❌ {updateError}
        </p>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-squid-ink/60">טוען הזמנות...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-squid-ink/60">
            <span className="text-4xl">🫧</span>
            <p className="mt-2">לא נמצאו הזמנות</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>מס׳ הזמנה</th>
                  <th>לקוח</th>
                  <th>טלפון</th>
                  <th>מוצרים</th>
                  <th>סה״כ</th>
                  <th>סטטוס</th>
                  <th>תאריך</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <Fragment key={order.id}>
                    <tr className="hover:bg-squid-cream/60">
                      <td dir="ltr" className="font-mono text-xs font-bold">{order.orderNumber}</td>
                      <td>
                        <div className="font-bold">{order.customer.fullName}</div>
                        <div dir="ltr" className="text-xs text-squid-ink/60">{order.customer.email}</div>
                      </td>
                      <td dir="ltr" className="font-mono text-xs">{order.customer.phone}</td>
                      <td>
                        <span className="text-lg">{order.items.map((item) => item.emoji).join(' ')}</span>
                        <span className="ms-1 text-xs text-squid-ink/60">
                          ({order.items.reduce((sum, item) => sum + item.quantity, 0)} פריטים)
                        </span>
                      </td>
                      <td className="font-bold">{formatPrice(order.total)}</td>
                      <td>
                        <select
                          value={order.status}
                          onChange={(e) => void changeStatus(order, e.target.value as OrderStatus)}
                          className="rounded-full border-2 border-squid-purple-light bg-white px-2 py-1 text-xs font-bold"
                          aria-label={`סטטוס הזמנה ${order.orderNumber}`}
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td className="whitespace-nowrap text-xs text-squid-ink/60">
                        {formatDateTime(order.createdAt)}
                      </td>
                      <td>
                        <button
                          onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                          className="rounded-full bg-squid-purple-light/50 px-3 py-1 text-xs font-bold text-squid-purple-dark hover:bg-squid-purple-light"
                        >
                          {expanded === order.id ? 'סגירה ▲' : 'פירוט ▼'}
                        </button>
                      </td>
                    </tr>
                    {expanded === order.id && (
                      <tr>
                        <td colSpan={8} className="!bg-squid-cream/70">
                          <div className="grid gap-4 p-4 md:grid-cols-3">
                            <div>
                              <h3 className="mb-2 font-display font-bold">פריטים</h3>
                              <ul className="space-y-1 text-sm">
                                {order.items.map((item) => (
                                  <li key={item.productId} className="flex justify-between">
                                    <span>{item.emoji} {item.name} × {item.quantity}</span>
                                    <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
                                  </li>
                                ))}
                              </ul>
                              <dl className="mt-3 space-y-1 border-t border-squid-purple-light/50 pt-2 text-sm">
                                <div className="flex justify-between">
                                  <dt>סכום ביניים</dt><dd>{formatPrice(order.subtotal)}</dd>
                                </div>
                                {order.discount > 0 && (
                                  <div className="flex justify-between text-squid-pink-dark">
                                    <dt>הנחה ({order.couponCode})</dt><dd>-{formatPrice(order.discount)}</dd>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <dt>משלוח</dt><dd>{formatPrice(order.shippingCost)}</dd>
                                </div>
                                <div className="flex justify-between font-black">
                                  <dt>סה״כ</dt><dd>{formatPrice(order.total)}</dd>
                                </div>
                              </dl>
                            </div>
                            <div>
                              <h3 className="mb-2 font-display font-bold">משלוח</h3>
                              <p className="text-sm">
                                {getShippingMethod(order.shippingMethod).emoji}{' '}
                                {getShippingMethod(order.shippingMethod).label}
                              </p>
                              <p className="mt-1 text-sm">
                                {order.customer.address}, {order.customer.city} {order.customer.zip}
                              </p>
                              {order.trackingId && (
                                <p className="mt-1 text-sm">
                                  מעקב: <span dir="ltr" className="font-mono font-bold">{order.trackingId}</span>
                                </p>
                              )}
                              {order.customer.notes && (
                                <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm">
                                  📝 {order.customer.notes}
                                </p>
                              )}
                            </div>
                            <div>
                              <h3 className="mb-2 font-display font-bold">תשלום</h3>
                              <p className="text-sm">{PAYMENT_METHOD_LABELS[order.paymentMethod]} (דמו)</p>
                              <StatusBadge status={order.status} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
