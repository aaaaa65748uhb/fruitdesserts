'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

const ADMIN_TABS = [
  { href: '/admin', label: 'לוח בקרה', emoji: '📊' },
  { href: '/admin/orders', label: 'הזמנות', emoji: '🧾' },
  { href: '/admin/products', label: 'מוצרים', emoji: '🧸' },
  { href: '/admin/customers', label: 'לקוחות', emoji: '👥' },
  { href: '/admin/analytics', label: 'אנליטיקות', emoji: '📈' },
  { href: '/admin/shipments', label: 'משלוחים', emoji: '🚚' },
];

// שער הרשאות: רק משתמש ה-Admin היחיד נכנס; כל אחד אחר מופנה ל-403.
// ההגנה האמיתית על הנתונים נמצאת ב-Firebase Security Rules.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/403/');
    }
  }, [loading, isAdmin, router]);

  if (loading) {
    return <div className="py-24 text-center text-squid-ink/60">בודק הרשאות...</div>;
  }

  if (!isAdmin || !user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">ניהול החנות ⚙️</h1>
          <p className="text-sm text-squid-ink/60">
            מחובר כמנהל: <span className="font-bold">{user.email}</span>
          </p>
        </div>
        <Link href="/" className="btn-secondary !py-2 text-sm">
          לאתר החנות ←
        </Link>
      </header>

      <nav className="no-print mb-8 flex flex-wrap gap-2 rounded-squish bg-white p-2 shadow-soft">
        {ADMIN_TABS.map((tab) => {
          const active =
            tab.href === '/admin' ? pathname === '/admin' || pathname === '/admin/' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-4 py-2 font-display text-sm font-bold transition-colors ${
                active
                  ? 'bg-squid-ink text-white'
                  : 'text-squid-ink/70 hover:bg-squid-purple-light/50'
              }`}
            >
              {tab.emoji} {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
