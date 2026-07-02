'use client';

import { useMemo, useState } from 'react';
import ProductCard from '@/components/ProductCard';
import { PRODUCT_CATEGORIES, PRODUCT_TAGS } from '@/lib/data/types';
import { useProducts } from '@/lib/hooks';

type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'name';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'החדשים ביותר' },
  { value: 'price-asc', label: 'מחיר: מהנמוך לגבוה' },
  { value: 'price-desc', label: 'מחיר: מהגבוה לנמוך' },
  { value: 'name', label: 'לפי שם' },
];

export default function ShopPage() {
  const { products, loading } = useProducts();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('הכל');
  const [tag, setTag] = useState<string>('הכל');
  const [maxPrice, setMaxPrice] = useState(100);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('newest');

  const filtered = useMemo(() => {
    const list = products.filter((p) => {
      if (!p.active) return false;
      const price = p.salePrice ?? p.price;
      if (category !== 'הכל' && p.category !== category) return false;
      if (tag !== 'הכל' && !p.tags.includes(tag as (typeof PRODUCT_TAGS)[number])) return false;
      if (price > maxPrice) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!p.name.includes(search.trim()) && !p.englishName.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });

    switch (sort) {
      case 'price-asc':
        return list.sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
      case 'price-desc':
        return list.sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'he'));
      default:
        return list.sort((a, b) => b.createdAt - a.createdAt);
    }
  }, [products, search, category, tag, maxPrice, inStockOnly, sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="font-display text-4xl font-black">החנות שלנו 🛍️</h1>
        <p className="mt-2 text-squid-ink/60">
          כל הסקווישים במקום אחד — רכים, חמודים ומחכים למעיכה הראשונה שלכם
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* פילטרים */}
        <aside className="card h-fit space-y-6 p-5 lg:sticky lg:top-24">
          <div>
            <label htmlFor="shop-search" className="font-display font-bold">
              חיפוש 🔍
            </label>
            <input
              id="shop-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="שם המוצר..."
              className="input-field mt-2"
            />
          </div>

          <div>
            <h3 className="font-display font-bold">קטגוריה</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {['הכל', ...PRODUCT_CATEGORIES].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`chip transition-colors ${
                    category === c
                      ? 'bg-squid-purple text-white'
                      : 'bg-squid-purple-light/50 text-squid-purple-dark hover:bg-squid-purple-light'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-display font-bold">תגית</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {['הכל', ...PRODUCT_TAGS].map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(t)}
                  className={`chip transition-colors ${
                    tag === t
                      ? 'bg-squid-pink-dark text-white'
                      : 'bg-squid-pink-light/60 text-squid-pink-dark hover:bg-squid-pink-light'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="shop-price" className="font-display font-bold">
              מחיר מקסימלי: עד ₪{maxPrice}
            </label>
            <input
              id="shop-price"
              type="range"
              min={20}
              max={100}
              step={5}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="mt-2 w-full accent-squid-pink-dark"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 font-bold">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="h-5 w-5 rounded accent-squid-purple"
            />
            רק מוצרים במלאי ✅
          </label>
        </aside>

        {/* רשימת מוצרים */}
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-squid-ink/60">
              {loading ? 'טוען מוצרים...' : `נמצאו ${filtered.length} מוצרים`}
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="input-field !w-auto !py-2 text-sm"
              aria-label="מיון מוצרים"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card h-80 animate-pulse bg-squid-purple-light/30" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <span className="text-6xl">🫥</span>
              <h2 className="mt-4 font-display text-xl font-bold">לא נמצאו מוצרים מתאימים</h2>
              <p className="mt-2 text-squid-ink/60">נסו לשנות את הפילטרים או את החיפוש</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
