import type { Metadata } from "next";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { formatDateTimeHe } from "@/lib/format";
import { getProvider } from "@/server/providers";

export const metadata: Metadata = { title: "מקורות נתונים" };
export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  const statuses = await (await getProvider()).getDataFreshness();
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
      <section className="mt-8 space-y-3 rounded-3xl bg-white p-6 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-100">
        <h2 className="text-lg font-extrabold text-ink">מה מחובר ומה עוד לא</h2>
        <p><b>קבצי שקיפות מחירים:</b> לפי חוק קידום התחרות בענף המזון, רשתות גדולות מפרסמות קבצי מחירים מלאים. SUPERIL יודע לייבא קבצים אלה (מחיר שמור עם תאריך עדכון לכל סניף). הקבצים מורדים על ידי מפעיל האתר מהפורטלים הרשמיים של הרשתות.</p>
        <p><b>CHP:</b> תנאי השימוש של CHP אינם מתירים שימוש חוזר במאגר שלו, והאתר אינו מציע API ציבורי. המתאם קיים בקוד אך כבוי עד לקבלת הרשאה כתובה.</p>
        <p><b>העברת סל לרשתות:</b> לא מצאנו ממשק רשמי של הרשתות להעברת סל או להוספה לעגלה. לכן המעבר לרשת נעשה עם רשימת סימון ופתיחת האתר הרשמי. ההזמנה והתשלום – באתר הרשת בלבד.</p>
        <p><b>תמונות מוצרים:</b> לא נעשה שימוש בתמונות אריזה רשמיות ללא הרשאה. האריזות בחנות הן איורים שנוצרו אוטומטית.</p>
      </section>
    </div>
  );
}
