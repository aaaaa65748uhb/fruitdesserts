'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import OrderSummary from '@/components/OrderSummary';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { loadCheckoutDetails, saveLastOrder } from '@/lib/checkout-session';
import { getDataSource } from '@/lib/data';
import type { CustomerDetails, PaymentMethodId } from '@/lib/data/types';
import { formatPrice } from '@/lib/format';

interface CardForm {
  number: string;
  holder: string;
  expiry: string;
  cvv: string;
}

type CardErrors = Partial<Record<keyof CardForm, string>>;

const PAYMENT_TABS: { id: PaymentMethodId; label: string; emoji: string }[] = [
  { id: 'card', label: 'כרטיס אשראי', emoji: '💳' },
  { id: 'applepay', label: 'Apple Pay', emoji: '🍏' },
  { id: 'googlepay', label: 'Google Pay', emoji: 'Ⓖ' },
  { id: 'paypal', label: 'PayPal', emoji: '🅿️' },
];

function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function validateCard(card: CardForm): CardErrors {
  const errors: CardErrors = {};
  if (card.number.replace(/\s/g, '').length !== 16) errors.number = 'נא להזין 16 ספרות';
  if (card.holder.trim().length < 2) errors.holder = 'נא להזין את שם בעל הכרטיס';
  const [mm, yy] = card.expiry.split('/');
  const month = Number(mm);
  if (!mm || !yy || month < 1 || month > 12 || yy.length !== 2) {
    errors.expiry = 'נא להזין תוקף תקין (MM/YY)';
  }
  if (!/^\d{3,4}$/.test(card.cvv)) errors.cvv = 'נא להזין CVV תקין';
  return errors;
}

export default function PaymentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const cart = useCart();
  const [details, setDetails] = useState<CustomerDetails | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<PaymentMethodId>('card');
  const [card, setCard] = useState<CardForm>({ number: '', holder: '', expiry: '', cvv: '' });
  const [cardErrors, setCardErrors] = useState<CardErrors>({});
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetails(loadCheckoutDetails());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && !processing && (!details || cart.items.length === 0)) {
      router.replace(cart.items.length === 0 ? '/cart/' : '/checkout/');
    }
  }, [ready, details, cart.items.length, processing, router]);

  if (!ready || !details || (cart.items.length === 0 && !processing)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center text-squid-ink/60">טוען...</div>
    );
  }

  const pay = async (method: PaymentMethodId) => {
    setError(null);
    if (method === 'card') {
      const validation = validateCard(card);
      setCardErrors(validation);
      if (Object.keys(validation).length > 0) return;
    }

    setProcessing(true);
    try {
      // דמו: השהיה שמדמה סליקה — לא מתבצע חיוב אמיתי
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const order = await getDataSource().placeOrder({
        customer: details,
        items: cart.items,
        couponCode: cart.coupon?.code ?? null,
        shippingMethod: cart.shippingMethod,
        paymentMethod: method,
        uid: user?.uid ?? null,
      });

      saveLastOrder(order);
      cart.clearCart();
      router.push(`/order-success/?id=${order.id}`);
    } catch (err) {
      setProcessing(false);
      setError(err instanceof Error ? err.message : 'התשלום נכשל — נסו שוב');
    }
  };

  const setCardField = (field: keyof CardForm, value: string) => {
    setCard((c) => ({ ...c, [field]: value }));
    setCardErrors((e) => ({ ...e, [field]: undefined }));
  };

  if (processing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <span className="inline-block animate-squish text-8xl">💳</span>
        <h1 className="mt-6 font-display text-3xl font-black">מעבד את התשלום…</h1>
        <p className="mt-2 text-squid-ink/60">רק כמה שניות, לא לסגור את החלון 🫧</p>
        <div className="mx-auto mt-8 h-2 w-64 overflow-hidden rounded-full bg-squid-purple-light">
          <div className="h-full w-1/2 animate-[float_1s_ease-in-out_infinite] rounded-full bg-gradient-to-l from-squid-pink to-squid-purple" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 font-display text-4xl font-black">תשלום 💳</h1>
      <p className="mb-8 rounded-2xl bg-squid-blue-light/50 px-4 py-3 text-sm font-bold text-sky-800">
        🧪 זהו מסך תשלום דמו בלבד — לא מתבצע חיוב אמיתי ואין לשמור כאן פרטי אשראי אמיתיים.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="card p-6">
          {/* טאבים */}
          <div className="flex flex-wrap gap-2">
            {PAYMENT_TABS.map((paymentTab) => (
              <button
                key={paymentTab.id}
                onClick={() => setTab(paymentTab.id)}
                className={`rounded-full px-5 py-2.5 font-display font-bold transition-colors ${
                  tab === paymentTab.id
                    ? 'bg-squid-ink text-white'
                    : 'bg-squid-purple-light/40 text-squid-ink hover:bg-squid-purple-light'
                }`}
              >
                {paymentTab.emoji} {paymentTab.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {tab === 'card' ? (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void pay('card');
                }}
              >
                <div>
                  <label htmlFor="card-number" className="mb-1 block font-bold">
                    מספר כרטיס
                  </label>
                  <input
                    id="card-number"
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="1234 5678 9012 3456"
                    value={card.number}
                    onChange={(e) => setCardField('number', formatCardNumber(e.target.value))}
                    className={`input-field text-left font-mono ${cardErrors.number ? 'input-error' : ''}`}
                  />
                  {cardErrors.number && (
                    <p className="mt-1 text-sm font-bold text-squid-pink-dark">{cardErrors.number}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="card-holder" className="mb-1 block font-bold">
                    שם בעל הכרטיס
                  </label>
                  <input
                    id="card-holder"
                    placeholder="ישראל ישראלי"
                    value={card.holder}
                    onChange={(e) => setCardField('holder', e.target.value)}
                    className={`input-field ${cardErrors.holder ? 'input-error' : ''}`}
                  />
                  {cardErrors.holder && (
                    <p className="mt-1 text-sm font-bold text-squid-pink-dark">{cardErrors.holder}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="card-expiry" className="mb-1 block font-bold">
                      תוקף
                    </label>
                    <input
                      id="card-expiry"
                      dir="ltr"
                      inputMode="numeric"
                      placeholder="12/28"
                      value={card.expiry}
                      onChange={(e) => setCardField('expiry', formatExpiry(e.target.value))}
                      className={`input-field text-left font-mono ${cardErrors.expiry ? 'input-error' : ''}`}
                    />
                    {cardErrors.expiry && (
                      <p className="mt-1 text-sm font-bold text-squid-pink-dark">{cardErrors.expiry}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="card-cvv" className="mb-1 block font-bold">
                      CVV
                    </label>
                    <input
                      id="card-cvv"
                      dir="ltr"
                      inputMode="numeric"
                      placeholder="123"
                      maxLength={4}
                      value={card.cvv}
                      onChange={(e) => setCardField('cvv', e.target.value.replace(/\D/g, ''))}
                      className={`input-field text-left font-mono ${cardErrors.cvv ? 'input-error' : ''}`}
                    />
                    {cardErrors.cvv && (
                      <p className="mt-1 text-sm font-bold text-squid-pink-dark">{cardErrors.cvv}</p>
                    )}
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full text-lg">
                  תשלום מאובטח של {formatPrice(cart.total)} 🔒
                </button>
              </form>
            ) : (
              <div className="py-8 text-center">
                <span className="text-6xl">
                  {tab === 'applepay' ? '🍏' : tab === 'googlepay' ? 'Ⓖ' : '🅿️'}
                </span>
                <h2 className="mt-4 font-display text-xl font-black">
                  תשלום עם {PAYMENT_TABS.find((t) => t.id === tab)?.label}
                </h2>
                <p className="mt-2 text-sm text-squid-ink/60">
                  בלחיצה על הכפתור יתבצע תשלום דמו — ללא חיוב אמיתי.
                </p>
                <button onClick={() => void pay(tab)} className="btn-primary mt-6 min-w-64 text-lg">
                  אישור תשלום של {formatPrice(cart.total)}
                </button>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-2xl bg-squid-pink-light/60 px-4 py-3 font-bold text-squid-pink-dark">
                ❌ {error}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <OrderSummary showItems />
          <div className="card p-4 text-sm text-squid-ink/70">
            <p className="font-bold">📦 נשלח אל:</p>
            <p className="mt-1">
              {details.fullName} · {details.address}, {details.city}
            </p>
            <Link href="/checkout" className="mt-2 inline-block font-bold text-squid-purple-dark hover:underline">
              עריכת פרטים ←
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
