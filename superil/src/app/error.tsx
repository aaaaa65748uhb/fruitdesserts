"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-extrabold">משהו השתבש</h1>
      <p className="mt-2 text-slate-600">אירעה שגיאה בטעינת העמוד.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-full bg-brand-700 px-6 py-3 font-bold text-white">נסו שוב</button>
    </div>
  );
}
