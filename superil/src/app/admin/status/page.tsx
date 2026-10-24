import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { formatDateTimeHe } from "@/lib/format";
import { adminEnabled, isAdminSession } from "@/server/admin-auth";
import { readinessReport } from "@/server/readiness";
import { AdminShell } from "../AdminShell";
import { AdminLogin } from "../prices/AdminPrices";

export const metadata: Metadata = { title: "מצב מוכנות", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { stores: "סניפים", price_full: "מחירים מלא", price: "עדכוני מחירים", promo_full: "מבצעים מלא", promo: "עדכוני מבצעים" };
const MODE: Record<string, string> = { official: "מחירים רשמיים בלבד", sample: "מחירים לדוגמה בלבד", mixed: "רשמיים + לדוגמה", none: "אין מחירים" };
const STORAGE: Record<string, string> = { postgres: "PostgreSQL", file: "קבצים מקומיים (PRICE_DATA_DIR)", "file-unsafe": "קבצים מקומיים בייצור – לא קבוע!" };

function Mark({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (ok) return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="תקין" />;
  return warn ? <CircleAlert className="h-5 w-5 shrink-0 text-amber-500" aria-label="אזהרה" /> : <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-label="חסר" />;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-3 text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" }) {
  const c = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-700" : "";
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`num text-2xl font-extrabold ${c}`}>{value}</p>
    </div>
  );
}

export default async function AdminStatusPage() {
  if (!adminEnabled()) notFound();
  if (!(await isAdminSession())) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <AdminLogin />
      </div>
    );
  }
  const r = await readinessReport();
  const readyCount = r.checklist.filter((c) => c.ok).length;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminShell>
        <div className="flex flex-wrap items-end gap-3">
          <h1 className="text-3xl font-extrabold">מצב מוכנות להשקה</h1>
          <span className="text-sm text-slate-500">עודכן {formatDateTimeHe(r.generatedAt)} · עמוד פרטי למנהלים בלבד</span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card title={`רשימת השקה (${readyCount}/${r.checklist.length})`}>
            <ul className="space-y-2 text-sm">
              {r.checklist.map((c) => (
                <li key={c.label} className="flex items-start gap-2">
                  <Mark ok={c.ok} />
                  <span>
                    {c.label}
                    {c.detail && <span className="block text-xs text-slate-500">{c.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="אחסון ומסד נתונים">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Mark ok={r.storage.connected} /> חיבור: {r.storage.connected ? "מחובר" : `לא מחובר${r.storage.error ? ` – ${r.storage.error}` : ""}`}</li>
              <li className="flex items-center gap-2"><Mark ok={r.storage.mode === "postgres"} warn={r.storage.mode === "file"} /> סוג אחסון: {STORAGE[r.storage.mode]}</li>
              <li className="flex items-center gap-2"><Mark ok={r.storage.persistentForProduction} /> נתונים נשמרים בין פריסות: {r.storage.persistentForProduction ? "כן" : "לא מובטח"}</li>
              <li className="flex items-center gap-2"><Mark ok={r.imports.archivedFiles > 0} warn /> קבצים מקוריים בארכיון: <span className="num">{r.imports.archivedFiles}</span></li>
            </ul>
          </Card>
        </div>

        <div className="mt-4">
          <Card title="מחירים">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <Stat label="מצב האתר" value={MODE[r.priceMode]} tone={r.priceMode === "official" ? "good" : "warn"} />
              <Stat label="מחירים מאומתים" value={r.prices.verified.toLocaleString("he-IL")} tone={r.prices.verified ? "good" : undefined} />
              <Stat label="מחירים שמורים" value={r.prices.saved.toLocaleString("he-IL")} />
              <Stat label="מחירים לא עדכניים" value={r.prices.stale.toLocaleString("he-IL")} tone={r.prices.stale ? "bad" : undefined} />
              <Stat label="מחירים לדוגמה מוצגים" value={r.prices.sample.toLocaleString("he-IL")} tone={r.prices.sample ? "warn" : "good"} />
              <Stat label="יובאו מחירים רשמיים" value={r.realPricesImported ? "כן" : "לא"} tone={r.realPricesImported ? "good" : "bad"} />
            </div>
            <p className="mt-3 text-xs text-slate-500">מאומת = קובץ שפורסם ב-36 השעות האחרונות; שמור = עד 7 ימים; לא עדכני = ישן יותר ואינו נכלל בחישובים.</p>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="ייבואים">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="ייבואים שבוצעו בהצלחה" value={r.imports.successful} />
              <Stat label="ניסיונות ייבוא (כולל ללא שינוי)" value={r.imports.total} />
            </div>
            <p className="mt-3 text-sm">
              ייבוא מוצלח אחרון:{" "}
              {r.imports.latestSuccessful ? (
                <b>
                  {formatDateTimeHe(r.imports.latestSuccessful.at)} · {r.imports.latestSuccessful.retailer} · {KIND[r.imports.latestSuccessful.kind] ?? r.imports.latestSuccessful.kind}
                </b>
              ) : (
                <b className="text-red-700">טרם בוצע</b>
              )}
            </p>
            {Object.keys(r.imports.byKind).length > 0 && (
              <p className="mt-1 text-xs text-slate-600">{Object.entries(r.imports.byKind).map(([k, n]) => `${KIND[k] ?? k}: ${n}`).join(" · ")}</p>
            )}
          </Card>

          <Card title="התאמות ברקוד">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="קישורים מאושרים" value={r.mappings.approved} />
              <Stat label="מוצרי קטלוג עם מחירים רשמיים" value={`${r.mappings.productsWithOfficialPrices}/${r.mappings.catalogProducts}`} tone={r.mappings.productsWithOfficialPrices ? "good" : undefined} />
              <Stat label="מוצרים עם קישור מאושר" value={r.mappings.productsWithApprovedLink} />
              <Stat label="הצעות שנדחו" value={r.mappings.rejected} />
            </div>
            {r.mappings.approvedFromFile > 0 && <p className="mt-2 text-xs text-slate-500">{r.mappings.approvedFromFile} מהקישורים מגיעים מהקובץ data/barcode-map.json.</p>}
          </Card>
        </div>

        <div className="mt-4">
          <Card title="רשתות וסניפים עם נתונים">
            {r.retailers.length === 0 ? (
              <p className="text-sm text-slate-600">טרם יובאו נתונים רשמיים לאף רשת.</p>
            ) : (
              <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2">
                <thead className="text-right text-xs text-slate-500">
                  <tr><th className="py-1">רשת</th><th>סניפים בקובץ סניפים</th><th>סניף עם מחירים</th><th>מחירים</th><th>פרסום אחרון</th><th>מצב</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.retailers.flatMap((ret) =>
                    (ret.branches.length ? ret.branches : [undefined]).map((b, i) => (
                      <tr key={`${ret.retailerId}-${b?.storeId ?? "none"}`}>
                        <td className="py-1.5 font-medium">{i === 0 ? ret.name : ""}</td>
                        <td className="num">{i === 0 ? ret.storesImported : ""}</td>
                        <td>{b ? `${b.name ?? `סניף ${b.storeId}`}${b.city ? `, ${b.city}` : ""}` : <span className="text-slate-400">אין</span>}</td>
                        <td className="num">{b ? b.offers.toLocaleString("he-IL") : "—"}</td>
                        <td>{b?.lastPublishedAt ? formatDateTimeHe(b.lastPublishedAt) : "—"}</td>
                        <td>{b ? <FreshnessBadge status={b.freshness} /> : "—"}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="mt-4">
          <Card title="הגדרות סביבה">
            <p className="mb-2 text-xs text-slate-500">מוצג רק אם ערך מוגדר ותקין – ערכים סודיים לעולם אינם מוצגים.</p>
            <ul className="divide-y divide-slate-100 text-sm">
              {r.config.map((c) => (
                <li key={c.id} className="flex items-start gap-2 py-2">
                  <Mark ok={c.level === "ok"} warn={c.level === "warn"} />
                  <span className="w-48 shrink-0 font-medium">{c.label}</span>
                  <span className="text-slate-600">{c.detail}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </AdminShell>
    </div>
  );
}
