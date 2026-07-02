'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import ProductCard from '@/components/ProductCard';
import { useCart } from '@/context/CartContext';
import { useProducts } from '@/lib/hooks';
import { formatPrice } from '@/lib/format';

function ProductContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const { products, loading } = useProducts();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const product = products.find((p) => p.id === id) ?? null;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="card h-96 animate-pulse bg-squid-purple-light/30" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <span className="text-7xl">🔍</span>
        <h1 className="mt-4 font-display text-2xl font-black">המוצר לא נמצא</h1>
        <p className="mt-2 text-squid-ink/60">אולי הוא נמעך חזק מדי... בואו נמצא לכם אחד אחר!</p>
        <Link href="/shop" className="btn-primary mt-6">
          חזרה לחנות
        </Link>
      </div>
    );
  }

  const price = product.salePrice ?? product.price;
  const outOfStock = product.stock <= 0;
  const related = products
    .filter((p) => p.active && p.id !== product.id && p.category === product.category)
    .slice(0, 3);

  const handleAdd = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addItem(product, quantity);
    router.push('/cart');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-sm text-squid-ink/60">
        <Link href="/" className="hover:text-squid-pink-dark">בית</Link>
        {' / '}
        <Link href="/shop" className="hover:text-squid-pink-dark">חנות</Link>
        {' / '}
        <span className="font-bold text-squid-ink">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        {/* גלריה */}
        <div
          className="card relative flex h-96 items-center justify-center overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${product.colors[0]}, ${product.colors[1]})` }}
        >
          <span className="animate-squish text-[10rem] drop-shadow-xl">{product.emoji}</span>
          {product.salePrice && (
            <span className="absolute right-4 top-4 rounded-full bg-squid-pink-dark px-4 py-1.5 font-bold text-white">
              מבצע! 🔥
            </span>
          )}
        </div>

        {/* פרטים */}
        <div>
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <span key={tag} className="chip bg-squid-purple-light text-squid-purple-dark">
                {tag}
              </span>
            ))}
          </div>
          <h1 className="mt-3 font-display text-4xl font-black">{product.name}</h1>
          <p className="text-squid-ink/50">
            {product.englishName} · {product.category}
          </p>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display text-4xl font-black text-squid-pink-dark">
              {formatPrice(price)}
            </span>
            {product.salePrice && (
              <span className="text-xl text-squid-ink/40 line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>

          <p className="mt-5 leading-relaxed text-squid-ink/80">{product.description}</p>

          <div className="mt-4">
            {outOfStock ? (
              <p className="font-bold text-squid-pink-dark">😢 אזל מהמלאי — בקרוב חוזר!</p>
            ) : product.stock <= 5 ? (
              <p className="font-bold text-squid-pink-dark">⚡ נשארו רק {product.stock} יחידות במלאי!</p>
            ) : (
              <p className="font-bold text-emerald-600">✅ במלאי — מוכן למשלוח מיידי</p>
            )}
          </div>

          {!outOfStock && (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-full border-2 border-squid-purple-light">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-4 py-2 text-xl font-bold text-squid-purple-dark"
                  aria-label="הפחתת כמות"
                >
                  −
                </button>
                <span className="w-8 text-center font-display text-lg font-bold">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  className="px-4 py-2 text-xl font-bold text-squid-purple-dark"
                  aria-label="הוספת כמות"
                >
                  +
                </button>
              </div>
              <button onClick={handleAdd} className="btn-primary">
                {added ? 'נוסף לסל! ✅' : 'הוספה לסל 🛒'}
              </button>
              <button onClick={handleBuyNow} className="btn-secondary">
                קנייה מיידית ⚡
              </button>
            </div>
          )}

          <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-squid-ink/60">
            <div className="rounded-2xl bg-white p-3 shadow-soft">
              🚚 משלוח מהיר
              <br />
              לכל הארץ
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-soft">
              🎁 אריזת מתנה
              <br />
              בכל הזמנה
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-soft">
              💯 החזרה חינם
              <br />
              עד 14 יום
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-black">אולי תאהבו גם 💕</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="card h-96 animate-pulse bg-squid-purple-light/30" />
        </div>
      }
    >
      <ProductContent />
    </Suspense>
  );
}
