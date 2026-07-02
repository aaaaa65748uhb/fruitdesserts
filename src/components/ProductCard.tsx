'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/lib/data/types';
import { formatPrice } from '@/lib/format';

const TAG_STYLES: Record<string, string> = {
  'חדש': 'bg-squid-blue-light text-sky-700',
  'ויראלי': 'bg-squid-pink-light text-squid-pink-dark',
  'ASMR': 'bg-squid-purple-light text-squid-purple-dark',
  'נמכר ביותר': 'bg-amber-100 text-amber-700',
};

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const outOfStock = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const price = product.salePrice ?? product.price;

  return (
    <div className="card group flex flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1">
      <Link href={`/product/?id=${product.id}`} className="block">
        <div
          className="relative flex h-44 items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${product.colors[0]}, ${product.colors[1]})` }}
        >
          <span className="text-7xl transition-transform duration-300 group-hover:scale-110 group-hover:animate-squish">
            {product.emoji}
          </span>
          {product.salePrice && (
            <span className="absolute right-3 top-3 rounded-full bg-squid-pink-dark px-3 py-1 text-xs font-bold text-white">
              מבצע! 🔥
            </span>
          )}
          {outOfStock && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70 font-display text-lg font-black text-squid-ink">
              אזל מהמלאי 😢
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1">
          {product.tags.map((tag) => (
            <span key={tag} className={`chip ${TAG_STYLES[tag] ?? 'bg-squid-cream'}`}>
              {tag}
            </span>
          ))}
        </div>

        <Link href={`/product/?id=${product.id}`}>
          <h3 className="font-display text-lg font-bold leading-tight hover:text-squid-pink-dark">
            {product.name}
          </h3>
          <p className="text-xs text-squid-ink/50">{product.englishName}</p>
        </Link>

        {lowStock && (
          <p className="text-xs font-bold text-squid-pink-dark">
            ⚡ נשארו רק {product.stock} במלאי!
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-black text-squid-ink">
              {formatPrice(price)}
            </span>
            {product.salePrice && (
              <span className="text-sm text-squid-ink/40 line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
          <button
            onClick={() => addItem(product, 1)}
            disabled={outOfStock}
            className="btn-primary !px-4 !py-2 text-sm"
            aria-label={`הוספת ${product.name} לסל`}
          >
            הוסף לסל 🛒
          </button>
        </div>
      </div>
    </div>
  );
}
