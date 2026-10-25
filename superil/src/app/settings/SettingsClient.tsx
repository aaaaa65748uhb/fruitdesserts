"use client";
import { useSettings, type GraphicsQuality } from "@/client/settings-store";
import { RETAILERS } from "@/data/retailers";

export function SettingsClient() {
  const s = useSettings();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">הגדרות</h1>
      <div className="mt-6 space-y-4">
        <Row label="שפה" hint="ממשק באנגלית יתווסף בהמשך – מבנה התרגום מוכן.">
          <select value={s.locale} onChange={(e) => s.set({ locale: e.target.value as "he" | "en" })} className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="he">עברית</option>
            <option value="en" disabled>English (בקרוב)</option>
          </select>
        </Row>
        <Row label="רגישות עכבר / מגע" hint={`${s.mouseSensitivity.toFixed(1)}×`}>
          <input type="range" min={0.3} max={2.5} step={0.1} value={s.mouseSensitivity} onChange={(e) => s.set({ mouseSensitivity: Number(e.target.value) })} className="w-48 accent-brand-700" aria-label="רגישות עכבר" />
        </Row>
        <Row label="מהירות הליכה" hint={`${s.moveSpeed.toFixed(1)}×`}>
          <input type="range" min={0.5} max={2} step={0.1} value={s.moveSpeed} onChange={(e) => s.set({ moveSpeed: Number(e.target.value) })} className="w-48 accent-brand-700" aria-label="מהירות הליכה" />
        </Row>
        <Row label="איכות גרפיקה" hint="״נמוכה״ מתאימה לטלפונים ולמחשבים חלשים.">
          <div className="flex gap-1 rounded-full bg-slate-100 p-1" role="radiogroup" aria-label="איכות גרפיקה">
            {(["auto", "high", "low"] as GraphicsQuality[]).map((g) => (
              <button key={g} type="button" role="radio" aria-checked={s.graphics === g} onClick={() => s.set({ graphics: g })} className={`rounded-full px-3 py-1.5 text-sm ${s.graphics === g ? "bg-white font-bold shadow-sm" : ""}`}>
                {g === "auto" ? "אוטומטי" : g === "high" ? "גבוהה" : "נמוכה"}
              </button>
            ))}
          </div>
        </Row>
        <Row label="צלילים">
          <button type="button" role="switch" aria-checked={s.sound} onClick={() => s.set({ sound: !s.sound })} className={`relative h-7 w-12 rounded-full transition ${s.sound ? "bg-brand-600" : "bg-slate-300"}`} aria-label="צלילים">
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${s.sound ? "right-1" : "right-6"}`} />
          </button>
        </Row>
        <Row label="עגלה בחנות התלת־ממדית" hint="עגלת קניות לפניכם, עם המוצרים שבסל. אפשר גם להחליף במקש C.">
          <button type="button" role="switch" aria-checked={s.showCart !== false} onClick={() => s.set({ showCart: s.showCart === false })} className={`relative h-7 w-12 rounded-full transition ${s.showCart !== false ? "bg-brand-600" : "bg-slate-300"}`} aria-label="עגלה בחנות התלת־ממדית">
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${s.showCart !== false ? "right-1" : "right-6"}`} />
          </button>
        </Row>
        <Row label="רשת מועדפת" hint="המחירים בחנות ובסל יוצגו לפי רשת זו כשיש לה מחיר.">
          <select value={s.preferredRetailerId ?? ""} onChange={(e) => s.set({ preferredRetailerId: e.target.value || undefined })} className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="">הזול ביותר הידוע</option>
            {RETAILERS.map((r) => <option key={r.id} value={r.id}>{r.nameHe}</option>)}
          </select>
        </Row>
        <Row label="אזור קנייה מועדף" hint="נשמר רק בדפדפן שלכם.">
          <input value={s.preferredCity ?? ""} onChange={(e) => s.set({ preferredCity: e.target.value || undefined })} placeholder="לדוגמה: חיפה" className="rounded-xl border border-slate-200 px-3 py-2" aria-label="אזור קנייה מועדף" />
        </Row>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div>
        <p className="font-bold">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
