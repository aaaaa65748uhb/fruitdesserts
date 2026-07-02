import Link from 'next/link';

export const metadata = { title: '403 — הגישה נדחתה' };

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <span className="inline-block animate-wiggle text-8xl">🚫</span>
      <h1 className="mt-6 font-display text-5xl font-black text-squid-ink">403</h1>
      <h2 className="mt-2 font-display text-2xl font-black text-squid-pink-dark">הגישה נדחתה</h2>
      <p className="mt-4 leading-relaxed text-squid-ink/60">
        אזור הניהול פתוח למנהל החנות בלבד.
        <br />
        אם אתם חושבים שזו טעות — התחברו עם חשבון המנהל המורשה.
      </p>
      <Link href="/" className="btn-primary mt-8">
        חזרה לדף הבית 🏠
      </Link>
    </div>
  );
}
