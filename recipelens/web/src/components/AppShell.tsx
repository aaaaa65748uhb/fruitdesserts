import { BookOpen, ChefHat, FolderHeart, PlusCircle, ShoppingCart } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Recipes', icon: BookOpen, end: true },
  { to: '/collections', label: 'Collections', icon: FolderHeart, end: false },
  { to: '/import', label: 'Import', icon: PlusCircle, end: false },
  { to: '/shopping', label: 'Shopping', icon: ShoppingCart, end: false },
];

/** Mobile-first shell: content column, sticky header, thumb-reachable nav. */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const hideNav = location.pathname.includes('/cook');

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Skip to content
      </a>
      <main id="main" className={`mx-auto w-full max-w-3xl flex-1 px-4 pt-4 ${hideNav ? 'pb-6' : 'pb-28'}`}>
        {children}
      </main>
      {hideNav ? null : <BottomNav />}
    </div>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-[60px] flex-col items-center justify-center gap-1 text-xs font-medium transition ${
                  isActive ? 'text-brand-600' : 'text-neutral-500 hover:text-neutral-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="h-5 w-5" aria-hidden="true" strokeWidth={isActive ? 2.4 : 1.8} />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight text-neutral-900">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-neutral-600">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-bold text-neutral-900">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
        <ChefHat className="h-5 w-5" aria-hidden="true" />
      </span>
      RecipeLens
    </span>
  );
}
