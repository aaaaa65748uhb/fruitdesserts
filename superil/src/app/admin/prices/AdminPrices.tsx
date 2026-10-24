"use client";
import { AlertTriangle, CheckCircle2, FileUp, Link2, LogOut, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RETAILERS, RETAILER_BY_ID } from "@/data/retailers";
import { formatDateTimeHe } from "@/lib/format";
import type { Issue } from "@/server/ingest/records";
import type { ImportBatch } from "@/server/prices/types";
import type { MatchingOverview, UploadReport } from "@/server/prices/service";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && !("ok" in body)) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export function AdminLogin() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string>();
  return (
    <form
      className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(undefined);
        try {
          await call("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
          window.location.reload();
        } catch (err) {
          setError(err instanceof Error ? err.message : "שגיאה");
        }
      }}
    >
      <h1 className="flex items-center gap-2 text-xl font-extrabold"><ShieldAlert className="h-5 w-5 text-brand-700" /> כניסת מנהל</h1>
      <p className="mt-1 text-sm text-slate-600">ניהול ייבוא קבצי מחירים רשמיים.</p>
      <label className="mt-4 block text-sm font-medium" htmlFor="token">קוד גישה (ADMIN_TOKEN)</label>
      <input id="token" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <button type="submit" className="mt-4 w-full rounded-xl bg-brand-700 py-2.5 font-bold text-white">כניסה</button>
    </form>
  );
}

type Tab = "upload" | "history" | "matching";

export function AdminPrices() {
  const [tab, setTab] = useState<Tab>("upload");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">ניהול מחירים רשמיים</h1>
        <button
          type="button"
          className="mr-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm"
          onClick={async () => {
            await call("/api/admin/logout", { method: "POST" });
            window.location.reload();
          }}
        >
          <LogOut className="h-4 w-4" /> יציאה
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        העלו קבצים שהורדו ידנית מפורטלי שקיפות המחירים הרשמיים של הרשתות (XML, ‎.gz או ‎.zip). כל קובץ נבדק ומוצג בתצוגה מקדימה לפני הייבוא.
      </p>
      <div className="mt-4 inline-flex rounded-full bg-slate-100 p-1" role="tablist">
        {([["upload", "העלאה וייבוא"], ["history", "היסטוריית ייבוא"], ["matching", "דוח התאמות"]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === t ? "bg-white shadow-sm" : "text-slate-600"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "upload" && <UploadPanel />}
        {tab === "history" && <HistoryPanel />}
        {tab === "matching" && <MatchingPanel />}
      </div>
    </div>
  );
}

function UploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [retailerId, setRetailerId] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [preview, setPreview] = useState<UploadReport>();
  const [result, setResult] = useState<UploadReport>();
  const [error, setError] = useState<string>();

  const send = async (mode: "preview" | "import") => {
    if (!file) return;
    setBusy(mode);
    setError(undefined);
    const form = new FormData();
    form.set("file", file);
    if (retailerId) form.set("retailerId", retailerId);
    if (publishedAt) form.set("publishedAt", new Date(publishedAt).toISOString());
    if (force) form.set("force", "true");
    try {
      const r = await call<UploadReport>(`/api/admin/${mode}`, { method: "POST", body: form });
      if (mode === "preview") {
        setPreview(r);
        setResult(undefined);
      } else setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(null);
    }
  };

  const importable = preview?.entries.some((e) => e.status === "ready" || (e.status === "already_imported" && force));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-sm font-medium">קובץ מחירים / מבצעים / סניפים</span>
          <input
            type="file"
            accept=".xml,.gz,.zip,application/xml,application/gzip,application/zip"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(undefined);
              setResult(undefined);
            }}
            className="mt-1 block w-full rounded-xl border border-dashed border-slate-300 p-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">רשת</span>
          <select value={retailerId} onChange={(e) => { setRetailerId(e.target.value); setPreview(undefined); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
            <option value="">זיהוי לפי קוד רשת שאושר בעבר</option>
            {RETAILERS.map((r) => <option key={r.id} value={r.id}>{r.nameHe}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">זמן פרסום (רק אם אינו מופיע בקובץ)</span>
          <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          ייבוא חוזר של קובץ שכבר יובא (בטוח – לא נוצרות כפילויות)
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button type="button" disabled={!file || !!busy} onClick={() => send("preview")} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 font-bold text-white disabled:opacity-40">
            <FileUp className="h-4 w-4" /> {busy === "preview" ? "בודק…" : "תצוגה מקדימה"}
          </button>
          <button type="button" disabled={!importable || !!busy} onClick={() => send("import")} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 font-bold text-white disabled:opacity-40">
            <CheckCircle2 className="h-4 w-4" /> {busy === "import" ? "מייבא…" : "ייבוא"}
          </button>
        </div>
        {error && <p className="text-sm text-red-700 md:col-span-2">{error}</p>}
      </div>
      {result && <ReportView report={result} />}
      {!result && preview && <ReportView report={preview} />}
    </div>
  );
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  ready: { text: "מוכן לייבוא", cls: "bg-emerald-100 text-emerald-800" },
  blocked: { text: "חסום", cls: "bg-red-100 text-red-800" },
  already_imported: { text: "כבר יובא", cls: "bg-slate-100 text-slate-700" },
  imported: { text: "יובא", cls: "bg-emerald-600 text-white" },
  not_applied: { text: "לא בוצעו שינויים", cls: "bg-amber-100 text-amber-900" },
};

const KIND_LABEL: Record<string, string> = { price_full: "מחירים מלא", price: "עדכון מחירים", promo_full: "מבצעים מלא", promo: "עדכון מבצעים", stores: "סניפים" };

function ReportView({ report }: { report: UploadReport }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {report.mode === "preview" ? "תצוגה מקדימה – לא נשמר דבר." : "תוצאות הייבוא."} {report.uploadName} · {(report.sizeBytes / 1024).toFixed(0)} KB · SHA-256 <span className="num">{report.fileHash.slice(0, 16)}…</span> · אחסון: {report.repository === "postgres" ? "PostgreSQL" : "קבצים מקומיים"}
      </p>
      {report.errors.map((e) => (
        <p key={e} className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800"><XCircle className="h-4 w-4" /> {e}</p>
      ))}
      {report.entries.map((e) => (
        <div key={e.entryName} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold" dir="ltr">{e.entryName}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_LABEL[e.status].cls}`}>{STATUS_LABEL[e.status].text}</span>
            {e.kind && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{KIND_LABEL[e.kind] ?? e.kind}</span>}
            <span className="text-xs text-slate-500">{e.container} · {e.encoding}</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Stat label="רשת" value={e.retailerName ?? "—"} />
            <Stat label="קוד רשת" value={e.chainId ?? "—"} ltr />
            <Stat label="סניף" value={e.storeId ? `${e.storeId}${e.branchName ? ` – ${e.branchName}` : ""}` : "—"} />
            <Stat label="פורסם" value={e.publishedAt ? `${formatDateTimeHe(e.publishedAt)} (${e.publishedAtSource === "file_name" ? "שם הקובץ" : e.publishedAtSource === "operator" ? "ידני" : "עדכון אחרון בקובץ"})` : "—"} />
            <Stat label="רשומות" value={String(e.counts.total)} />
            <Stat label="תקינות" value={String(e.counts.valid)} />
            <Stat label="שגיאות (לא יובאו)" value={String(e.counts.errors)} warn={e.counts.errors > 0} />
            <Stat label="אזהרות" value={String(e.counts.warnings)} />
          </dl>
          {e.blockers.map((b) => (
            <p key={b} className="mt-2 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800"><XCircle className="h-4 w-4 shrink-0" /> {b}</p>
          ))}
          {e.alreadyImported && <p className="mt-2 text-sm text-slate-600">הקובץ יובא כבר ב-{formatDateTimeHe(e.alreadyImported.importedAt)}.</p>}
          {e.applied && (
            <p className="mt-2 text-sm">
              נכתבו {e.applied.written} · ללא שינוי {e.applied.unchanged} · דולגו (ישנים מהקיים) {e.applied.skippedOlder} · הוסרו {e.applied.removed}
            </p>
          )}
          {e.matching && (
            <p className="mt-2 text-sm text-slate-700">
              התאמה: {e.matching.matchedToCatalog} למוצרי קטלוג · {e.matching.knownFeedProducts} מוצרים מוכרים · {e.matching.newProducts} חדשים · {e.matching.internalCodes} קודים פנימיים ·{" "}
              <span className={e.matching.sizeConflicts.length ? "font-bold text-red-700" : ""}>{e.matching.sizeConflicts.length} התנגשויות גודל</span> · {e.matching.suggestions.length} הצעות לבדיקה
            </p>
          )}
          {Object.keys(e.issueCounts).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              {Object.entries(e.issueCounts).map(([code, n]) => <span key={code} className="rounded-full bg-slate-100 px-2 py-0.5" dir="ltr">{code}: {n}</span>)}
            </div>
          )}
          {e.issues.length > 0 && <IssueTable issues={e.issues} truncated={e.issuesTruncated} />}
          {e.sample.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-slate-600">דוגמת רשומות</summary>
              <ul className="mt-2 space-y-1">
                {e.sample.map((s, i) => <li key={i}>{s.name}{s.size ? ` · ${s.size}` : ""}{s.price !== undefined ? ` · ₪${s.price}` : ""} <span className="text-xs text-slate-400" dir="ltr">{s.key}</span></li>)}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, ltr, warn }: { label: string; value: string; ltr?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={`font-bold ${ltr ? "num" : ""} ${warn ? "text-red-700" : ""}`}>{value}</dd>
    </div>
  );
}

function IssueTable({ issues, truncated }: { issues: Issue[]; truncated?: boolean }) {
  return (
    <details className="mt-3" open={issues.some((i) => i.severity === "error")}>
      <summary className="cursor-pointer text-sm font-medium">פירוט בעיות ({issues.length}{truncated ? "+" : ""})</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-xl ring-1 ring-slate-100">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 text-right"><tr><th className="p-2">#</th><th>קוד פריט</th><th>סוג</th><th>הסבר</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {issues.map((i, k) => (
              <tr key={k}>
                <td className="p-2 num">{i.record ?? "—"}</td>
                <td className="num">{i.itemCode ?? ""}</td>
                <td>{i.severity === "error" ? <span className="text-red-700">שגיאה</span> : <span className="text-amber-700">אזהרה</span>}</td>
                <td className="py-1">{i.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function HistoryPanel() {
  const [data, setData] = useState<{ imports: ImportBatch[] }>();
  const [issues, setIssues] = useState<{ id: string; list: Issue[] }>();
  useEffect(() => {
    call<{ imports: ImportBatch[] }>("/api/admin/imports").then(setData).catch(() => setData({ imports: [] }));
  }, []);
  if (!data) return <p className="text-slate-500">טוען…</p>;
  if (!data.imports.length) return <p className="rounded-2xl bg-white p-6 text-slate-600 ring-1 ring-slate-100">טרם בוצעו ייבואים.</p>;
  return (
    <div className="overflow-x-auto rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <table className="w-full text-sm">
        <thead className="text-right text-xs text-slate-500"><tr><th className="p-2">יובא</th><th>רשת</th><th>סניף</th><th>סוג</th><th>פורסם</th><th>קובץ</th><th>רשומות</th><th>נכתבו</th><th /></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {data.imports.map((b) => (
            <tr key={b.id}>
              <td className="p-2">{formatDateTimeHe(b.importedAt)}</td>
              <td>{RETAILER_BY_ID[b.retailerId]?.nameHe ?? b.retailerId}</td>
              <td>{b.storeId ?? "—"}</td>
              <td>{KIND_LABEL[b.kind] ?? b.kind}</td>
              <td>{formatDateTimeHe(b.publishedAt)}</td>
              <td className="max-w-48 truncate text-xs" dir="ltr" title={b.entryName}>{b.entryName}</td>
              <td className="num">{b.counts.valid}/{b.counts.total}</td>
              <td className="num">{b.applied.written}</td>
              <td>
                <button
                  type="button"
                  className="text-xs text-brand-700 underline"
                  onClick={async () => setIssues({ id: b.id, list: (await call<{ issues: Issue[] }>(`/api/admin/imports?issues=${encodeURIComponent(b.id)}`)).issues })}
                >
                  בעיות ({b.counts.errors + b.counts.warnings})
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {issues && <IssueTable issues={issues.list} />}
    </div>
  );
}

function MatchingPanel() {
  const [o, setO] = useState<MatchingOverview>();
  const [msg, setMsg] = useState<{ ok: boolean; message: string }>();
  const [manual, setManual] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    call<MatchingOverview>("/api/admin/report").then(setO).catch(() => undefined);
  }, []);
  useEffect(load, [load]);
  const link = async (productId: string, identifier: string | null) => {
    const r = await call<{ ok: boolean; message: string }>("/api/admin/mapping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, identifier }) });
    setMsg(r);
    if (r.ok) load();
  };
  if (!o) return <p className="text-slate-500">טוען…</p>;
  const totalDup = o.duplicates.reduce((n, d) => n + d.count, 0);
  const totalConf = o.conflicts.priceConflicts.reduce((n, d) => n + d.count, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">נוצר {formatDateTimeHe(o.generatedAt)} · {o.imports} ייבואים · {o.branches.length} סניפים עם מחירים</span>
        <button type="button" onClick={load} className="mr-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm"><RefreshCw className="h-4 w-4" /> רענון</button>
      </div>
      {msg && <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.message}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="מוצרי קטלוג מותאמים" value={String(o.matched.length)} />
        <Stat label="מקושרים ללא מחירים" value={String(o.mappedWithoutOffers.length)} />
        <Stat label="מוצרי קטלוג לא מותאמים" value={String(o.unmatchedCatalog.length)} />
        <Stat label="רשומות לא מותאמות" value={o.unmatchedRecords.total.toLocaleString("he-IL")} />
        <Stat label="כפילויות" value={String(totalDup)} />
        <Stat label="התנגשויות" value={String(totalConf + o.conflicts.sizeConflicts.length)} warn={totalConf + o.conflicts.sizeConflicts.length > 0} />
      </div>
      {o.invalidMapEntries.length > 0 && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">ערכים לא תקינים בקובץ הקישורים: {o.invalidMapEntries.join("; ")}</p>}

      <Section title={`הצעות קישור לבדיקה (${o.suggestions.length})`} hint="נמצאו לפי דמיון שם וגודל אריזה זהה בלבד. שום הצעה אינה מיושמת אוטומטית – אשרו רק לאחר בדיקה.">
        {o.suggestions.map((s) => (
          <Row key={`${s.productId}-${s.productKey}`}>
            <span className="flex-1">{s.productName} ⇄ {s.recordName} <span className="text-xs text-slate-400" dir="ltr">{s.productKey}</span></span>
            <span className="text-xs text-slate-500">{Math.round(s.score * 100)}%</span>
            <button type="button" onClick={() => link(s.productId, s.productKey)} className="inline-flex items-center gap-1 rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white"><Link2 className="h-3.5 w-3.5" /> אישור קישור</button>
          </Row>
        ))}
      </Section>

      <Section title={`מוצרי קטלוג מותאמים (${o.matched.length})`}>
        {o.matched.map((m) => (
          <Row key={m.productId}>
            <span className="flex-1">{m.productName} <span className="text-xs text-slate-400" dir="ltr">{m.keys.join(", ")}</span></span>
            <span className="text-xs text-slate-600">{Object.entries(m.offersByRetailer).map(([r, n]) => `${RETAILER_BY_ID[r]?.nameHe ?? r}: ${n}`).join(" · ")}</span>
            <button type="button" onClick={() => link(m.productId, null)} className="text-xs text-red-700 underline">הסרת קישור</button>
          </Row>
        ))}
      </Section>

      <Section title={`התנגשויות (${totalConf + o.conflicts.sizeConflicts.length})`} hint="רשומות עם גודל אריזה שונה אינן מוצגות כאותו מוצר. מחירים סותרים באותו קובץ לא יובאו.">
        {o.conflicts.sizeConflicts.map((c, i) => (
          <Row key={i}>
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="flex-1">{c.productName}: צפוי {c.expected}, בקובץ {c.found} – {c.recordName}</span>
            <span className="text-xs text-slate-400" dir="ltr">{c.productKey}</span>
          </Row>
        ))}
        {o.conflicts.priceConflicts.map((c) => (
          <Row key={c.importId}><span className="flex-1">{c.count} פריטים עם מחירים סותרים בקובץ {c.entryName}</span></Row>
        ))}
      </Section>

      <Section title={`כפילויות (${totalDup})`}>
        {o.duplicates.map((d) => <Row key={d.importId}><span className="flex-1">{d.count} רשומות כפולות בקובץ {d.entryName}</span></Row>)}
      </Section>

      <Section title={`רשומות לא מותאמות (${o.unmatchedRecords.total.toLocaleString("he-IL")})`} hint="מוצרים מקבצי המחירים שאינם מקושרים למוצר קטלוג. הם זמינים באתר כמוצרים נפרדים ונשמרים לבדיקה.">
        {o.unmatchedRecords.sample.map((r) => (
          <Row key={r.productKey}>
            <span className="flex-1">{r.name} · {r.size} <span className="text-xs text-slate-400" dir="ltr">{r.productKey}</span></span>
            <span className="text-xs text-slate-500">{r.retailers} רשתות</span>
          </Row>
        ))}
      </Section>

      <Section title={`מוצרי קטלוג לא מותאמים (${o.unmatchedCatalog.length})`} hint="הזינו ברקוד (GTIN) או קוד פנימי בפורמט i:<רשת>:<קוד> לאחר אימות מול האריזה. גודל האריזה נבדק לפני הקישור.">
        {o.unmatchedCatalog.map((p) => (
          <Row key={p.productId}>
            <span className="flex-1">{p.productName}</span>
            <input value={manual[p.productId] ?? ""} onChange={(e) => setManual({ ...manual, [p.productId]: e.target.value })} placeholder="ברקוד מאומת" dir="ltr" className="w-44 rounded-lg border border-slate-200 px-2 py-1 text-xs" aria-label={`ברקוד עבור ${p.productName}`} />
            <button type="button" disabled={!manual[p.productId]} onClick={() => link(p.productId, manual[p.productId])} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white disabled:opacity-40">קישור</button>
          </Row>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <details className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100" open>
      <summary className="cursor-pointer font-extrabold">{title}</summary>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <ul className="mt-2 max-h-96 divide-y divide-slate-100 overflow-auto text-sm">{children}</ul>
    </details>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <li className="flex flex-wrap items-center gap-2 py-1.5">{children}</li>;
}
