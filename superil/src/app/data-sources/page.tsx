import type { Metadata } from "next";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { formatDateTimeHe } from "@/lib/format";
import { getProvider } from "@/server/providers";
import { RETAILER_BY_ID } from "@/data/retailers";
import { freshnessFromPublication } from "@/lib/freshness";
import { priceConfig } from "@/server/prices/config";
import { getPriceRepository } from "@/server/prices/service";

export const metadata: Metadata = { title: "מקורות נתונים" };
export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  const statuses = await (await getProvider()).getDataFreshness();
  const repo = await getPriceRepository();
  const [branches, stores, imports] = await Promise.all([repo.listPriceBranches(), repo.getStores(), repo.listImports()]);
  const lastByBranch = new Map<string, string>();
  for (const b of imports) if (b.storeId && b.kind.startsWith("price")) {
    const k = `${b.retailerId}:${b.storeId}`;
    if (!lastByBranch.has(k) || lastByBranch.get(k)! < b.publishedAt) lastByBranch.set(k, b.publishedAt);
  }
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">מקורות הנתונים</h1>
      <p className="mt-2 text-slate-600">כל מחיר ב-SUPERIL מגיע עם מקור. כך מסומנים הנתונים:</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <FreshnessBadge status="live" /> <FreshnessBadge status="cached" /> <FreshnessBadge status="sample" /> <FreshnessBadge status="unavailable" />
      </div>
      <ul className="mt-6 space-y-3">
        {statuses.map((s) => (
          <li key={s.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{s.name}</span>
              <FreshnessBadge status={s.freshness} />
              <span className={`rounded-full px-2 py-0.5 text-xs ${s.enabled ? (s.healthy ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700") : "bg-slate-100 text-slate-500"}`}>
                {s.enabled ? (s.healthy ? "פעיל" : "תקלה") : "לא פעיל"}
              </span>
              {s.lastUpdated && <span className="text-xs text-slate-500">עודכן {formatDateTimeHe(s.lastUpdated)}</span>}
            </div>
            <p className="mt-1 text-sm text-slate-600">{s.message}</p>
          </li>
        ))}
      </ul>
      <section className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-slate-100">
        <h2 className="text-lg font-extrabold">מחירים רשמיים שיובאו</h2>
        {branches.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">טרם יובא קובץ מחירים רשמי. עד אז כל המחירים באתר מסומנים &quot;נתון לדוגמה&quot;.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-right text-xs text-slate-500">
              <tr><th className="py-1">רשת</th><th>סניף</th><th>מחירים</th><th>פרסום אחרון</th><th>מצב</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branches.map((b) => {
                const s = stores.find((x) => x.retailerId === b.retailerId && x.storeId === b.storeId);
                const last = lastByBranch.get(`${b.retailerId}:${b.storeId}`) ?? b.lastFullPublishedAt;
                return (
                  <tr key={`${b.retailerId}:${b.storeId}`}>
                    <td className="py-1.5">{RETAILER_BY_ID[b.retailerId]?.nameHe ?? b.retailerId}</td>
                    <td>{s?.name ? `${s.name}${s.city && !s.cityIsCode ? `, ${s.city}` : ""}` : `סניף ${b.storeId} (פרטים לא יובאו)`}</td>
                    <td className="num">{b.offers.toLocaleString("he-IL")}</td>
                    <td>{formatDateTimeHe(last)}</td>
                    <td><FreshnessBadge status={freshnessFromPublication(last, priceConfig.verifiedMaxAgeMs, priceConfig.staleAfterMs)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <section className="mt-8 space-y-3 rounded-3xl bg-white p-6 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-100">
        <h2 className="text-lg font-extrabold text-ink">מה מחובר ומה עוד לא</h2>
        <p><b>קבצי שקיפות מחירים:</b> לפי חוק קידום התחרות בענף המזון, רשתות גדולות מפרסמות קבצי מחירים מלאים. SUPERIL מייבא קבצים אלה (מחירים, מבצעים וסניפים) לאחר בדיקות תקינות. מחיר מקובץ שפורסם ב-36 השעות האחרונות מסומן &quot;מחיר מאומת&quot;, עד 7 ימים &quot;מחיר שמור&quot;, ומעבר לכך &quot;מחיר לא עדכני&quot; ואינו נכלל בחישובים. מבצעים מוצגים עם תוקפם אך אינם מחושבים בסל. הקבצים מורדים ידנית על ידי מפעיל האתר מהפורטלים הרשמיים של הרשתות.</p>
        <p><b>CHP:</b> תנאי השימוש של CHP אינם מתירים שימוש חוזר במאגר שלו, והאתר אינו מציע API ציבורי. המתאם קיים בקוד אך כבוי עד לקבלת הרשאה כתובה.</p>
        <p><b>העברת סל לרשתות:</b> לא מצאנו ממשק רשמי של הרשתות להעברת סל או להוספה לעגלה. לכן המעבר לרשת נעשה עם רשימת סימון ופתיחת האתר הרשמי. ההזמנה והתשלום – באתר הרשת בלבד.</p>
        <p><b>תמונות מוצרים:</b> לא נעשה שימוש בתמונות אריזה רשמיות ללא הרשאה. האריזות בחנות הן איורים שנוצרו אוטומטית.</p>
      </section>
    </div>
  );
}
