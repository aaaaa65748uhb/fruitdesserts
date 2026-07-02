'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import OrderSummary from '@/components/OrderSummary';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { loadCheckoutDetails, saveCheckoutDetails } from '@/lib/checkout-session';
import type { CustomerDetails } from '@/lib/data/types';
import { SHIPPING_METHODS } from '@/lib/shipping';
import { formatPrice } from '@/lib/format';

type FormErrors = Partial<Record<keyof CustomerDetails, string>>;

const EMPTY_DETAILS: CustomerDetails = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  zip: '',
  notes: '',
};

function validate(details: CustomerDetails): FormErrors {
  const errors: FormErrors = {};
  if (details.fullName.trim().length < 2) errors.fullName = 'נא להזין שם מלא';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) {
    errors.email = 'נא להזין כתובת אימייל תקינה';
  }
  if (!/^0\d{1,2}-?\d{7}$/.test(details.phone.replace(/\s/g, ''))) {
    errors.phone = 'נא להזין מספר טלפון ישראלי תקין';
  }
  if (details.address.trim().length < 3) errors.address = 'נא להזין כתובת מלאה';
  if (details.city.trim().length < 2) errors.city = 'נא להזין עיר';
  if (!/^\d{5,7}$/.test(details.zip.trim())) errors.zip = 'נא להזין מיקוד תקין (5-7 ספרות)';
  return errors;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, shippingMethod, setShippingMethod } = useCart();
  const [details, setDetails] = useState<CustomerDetails>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    const saved = loadCheckoutDetails();
    if (saved) {
      setDetails(saved);
    } else if (user) {
      setDetails((d) => ({ ...d, fullName: d.fullName || user.displayName, email: d.email || user.email }));
    }
  }, [user]);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <span className="text-7xl">🛒</span>
        <h1 className="mt-4 font-display text-2xl font-black">הסל ריק — אין מה לשלם עדיין</h1>
        <Link href="/shop" className="btn-primary mt-6">
          לחנות שלנו
        </Link>
      </div>
    );
  }

  const setField = (field: keyof CustomerDetails, value: string) => {
    setDetails((d) => ({ ...d, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validate(details);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    saveCheckoutDetails(details);
    router.push('/payment/');
  };

  const field = (
    name: keyof CustomerDetails,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label htmlFor={`checkout-${name}`} className="mb-1 block font-bold">
        {label}
      </label>
      <input
        id={`checkout-${name}`}
        value={details[name]}
        onChange={(e) => setField(name, e.target.value)}
        className={`input-field ${errors[name] ? 'input-error' : ''}`}
        {...props}
      />
      {errors[name] && <p className="mt-1 text-sm font-bold text-squid-pink-dark">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 font-display text-4xl font-black">פרטי משלוח 📦</h1>
      <p className="mb-8 text-squid-ink/60">עוד רגע קטן והסקווישים בדרך אליכם!</p>

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-6">
            <h2 className="font-display text-xl font-black">הפרטים שלכם</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {field('fullName', 'שם מלא *', { placeholder: 'ישראל ישראלי', autoComplete: 'name' })}
              {field('email', 'אימייל *', {
                placeholder: 'israel@example.com',
                type: 'email',
                dir: 'ltr',
                autoComplete: 'email',
              })}
              {field('phone', 'טלפון *', {
                placeholder: '050-1234567',
                type: 'tel',
                dir: 'ltr',
                autoComplete: 'tel',
              })}
              {field('city', 'עיר *', { placeholder: 'תל אביב', autoComplete: 'address-level2' })}
              {field('address', 'כתובת מלאה *', {
                placeholder: 'רחוב הסקוויש 12, דירה 4',
                autoComplete: 'street-address',
              })}
              {field('zip', 'מיקוד *', {
                placeholder: '6100000',
                dir: 'ltr',
                inputMode: 'numeric',
                autoComplete: 'postal-code',
              })}
            </div>
            <div>
              <label htmlFor="checkout-notes" className="mb-1 block font-bold">
                הערות להזמנה
              </label>
              <textarea
                id="checkout-notes"
                value={details.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="בקשות מיוחדות, הוראות לשליח..."
                rows={3}
                className="input-field resize-none"
              />
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-display text-xl font-black">שיטת משלוח 🚚</h2>
            <div className="mt-4 space-y-3">
              {SHIPPING_METHODS.map((method) => (
                <label
                  key={method.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-colors ${
                    shippingMethod === method.id
                      ? 'border-squid-purple bg-squid-purple-light/30'
                      : 'border-squid-purple-light/50 hover:border-squid-purple-light'
                  }`}
                >
                  <input
                    type="radio"
                    name="shipping"
                    checked={shippingMethod === method.id}
                    onChange={() => setShippingMethod(method.id)}
                    className="h-5 w-5 accent-squid-purple"
                  />
                  <span className="text-3xl">{method.emoji}</span>
                  <span className="flex-1">
                    <span className="block font-display font-bold">{method.label}</span>
                    <span className="block text-sm text-squid-ink/60">
                      {method.description} · {method.eta}
                    </span>
                  </span>
                  <span className="font-display font-black">
                    {method.price === 0 ? 'חינם!' : formatPrice(method.price)}
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <OrderSummary showItems />
          <button type="submit" className="btn-primary w-full text-lg">
            המשך לתשלום 💳
          </button>
          <Link href="/cart" className="block text-center font-bold text-squid-purple-dark hover:underline">
            ← חזרה לסל
          </Link>
        </div>
      </form>
    </div>
  );
}
