"use client";
import { Box, Menu, Search, Settings, ShoppingCart, Store, Scale, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCartPricing } from "@/client/cart-pricing";
import { useUi } from "@/client/ui-store";
import { Logo } from "./Logo";
import { Price } from "./Price";
import { PriceModeBanner } from "./PriceModeBanner";

const NAV = [
  { href: "/store", label: "לסופר בתלת־ממד", icon: Box },
  { href: "/search", label: "חיפוש מוצרים", icon: Search },
  { href: "/compare", label: "השוואת מחירים", icon: Scale },
  { href: "/retailers", label: "רשתות", icon: Store },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

export function CartButton({ dark = false }: { dark?: boolean }) {
  const { itemCount, knownSubtotal } = useCartPricing();
  const setCartOpen = useUi((s) => s.setCartOpen);
  const [mounted, setMounted] = useState(false);
  const [bump, setBump] = useState(0);
  useEffect(() => setMounted(true), []);
  useEffect(() => setBump((b) => b + 1), [itemCount]);
  return (
    <button
      type="button"
      onClick={() => setCartOpen(true)}
      className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-sm transition ${dark ? "bg-white/95 text-ink hover:bg-white" : "bg-brand-700 text-white hover:bg-brand-800"}`}
      aria-label={`סל קניות, ${mounted ? itemCount : 0} פריטים`}
    >
      <ShoppingCart key={bump} className="h-5 w-5 animate-bump" />
      <Price value={mounted ? knownSubtotal : 0} />
      {mounted && itemCount > 0 && (
        <span className="num absolute -top-1.5 -left-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-sun-400 px-1 text-[11px] font-extrabold text-ink">
          {itemCount}
        </span>
      )}
    </button>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  if (pathname?.startsWith("/store")) return null; // the 3D store has its own HUD

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 glass">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" aria-label="דף הבית" className="text-xl text-ink">
          <Logo />
        </Link>
        <nav className="mr-4 hidden items-center gap-1 lg:flex" aria-label="ניווט ראשי">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition hover:bg-slate-100 ${pathname === href ? "bg-brand-50 text-brand-800" : "text-slate-700"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <form
          role="search"
          className="mr-auto hidden max-w-xs flex-1 md:block"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <label className="relative block">
            <span className="sr-only">חיפוש מוצר</span>
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חפשו במבה, חלב, קוטג'…"
              className="w-full rounded-full border border-slate-200 bg-white py-2 pr-9 pl-3 text-sm outline-none focus:border-brand-500"
            />
          </label>
        </form>
        <div className="mr-auto md:mr-0">
          <CartButton />
        </div>
        <button type="button" className="rounded-full p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-label="תפריט">
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>
      <PriceModeBanner />
      {menuOpen && (
        <nav className="animate-pop border-t border-slate-200 px-4 pb-4 lg:hidden" aria-label="ניווט נייד">
          <form
            role="search"
            className="py-3"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מוצר…" aria-label="חיפוש מוצר" className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5" />
          </form>
          <div className="grid grid-cols-2 gap-2">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-medium shadow-sm">
                <Icon className="h-4 w-4 text-brand-700" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
