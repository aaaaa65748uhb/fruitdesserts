import Link from 'next/link';
import SquidgetLogo from '@/components/SquidgetLogo';

export const metadata = { title: 'אודות — Squidget' };

const VALUES = [
  {
    emoji: '💗',
    title: 'רכות לפני הכל',
    text: 'כל מוצר נבדק במאות מעיכות עד שהוא מגיע לרכות המושלמת שמרגיעה באמת.',
  },
  {
    emoji: '✨',
    title: 'שמחה קטנה כל יום',
    text: 'אנחנו מאמינים שרגע קטן של כיף — מעיכה אחת — יכול לשנות את כל היום.',
  },
  {
    emoji: '🛡️',
    title: 'בטיחות ואיכות',
    text: 'חומרים בטוחים וידידותיים לילדים, עמידים במיוחד ועומדים בתקנים מחמירים.',
  },
  {
    emoji: '🌍',
    title: 'קהילה גלובלית',
    text: 'מיליוני צפיות, עשרות אלפי חברי קהילה, ואינסוף סרטוני ASMR מרגיעים.',
  },
];

export default function AboutPage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-squid-purple-light/60 to-squid-cream py-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex justify-center">
            <span className="animate-float inline-block">
              <SquidgetLogo size={96} />
            </span>
          </div>
          <h1 className="mt-6 font-display text-4xl font-black md:text-5xl">
            הסיפור של Squidget 🦑
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-squid-ink/75">
            הכל התחיל מסרטון אחד. תמנונון ורוד ורך נמעך לאט מול המצלמה, חזר לצורתו — והאינטרנט
            השתגע. תוך שבוע הסרטון חצה מיליון צפיות, ותוך חודש הבנו שמה שהתחיל כצחוק הפך לתשוקה
            אמיתית: להביא לכל בית את הרגע הרך והמרגיע הזה.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-squid-ink/75">
            היום Squidget הוא מותג הסקווישים המוביל בישראל — עם קולקציות בהשראת הטרנדים החמים
            בעולם, חוויית Unboxing שמרגישה כמו מתנה, וקהילה שמעלה כל יום סרטוני מעיכה חדשים.
            כי בעולם מהיר ולחוץ, לפעמים כל מה שצריך זה משהו רך למעוך.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-8 text-center font-display text-3xl font-black">הערכים שלנו</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((value) => (
            <div key={value.title} className="card p-6 text-center">
              <span className="text-5xl">{value.emoji}</span>
              <h3 className="mt-3 font-display text-lg font-bold">{value.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-squid-ink/65">{value.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="card bg-gradient-to-l from-squid-pink-light to-squid-purple-light p-8 text-center md:p-12">
          <h2 className="font-display text-3xl font-black">בואו למעוך איתנו 🫧</h2>
          <p className="mx-auto mt-3 max-w-xl text-squid-ink/70">
            הצטרפו לעשרות אלפי לקוחות מרוצים שכבר גילו כמה כיף יכולה להיות מעיכה אחת קטנה.
          </p>
          <Link href="/shop" className="btn-primary mt-6 text-lg">
            לחנות שלנו 🛍️
          </Link>
        </div>
      </section>
    </div>
  );
}
