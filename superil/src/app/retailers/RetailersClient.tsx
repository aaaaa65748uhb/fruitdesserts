"use client";
import { ExternalLink, LocateFixed, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useBranches, useRetailers } from "@/client/queries";
import { useSettings } from "@/client/settings-store";
import { normalizeText } from "@/lib/search";
import type { IntegrationLevel } from "@/lib/types";

const INTEGRATION_LABEL: Record<IntegrationLevel, { text: string; cls: string }> = {
  official_api: { text: "העברת סל רשמית", cls: "bg-emerald-100 text-emerald-800" },
  deep_link: { text: "קישורי מוצר רשמיים", cls: "bg-sky-100 text-sky-800" },
  homepage_handoff: { text: "רשימת סימון + מעבר לאתר", cls: "bg-amber-100 text-amber-900" },
  none: { text: "אין קנייה מקוונת", cls: "bg-slate-100 text-slate-600" },
};

export function RetailersClient() {
  const { data } = useRetailers();
  const { preferredRetailerId, set } = useSettings();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [geoMsg, setGeoMsg] = useState<string>();
  const branches = useBranches(undefined, city.trim() || undefined);
  const retailers = useMemo(
    () => (data?.retailers ?? []).filter((r) => !q || normalizeText(`${r.nameHe} ${r.nameEn}`).includes(normalizeText(q))),
    [data, q],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">רשתות וסניפים</h1>
      <p className="mt-1 text-slate-600">כל רשת היא ישות נפרדת עם מחירים משלה. מחיר בסניף אחד אינו מעיד על סניף אחר.</p>

      <label className="relative mt-5 block max-w-md">
        <span className="sr-only">חיפוש רשת</span>
        <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש רשת" className="w-full rounded-full border border-slate-200 bg-white py-2.5 pr-9 pl-3" />
      </label>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {retailers.map((r) => {
          const integ = INTEGRATION_LABEL[r.integration];
          const preferred = preferredRetailerId === r.id;
          return (
            <article key={r.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl text-lg font-extrabold" style={{ background: r.color, color: r.textColor }}>
                  {r.nameHe.slice(0, 1)}
                </span>
                <div>
                  <h2 className="text-lg font-extrabold">{r.nameHe}</h2>
                  <p className="text-xs text-slate-500" dir="ltr">{r.nameEn}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-medium ${integ.cls}`}>{integ.text}</span>
                {r.onlineShopping && <span className="rounded-full bg-slate-100 px-2 py-0.5">קנייה אונליין באתר הרשת</span>}
              </div>
              <dl className="mt-3 space-y-1 text-sm text-slate-600">
                <div className="flex justify-between"><dt>דמי משלוח</dt><dd>{r.deliveryFee !== undefined ? r.deliveryFee : "לא ידוע"}</dd></div>
                <div className="flex justify-between"><dt>הזמנת מינימום</dt><dd>{r.minimumOrder !== undefined ? r.minimumOrder : "לא ידוע"}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={r.homepageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-bold text-white">
                  לאתר הרשת <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button type="button" onClick={() => set({ preferredRetailerId: preferred ? undefined : r.id })} aria-pressed={preferred} className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${preferred ? "bg-brand-700 text-white ring-brand-700" : "ring-slate-200"}`}>
                  {preferred ? "הרשת המועדפת" : "קביעה כמועדפת"}
                </button>
              </div>
              {!r.homepageVerified && <p className="mt-2 text-[11px] text-slate-400">כתובת האתר טרם אומתה ע״י מפעיל SUPERIL.</p>}
            </article>
          );
        })}
      </div>

      <section className="mt-10 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h2 className="flex items-center gap-2 text-xl font-extrabold"><MapPin className="h-5 w-5 text-brand-700" /> חיפוש סניפים</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="עיר או מיקוד" aria-label="עיר או מיקוד" className="rounded-full border border-slate-200 px-4 py-2" />
          <button
            type="button"
            onClick={() => {
              if (!("geolocation" in navigator)) return setGeoMsg("הדפדפן אינו תומך באיתור מיקום.");
              navigator.geolocation.getCurrentPosition(
                () => setGeoMsg("המיקום התקבל, אך עדיין אין נתוני מיקום סניפים לחיפוש לפי קרבה. המיקום לא נשמר ולא נשלח לשרת."),
                () => setGeoMsg("לא התקבלה הרשאה למיקום."),
              );
            }}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-4 py-2 font-bold"
          >
            <LocateFixed className="h-4 w-4" /> שימוש במיקום שלי
          </button>
        </div>
        {geoMsg && <p className="mt-2 text-sm text-slate-600">{geoMsg}</p>}
        {branches.data?.branches.length ? (
          <ul className="mt-4 divide-y divide-slate-100">
            {branches.data.branches.map((b) => (
              <li key={b.id} className="py-2 text-sm">
                <b>{b.name}</b> · {b.city} <span className="text-xs text-slate-400">({b.source})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{branches.data?.note ?? "טוען…"}</p>
        )}
      </section>
    </div>
  );
}
