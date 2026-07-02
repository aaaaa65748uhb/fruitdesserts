'use client';

import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { useProducts } from '@/lib/hooks';

const USPS = [
  { emoji: '🚀', title: 'משלוח מהיר', text: 'עד יום עסקים אחד לכל הארץ' },
  { emoji: '🎧', title: 'חוויית ASMR', text: 'מרקמים רכים עם צלילים ממכרים' },
  { emoji: '🎁', title: 'Unboxing מושלם', text: 'אריזה מעוצבת + הפתעות בכל הזמנה' },
  { emoji: '💯', title: 'איכות פרימיום', text: 'חומרים בטוחים ועמידים במיוחד' },
];

export default function HomePage() {
  const { products, loading } = useProducts();
  const viral = products.filter((p) => p.active && p.tags.includes('ויראלי')).slice(0, 4);
  const newest = products.filter((p) => p.active).slice(0, 4);
  const featured = viral.length > 0 ? viral : newest;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-squid-pink-light via-squid-purple-light/50 to-squid-cream">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-fade-up text-center md:text-right">
            <span className="chip bg-white/80 text-squid-purple-dark shadow-soft">
              ✨ המותג הוויראלי של TikTok
            </span>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight md:text-6xl">
              סקווישים שאי אפשר
              <br />
              <span className="bg-gradient-to-l from-squid-pink-dark to-squid-purple-dark bg-clip-text text-transparent">
                להפסיק למעוך 🫧
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-lg text-squid-ink/70 md:mx-0">
              רכים, חמודים וממכרים — הסקווישים של Squidget כבשו מיליוני צפיות והם בדרך אליכם עם
              חוויית Unboxing בלתי נשכחת.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link href="/shop" className="btn-primary text-lg">
                לחנות שלנו 🛍️
              </Link>
              <Link href="/about" className="btn-secondary text-lg">
                הסיפור שלנו
              </Link>
            </div>
            <p className="mt-6 text-sm font-bold text-squid-ink/60">
              🎉 קוד קופון למצטרפים חדשים: <span dir="ltr" className="font-mono text-squid-pink-dark">WELCOME10</span>
            </p>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute h-64 w-64 rounded-full bg-white/50 blur-3xl" />
            <div className="relative grid grid-cols-2 gap-6">
              <span className="animate-float text-8xl drop-shadow-lg">🦑</span>
              <span className="animate-float text-8xl drop-shadow-lg [animation-delay:1s]">🥟</span>
              <span className="animate-float text-8xl drop-shadow-lg [animation-delay:2s]">🧈</span>
              <span className="animate-float text-8xl drop-shadow-lg [animation-delay:0.5s]">🦄</span>
            </div>
          </div>
        </div>
      </section>

      {/* פס USP */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {USPS.map((usp) => (
            <div key={usp.title} className="card flex items-center gap-4 p-5">
              <span className="text-4xl">{usp.emoji}</span>
              <div>
                <h3 className="font-display font-bold">{usp.title}</h3>
                <p className="text-sm text-squid-ink/60">{usp.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* הכי ויראליים */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-black">הכי ויראליים 🔥</h2>
            <p className="text-squid-ink/60">הסקווישים שכולם מדברים עליהם</p>
          </div>
          <Link href="/shop" className="font-display font-bold text-squid-purple-dark hover:underline">
            לכל המוצרים ←
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card h-80 animate-pulse bg-squid-purple-light/30" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* סקשן TikTok */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="card overflow-hidden bg-gradient-to-l from-squid-ink to-squid-purple-dark p-8 text-white md:p-12">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-black">
                4.2 מיליון צפיות בסרטון אחד 🤯
              </h2>
              <p className="mt-3 text-white/80">
                הקהילה שלנו מעלה כל יום סרטוני מעיכה, Unboxing ו-ASMR. תייגו אותנו עם
                <span className="mx-1 font-bold">#SquidgetIL</span>
                וסרטון שלכם יכול להופיע כאן!
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-sm">
                <span className="chip bg-white/15">#סקוויש_של_היום</span>
                <span className="chip bg-white/15">#מעיכה_מרגיעה</span>
                <span className="chip bg-white/15">#SquidgetIL</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['🥟', '🐱', '☁️', '🍓', '🦑', '🍰'].map((emoji, i) => (
                <div
                  key={i}
                  className="flex aspect-[3/4] items-center justify-center rounded-2xl bg-white/10 text-5xl backdrop-blur transition-transform hover:scale-105"
                >
                  {emoji}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* חדשים */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="mb-6 font-display text-3xl font-black">חדשים על המדף 🆕</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {newest.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
