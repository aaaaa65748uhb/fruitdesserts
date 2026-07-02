import Link from 'next/link';
import SquidgetLogo from '@/components/SquidgetLogo';

export default function Footer() {
  return (
    <footer className="no-print mt-16 border-t border-squid-pink-light/60 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <SquidgetLogo size={36} />
            <span className="font-display text-xl font-black">Squidget</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-squid-ink/70">
            סקווישים שכיף למעוך 🦑💗
            <br />
            המותג הוויראלי שהופך כל יום לרך יותר.
          </p>
        </div>

        <div>
          <h3 className="font-display font-bold">ניווט מהיר</h3>
          <ul className="mt-3 space-y-2 text-sm text-squid-ink/70">
            <li><Link href="/shop" className="hover:text-squid-pink-dark">החנות שלנו</Link></li>
            <li><Link href="/cart" className="hover:text-squid-pink-dark">סל הקניות</Link></li>
            <li><Link href="/my-orders" className="hover:text-squid-pink-dark">ההזמנות שלי</Link></li>
            <li><Link href="/about" className="hover:text-squid-pink-dark">הסיפור שלנו</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-display font-bold">שירות לקוחות</h3>
          <ul className="mt-3 space-y-2 text-sm text-squid-ink/70">
            <li><Link href="/contact" className="hover:text-squid-pink-dark">יצירת קשר</Link></li>
            <li>משלוחים לכל הארץ 📦</li>
            <li>החזרות עד 14 יום 💯</li>
            <li>תמיכה: בימים א׳-ה׳ 9:00-17:00</li>
          </ul>
        </div>

        <div>
          <h3 className="font-display font-bold">עקבו אחרינו</h3>
          <p className="mt-3 text-sm text-squid-ink/70">
            הצטרפו למיליוני הצפיות שלנו ברשתות ✨
          </p>
          <div className="mt-3 flex gap-2">
            <span className="chip bg-squid-pink-light text-squid-pink-dark">TikTok 🎵</span>
            <span className="chip bg-squid-purple-light text-squid-purple-dark">Instagram 📸</span>
          </div>
          <p className="mt-3 text-xs text-squid-ink/50">#SquidgetIL #סקוויש_של_היום</p>
        </div>
      </div>
      <div className="border-t border-squid-pink-light/60 py-4 text-center text-xs text-squid-ink/50">
        © {new Date().getFullYear()} Squidget — כל הזכויות שמורות. נבנה באהבה ובהמון מעיכות 🫧
      </div>
    </footer>
  );
}
