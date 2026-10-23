import { ArrowLeft, Box, Database, Scale, ShieldCheck, ShoppingBasket, Store } from "lucide-react";
import Link from "next/link";
import { HomeSearch } from "@/components/HomeSearch";
import { HeroScene } from "@/components/HeroScene";
import { CATEGORIES } from "@/lib/categories";
import { RETAILERS } from "@/data/retailers";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-bl from-brand-900 via-brand-800 to-slate-900 text-white">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,#fbbf24_0,transparent_35%),radial-gradient(circle_at_80%_60%,#10b981_0,transparent_40%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm ring-1 ring-white/20">
              <Box className="h-4 w-4 text-sun-400" /> סופרמרקט תלת־ממדי בדפדפן
            </span>
            <h1 className="mt-5 text-4xl leading-tight font-extrabold md:text-6xl">
              עושים סופר
              <br />
              <span className="text-sun-400">בלי לצאת מהבית.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/80">
              מסתובבים בין המעברים, מרימים את המוצרים המוכרים מהמדף, משווים מחירים בין הרשתות וממשיכים לקנייה באתר הרשת שבחרתם.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/store" className="inline-flex items-center gap-2 rounded-full bg-sun-400 px-7 py-4 text-lg font-extrabold text-ink shadow-lg transition hover:bg-sun-500">
                כניסה לסופר <ArrowLeft className="h-5 w-5" />
              </Link>
              <Link href="/search" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-4 font-bold ring-1 ring-white/30 transition hover:bg-white/20">
                קנייה רגילה, בלי תלת־ממד
              </Link>
            </div>
            <div className="mt-8 max-w-lg">
              <HomeSearch />
            </div>
          </div>
          <HeroScene />
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <h2 className="text-2xl font-extrabold md:text-3xl">המחלקות בסופר</h2>
        <p className="mt-1 text-slate-600">כל מחלקה נמצאת במקום קבוע בחנות – בדיוק כמו בסופר השכונתי.</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.filter((c) => c.id !== "other").map((c) => (
            <Link key={c.id} href={`/search?category=${c.id}`} className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="mb-3 block h-1.5 w-10 rounded-full" style={{ background: c.color }} />
              <span className="block font-bold">{c.nameHe}</span>
              <span className="mt-1 block text-xs text-slate-500">{c.zone}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 md:grid-cols-3">
          {[
            { icon: ShoppingBasket, title: "קונים כמו בחנות", text: "הולכים במעברים, מכוונים אל מוצר ומוסיפים לסל. אותו סל זמין גם בממשק הרגיל." },
            { icon: Scale, title: "משווים בשקיפות", text: "כל מחיר מסומן לפי המקור שלו: מעודכן, שמור, לדוגמה או לא זמין. רשת בלי מחיר לכל הסל לא תוכרז כזולה." },
            { icon: Store, title: "ממשיכים לרשת", text: "בוחרים רשת, מקבלים רשימת סימון מסודרת ועוברים לאתר הרשמי. התשלום והמשלוח – אצל הרשת בלבד." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl bg-slate-50 p-6">
              <Icon className="h-8 w-8 text-brand-700" />
              <h3 className="mt-3 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Retailers + data honesty */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold">רשתות</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {RETAILERS.map((r) => (
                <Link key={r.id} href="/retailers" className="rounded-full px-4 py-2 text-sm font-bold shadow-sm" style={{ background: r.color, color: r.textColor }}>
                  {r.nameHe}
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-200">
            <div className="flex items-center gap-2 font-extrabold text-amber-900">
              <ShieldCheck className="h-5 w-5" /> שקיפות לגבי הנתונים
            </div>
            <p className="mt-2 text-sm text-amber-900/80">
              בגרסה זו המחירים המוצגים הם <b>נתונים לדוגמה</b>, עד שיחוברו קבצי המחירים שהרשתות מפרסמות לפי חוק שקיפות המחירים. אריזות המוצרים בתלת־ממד הן איורים ולא תמונות רשמיות.
            </p>
            <Link href="/data-sources" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-amber-900 underline">
              <Database className="h-4 w-4" /> מקורות הנתונים ומצבם
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
