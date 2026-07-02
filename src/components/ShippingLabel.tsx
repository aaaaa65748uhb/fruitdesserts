'use client';

import SquidgetLogo from '@/components/SquidgetLogo';
import type { Order } from '@/lib/data/types';
import { formatDate } from '@/lib/format';
import { getShippingMethod } from '@/lib/shipping';

interface Props {
  order: Order;
  onClose: () => void;
}

// תווית משלוח להדפסה — "שמירה כ-PDF" דרך דיאלוג ההדפסה של הדפדפן,
// הדרך האמינה להפקת PDF בעברית מלאה עם RTL תקין.
export default function ShippingLabel({ order, onClose }: Props) {
  const method = getShippingMethod(order.shippingMethod);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-squid-ink/40 p-4 backdrop-blur-sm print:static print:block print:bg-white print:p-0 print:backdrop-blur-none">
      <div className="w-full max-w-lg">
        <div className="no-print mb-3 flex justify-between gap-2">
          <button onClick={() => window.print()} className="btn-primary !py-2 text-sm">
            🖨️ הדפסה / שמירה כ-PDF
          </button>
          <button onClick={onClose} className="btn-secondary !py-2 text-sm">
            סגירה ✖️
          </button>
        </div>

        {/* התווית עצמה */}
        <div className="rounded-2xl border-4 border-squid-ink bg-white p-6 print:rounded-none print:border-2">
          <div className="flex items-center justify-between border-b-2 border-dashed border-squid-ink/30 pb-4">
            <div className="flex items-center gap-2">
              <SquidgetLogo size={44} />
              <div>
                <div className="font-display text-xl font-black">Squidget</div>
                <div className="text-xs text-squid-ink/60">סקווישים שכיף למעוך</div>
              </div>
            </div>
            <div className="text-left">
              <div className="text-xs text-squid-ink/60">תאריך הזמנה</div>
              <div className="font-bold">{formatDate(order.createdAt)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b-2 border-dashed border-squid-ink/30 py-4">
            <div>
              <div className="text-xs font-bold text-squid-ink/60">מס׳ הזמנה</div>
              <div dir="ltr" className="text-right font-mono text-lg font-black">{order.orderNumber}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-squid-ink/60">מס׳ מעקב</div>
              <div dir="ltr" className="text-right font-mono text-lg font-black">{order.trackingId ?? '—'}</div>
            </div>
          </div>

          <div className="border-b-2 border-dashed border-squid-ink/30 py-4">
            <div className="text-xs font-bold text-squid-ink/60">נמען</div>
            <div className="mt-1 font-display text-2xl font-black">{order.customer.fullName}</div>
            <div className="mt-1 text-lg">
              {order.customer.address}
              <br />
              {order.customer.city}, {order.customer.zip}
            </div>
            <div dir="ltr" className="mt-2 text-right font-mono font-bold">{order.customer.phone}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <div className="text-xs font-bold text-squid-ink/60">שיטת משלוח</div>
              <div className="font-bold">{method.emoji} {method.label}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-squid-ink/60">תכולה</div>
              <div className="font-bold">
                {order.items.reduce((sum, item) => sum + item.quantity, 0)} פריטים{' '}
                {order.items.map((item) => item.emoji).join(' ')}
              </div>
            </div>
          </div>

          {order.customer.notes && (
            <div className="rounded-xl bg-squid-cream p-3 text-sm">
              <span className="font-bold">הערות: </span>
              {order.customer.notes}
            </div>
          )}

          {/* ברקוד דמה */}
          <div className="mt-4 flex flex-col items-center border-t-2 border-dashed border-squid-ink/30 pt-4">
            <div className="flex h-14 items-stretch gap-px" aria-hidden="true">
              {(order.trackingId ?? order.orderNumber).split('').map((char, i) => (
                <div
                  key={i}
                  className="bg-squid-ink"
                  style={{ width: `${((char.charCodeAt(0) % 4) + 1) * 1.5}px` }}
                />
              ))}
            </div>
            <div dir="ltr" className="mt-1 font-mono text-xs tracking-widest">
              {order.trackingId ?? order.orderNumber}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
