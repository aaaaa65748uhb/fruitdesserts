import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-4xl font-extrabold">העמוד לא נמצא</h1>
      <p className="mt-2 text-slate-600">אולי המוצר הוסר מהקטלוג.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-brand-700 px-6 py-3 font-bold text-white">לדף הבית</Link>
    </div>
  );
}
