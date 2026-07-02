'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import SquidgetLogo from '@/components/SquidgetLogo';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

const NAV_LINKS = [
  { href: '/', label: 'בית' },
  { href: '/shop', label: 'חנות' },
  { href: '/about', label: 'אודות' },
  { href: '/contact', label: 'יצירת קשר' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin, isDemo, signInWithGoogle, signOut, demoSignIn } = useAuth();
  const { itemsCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-squid-pink-light/60 bg-white/90 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <span className="animate-bounce-soft">
              <SquidgetLogo size={40} />
            </span>
            <span className="font-display text-2xl font-black tracking-tight text-squid-ink">
              Squidget
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 font-display font-bold transition-colors ${
                  isActive(link.href)
                    ? 'bg-squid-pink-light text-squid-pink-dark'
                    : 'text-squid-ink/70 hover:bg-squid-purple-light/40 hover:text-squid-ink'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            className="relative rounded-full bg-squid-pink-light/60 p-2.5 text-xl transition-transform hover:scale-110"
            aria-label="סל הקניות"
          >
            🛒
            {itemsCount > 0 && (
              <span className="absolute -left-1 -top-1 flex h-5 min-w-5 animate-pop items-center justify-center rounded-full bg-squid-pink-dark px-1 text-xs font-bold text-white">
                {itemsCount}
              </span>
            )}
          </Link>

          <div className="relative">
            {user ? (
              <button
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full bg-squid-purple-light/50 py-1.5 pe-3 ps-1.5 font-bold text-squid-ink transition-colors hover:bg-squid-purple-light"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-squid-purple text-sm text-white">
                  {user.displayName.charAt(0)}
                </span>
                <span className="hidden max-w-28 truncate text-sm sm:block">{user.displayName}</span>
              </button>
            ) : isDemo ? (
              <button
                onClick={() => setUserMenuOpen((open) => !open)}
                className="btn-secondary !px-4 !py-2 text-sm"
              >
                התחברות
              </button>
            ) : (
              <button onClick={() => void signInWithGoogle()} className="btn-secondary !px-4 !py-2 text-sm">
                התחברות עם Google
              </button>
            )}

            {userMenuOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 w-56 animate-pop rounded-2xl border border-squid-purple-light bg-white p-2 shadow-soft">
                {user ? (
                  <>
                    <div className="border-b border-squid-purple-light/50 px-3 py-2 text-xs text-squid-ink/60">
                      {user.email}
                    </div>
                    <Link
                      href="/my-orders"
                      onClick={() => setUserMenuOpen(false)}
                      className="block rounded-xl px-3 py-2 font-bold hover:bg-squid-pink-light/50"
                    >
                      📦 ההזמנות שלי
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="block rounded-xl px-3 py-2 font-bold hover:bg-squid-pink-light/50"
                      >
                        ⚙️ ניהול החנות
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        void signOut();
                        setUserMenuOpen(false);
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-right font-bold text-squid-pink-dark hover:bg-squid-pink-light/50"
                    >
                      🚪 התנתקות
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-2 text-xs text-squid-ink/60">
                      מצב דמו — התחברות לצורך התנסות
                    </div>
                    <button
                      onClick={() => {
                        demoSignIn(false);
                        setUserMenuOpen(false);
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-right font-bold hover:bg-squid-pink-light/50"
                    >
                      👤 כניסת דמו כלקוח
                    </button>
                    <button
                      onClick={() => {
                        demoSignIn(true);
                        setUserMenuOpen(false);
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-right font-bold hover:bg-squid-pink-light/50"
                    >
                      🛠️ כניסת דמו כמנהל
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-full p-2 text-2xl md:hidden"
            aria-label="תפריט"
          >
            {mobileOpen ? '✖️' : '🍔'}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="animate-fade-up border-t border-squid-pink-light/60 bg-white px-4 py-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`block rounded-xl px-4 py-3 font-display font-bold ${
                isActive(link.href) ? 'bg-squid-pink-light text-squid-pink-dark' : 'text-squid-ink/80'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/my-orders"
            onClick={() => setMobileOpen(false)}
            className="block rounded-xl px-4 py-3 font-display font-bold text-squid-ink/80"
          >
            ההזמנות שלי
          </Link>
        </div>
      )}
    </header>
  );
}
