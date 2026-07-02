'use client';

import { useMemo, useState } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { useCustomers, useOrders } from '@/lib/hooks';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';

export default function AdminCustomersPage() {
  const { customers, loading } = useCustomers();
  const { orders } = useOrders();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      customers.filter((customer) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          customer.fullName.toLowerCase().includes(q) ||
          customer.email.toLowerCase().includes(q) ||
          customer.phone.includes(q)
        );
      }),
    [customers, search],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-black">לקוחות 👥</h2>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם, אימייל או טלפון..."
          className="input-field !w-72 !py-2 text-sm"
          aria-label="חיפוש לקוחות"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-squid-ink/60">טוען לקוחות...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-squid-ink/60">
            <span className="text-4xl">👥</span>
            <p className="mt-2">עדיין אין לקוחות — הם יתווספו אוטומטית עם ההזמנה הראשונה</p>
          </div>
        ) : (
          <div className="divide-y divide-squid-purple-light/40">
            {filtered.map((customer) => {
              const customerOrders = orders.filter(
                (o) => o.customer.email.toLowerCase() === customer.email,
              );
              const isOpen = expanded === customer.id;
              return (
                <div key={customer.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : customer.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-6 py-4 text-right transition-colors hover:bg-squid-cream/60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-squid-purple text-lg font-bold text-white">
                        {customer.fullName.charAt(0)}
                      </span>
                      <div>
                        <div className="font-display font-bold">{customer.fullName}</div>
                        <div dir="ltr" className="text-xs text-squid-ink/60">
                          {customer.email} · {customer.phone}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-display text-lg font-black">{customer.ordersCount}</div>
                        <div className="text-xs text-squid-ink/60">הזמנות</div>
                      </div>
                      <div className="text-center">
                        <div className="font-display text-lg font-black text-squid-pink-dark">
                          {formatPrice(customer.totalSpent)}
                        </div>
                        <div className="text-xs text-squid-ink/60">סה״כ רכישות</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold">{formatDate(customer.lastOrderAt)}</div>
                        <div className="text-xs text-squid-ink/60">רכישה אחרונה</div>
                      </div>
                      <span className="text-squid-purple-dark">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="bg-squid-cream/70 px-6 py-4">
                      <h3 className="mb-3 font-display font-bold">היסטוריית רכישות</h3>
                      {customerOrders.length === 0 ? (
                        <p className="text-sm text-squid-ink/60">אין הזמנות להצגה</p>
                      ) : (
                        <ul className="space-y-2">
                          {customerOrders.map((order) => (
                            <li
                              key={order.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-soft"
                            >
                              <span dir="ltr" className="font-mono text-xs font-bold">
                                {order.orderNumber}
                              </span>
                              <span>{order.items.map((item) => item.emoji).join(' ')}</span>
                              <span className="text-xs text-squid-ink/60">
                                {formatDateTime(order.createdAt)}
                              </span>
                              <StatusBadge status={order.status} />
                              <span className="font-bold">{formatPrice(order.total)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
