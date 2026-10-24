"use client";
import { AlertTriangle, Check, CheckCircle2, FileUp, Link2, RefreshCw, Search, ShieldAlert, Unlink, X, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RETAILERS, RETAILER_BY_ID } from "@/data/retailers";
import { formatDateTimeHe } from "@/lib/format";
import { IMPORT_STEPS, issueInfo } from "@/lib/import-issues";
import type { Issue } from "@/server/ingest/records";
import type { ImportBatch } from "@/server/prices/types";
import type { EntryReport, MatchingOverview, SuggestionDetail, UploadReport } from "@/server/prices/service";
import type { Readiness } from "@/server/readiness";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && !("ok" in body)) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export function AdminLogin() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(undefined);
        setBusy(true);
        try {
          // The token is sent once in the request body (never in a URL) and exchanged for an httpOnly session cookie.
          await call("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
          setToken("");
          window.location.reload();
        } catch (err) {
          setError(err instanceof Error ? err.message : "שגיאה");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="flex items-center gap-2 text-xl font-extrabold"><ShieldAlert className="h-5 w-5 text-brand-700" /> כניסת מנהל</h1>
      <p className="mt-1 text-sm text-slate-600">אזור פרטי לניהול ייבוא קבצי מחירים רשמיים.</p>
      <label className="mt-4 block text-sm font-medium" htmlFor="token">קוד גישה (ADMIN_TOKEN)</label>
      <input id="token" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy || !token} className="mt-4 w-full rounded-xl bg-brand-700 py-2.5 font-bold text-white disabled:opacity-50">כניסה</button>
    </form>
  );
}

type Tab = "upload" | "history" | "matching";

export function AdminPrices() {
  const [tab, setTab] = useState<Tab>("upload");
  return (
    <div>
      <h1 className="text-3xl font-extrabold">ייבוא מחירים רשמיים</h1>
      <p className="mt-1 text-sm text-slate-600">
        העלו קבצים שהורדו ידנית מפורטלי שקיפות המחירים הרשמיים של הרשתות (XML, ‎.gz או ‎.zip). כל קובץ נבדק ומוצג בתצוגה מקדימה – שום דבר לא נשמר לפני לחיצה על &quot;ייבוא&quot;.
      </p>
      <div className="mt-4 inline-flex flex-wrap rounded-full bg-slate-100 p-1" role="tablist">
        {([["upload", "1. העלאה וייבוא"], ["matching", "2. בדיקת התאמות ברקוד"], ["history", "היסטוריית ייבוא"]] as [Tab, string][]).map(([t, label]) => (
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

/* ───────────────────────────── Upload ───────────────────────────── */

function ImportGuide({ retailerId, readiness }: { retailerId: string; readiness?: Readiness }) {
  const ret = readiness?.retailers.find((r) => r.retailerId === retailerId);
  const done = (kind: string) => {
    if (!ret) return false;
    if (kind === "stores") return ret.storesImported > 0;
    if (kind === "price_full") return ret.branches.length > 0;
    if (kind === "promo_full") return ret.promoImports > 0;
    return false;
  };
  const next = IMPORT_STEPS.find((s) => !done(s.kind));
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-extrabold">סדר הייבוא המומלץ{retailerId ? ` – ${RETAILER_BY_ID[retailerId]?.nameHe}` : ""}</h2>
      <ol className="mt-3 grid gap-2 sm:grid-cols-4">
        {IMPORT_STEPS.map((s, i) => {
          const isDone = done(s.kind);
          const isNext = retailerId && next?.kind === s.kind;
          return (
            <li key={s.kind} className={`rounded-2xl p-3 text-sm ring-1 ${isDone ? "bg-emerald-50 ring-emerald-200" : isNext ? "bg-amber-50 ring-2 ring-amber-400" : "bg-slate-50 ring-slate-100"}`}>
              <p className="flex items-center gap-1.5 font-bold">
                {isDone ? <Check className="h-4 w-4 text-emerald-700" /> : <span className="num grid h-5 w-5 place-items-center rounded-full bg-white text-xs ring-1 ring-slate-300">{i + 1}</span>}
                {s.title}
              </p>
              <p className="mt-1 text-xs text-slate-600" dir="ltr">{s.file}</p>
              <p className="mt-1 text-xs text-slate-500">{s.why}</p>
              {isNext && <p className="mt-1 text-xs font-bold text-amber-800">השלב הבא</p>}
            </li>
          );
        })}
      </ol>
      {!retailerId && <p className="mt-2 text-xs text-slate-500">בחרו רשת כדי לראות מה כבר יובא עבורה.</p>}
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
  const [readiness, setReadiness] = useState<Readiness>();
  const queryClient = useQueryClient();
  const loadReadiness = useCallback(() => {
    call<Readiness>("/api/admin/readiness").then(setReadiness).catch(() => undefined);
  }, []);
  useEffect(loadReadiness, [loadReadiness]);

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
      } else {
        setResult(r);
        loadReadiness();
        // Public price data changed: refresh the price-mode banner, coverage notice and any cached prices.
        void queryClient.invalidateQueries();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(null);
    }
  };

  const ready = preview?.entries.filter((e) => e.status === "ready" || (e.status === "already_imported" && force)).length ?? 0;

  return (
    <div className="space-y-4">
      <ImportGuide retailerId={retailerId} readiness={readiness} />
      {readiness && !readiness.storage.persistentForProduction && (
        <p className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4" /> האחסון אינו קבוע לסביבת ייצור – ראו &quot;מצב מוכנות&quot;. ייתכן שהייבוא ייחסם.
        </p>
      )}
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
          <button type="button" disabled={!ready || !!busy || !!result} onClick={() => send("import")} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 font-bold text-white disabled:opacity-40">
            <CheckCircle2 className="h-4 w-4" /> {busy === "import" ? "מייבא…" : `ייבוא ${ready || ""} ${ready === 1 ? "קובץ מוכן" : "קבצים מוכנים"}`}
          </button>
          {preview && !ready && !result && <span className="self-center text-sm text-slate-600">אין קובץ מוכן לייבוא – ראו את הסיבות למטה.</span>}
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
const PUB_SOURCE: Record<string, string> = { file_name: "משם הקובץ", operator: "הוזן ידנית", latest_record_timestamp: "הוסק מהתוכן" };

function ReportView({ report }: { report: UploadReport }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        <b>{report.mode === "preview" ? "תצוגה מקדימה – לא נשמר דבר." : "תוצאות הייבוא."}</b> {report.uploadName} · {(report.sizeBytes / 1024).toFixed(0)} KB · SHA-256 <span className="num">{report.fileHash.slice(0, 16)}…</span>
      </p>
      {report.errors.map((e) => (
        <p key={e} className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800"><XCircle className="h-4 w-4" /> {e}</p>
      ))}
      <div className="overflow-x-auto rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2">
          <caption className="mb-2 text-right font-extrabold">סיכום לפני ייבוא</caption>
          <thead className="text-right text-xs text-slate-500">
            <tr>
              <th className="p-2">קובץ</th><th>סוג</th><th>פורמט</th><th>רשת</th><th>סניף</th><th>פורסם</th><th>רשומות</th><th>תקינות</th><th>שגיאות</th><th>מצב</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.entries.map((e) => (
              <tr key={e.entryName}>
                <td className="max-w-56 truncate p-2 text-xs" dir="ltr" title={e.entryName}>{e.entryName}</td>
                <td>{e.kind ? KIND_LABEL[e.kind] ?? e.kind : "—"}</td>
                <td className="text-xs">{[e.container, e.encoding].filter(Boolean).join(" · ")}</td>
                <td>{e.retailerName ?? <span className="text-red-700">לא זוהתה</span>}<span className="block text-[11px] text-slate-400 num">{e.chainId}</span></td>
                <td>{e.storeId ? `${e.storeId}${e.branchName ? ` – ${e.branchName}` : ""}` : e.kind === "stores" ? "כל הסניפים" : <span className="text-red-700">חסר</span>}</td>
                <td className="text-xs">{e.publishedAt ? <>{formatDateTimeHe(e.publishedAt)}<span className="block text-slate-400">{PUB_SOURCE[e.publishedAtSource ?? ""]}</span></> : <span className="text-red-700">חסר</span>}</td>
                <td className="num">{e.counts.total.toLocaleString("he-IL")}</td>
                <td className="num">{e.counts.valid.toLocaleString("he-IL")}</td>
                <td className={`num ${e.counts.errors ? "font-bold text-red-700" : ""}`}>{e.counts.errors}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_LABEL[e.status].cls}`}>{STATUS_LABEL[e.status].text}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report.entries.map((e) => <EntryDetails key={e.entryName} e={e} />)}
    </div>
  );
}

function EntryDetails({ e }: { e: EntryReport }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <p className="font-bold" dir="ltr">{e.entryName}</p>
      {e.blockers.map((b) => (
        <p key={b} className="mt-2 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800"><XCircle className="h-4 w-4 shrink-0" /> לא ניתן לייבא: {b}</p>
      ))}
      {e.alreadyImported && <p className="mt-2 text-sm text-slate-600">הקובץ יובא כבר ב-{formatDateTimeHe(e.alreadyImported.importedAt)}. סמנו &quot;ייבוא חוזר&quot; אם תרצו להחיל אותו שוב.</p>}
      {e.applied && (
        <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          נכתבו {e.applied.written} · ללא שינוי {e.applied.unchanged} · דולגו כי קיימים נתונים חדשים יותר {e.applied.skippedOlder} · הוסרו (לא מופיעים עוד בקובץ המלא) {e.applied.removed}
        </p>
      )}
      {e.matching && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <MiniStat label="מקושרים לקטלוג" value={e.matching.matchedToCatalog} />
          <MiniStat label="מוצרים מוכרים" value={e.matching.knownFeedProducts} />
          <MiniStat label="מוצרים חדשים" value={e.matching.newProducts} />
          <MiniStat label="קודים פנימיים" value={e.matching.internalCodes} />
          <MiniStat label="התנגשויות גודל" value={e.matching.sizeConflicts.length} bad={e.matching.sizeConflicts.length > 0} />
        </div>
      )}
      {e.matching && e.matching.sizeConflicts.length > 0 && (
        <table className="mt-3 w-full text-xs [&_td]:px-2 [&_th]:px-2">
          <caption className="mb-1 text-right font-bold text-red-800">התנגשויות גודל אריזה – הרשומות לא יוצגו כאותו מוצר</caption>
          <thead className="bg-slate-50 text-right"><tr><th className="p-1.5">מוצר</th><th>גודל צפוי</th><th>גודל בקובץ</th><th>מזהה</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {e.matching.sizeConflicts.slice(0, 50).map((c, i) => (
              <tr key={i}><td className="p-1.5">{c.productName}</td><td>{c.expected}</td><td className="text-red-700">{c.found}</td><td dir="ltr">{c.productKey}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {e.issues.length > 0 && <IssueReport issues={e.issues} counts={e.issueCounts} truncated={e.issuesTruncated} />}
      {e.sample.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-600">דוגמת רשומות מהקובץ</summary>
          <ul className="mt-2 space-y-1">
            {e.sample.map((s, i) => <li key={i}>{s.name}{s.size ? ` · ${s.size}` : ""}{s.price !== undefined ? ` · ₪${s.price}` : ""} <span className="text-xs text-slate-400" dir="ltr">{s.key}</span></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

function MiniStat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`num font-bold ${bad ? "text-red-700" : ""}`}>{value.toLocaleString("he-IL")}</p>
    </div>
  );
}

/** Issues grouped by type in plain language, with a filterable detail table. */
function IssueReport({ issues, counts, truncated }: { issues: Issue[]; counts?: Record<string, number>; truncated?: boolean }) {
  const [filter, setFilter] = useState<"all" | "error" | "warning">("all");
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const c = counts ?? issues.reduce<Record<string, number>>((m, i) => ((m[i.code] = (m[i.code] ?? 0) + 1), m), {});
    return Object.entries(c)
      .map(([code, n]) => ({ code, n, severity: issues.find((i) => i.code === code)?.severity ?? "warning", info: issueInfo(code) }))
      .sort((a, b) => Number(b.severity === "error") - Number(a.severity === "error") || b.n - a.n);
  }, [issues, counts]);
  const shown = issues.filter((i) => (filter === "all" || i.severity === filter) && (!q || (i.itemCode ?? "").includes(q) || i.message.includes(q)));
  return (
    <div className="mt-4">
      <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2">
        <caption className="mb-1 text-right font-bold">בעיות שנמצאו</caption>
        <thead className="bg-slate-50 text-right text-xs text-slate-500"><tr><th className="p-2">סוג</th><th>בעיה</th><th>כמות</th><th>משמעות</th><th>מה לעשות</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {groups.map((g) => (
            <tr key={g.code}>
              <td className="p-2">{g.severity === "error" ? <span className="rounded bg-red-100 px-1.5 text-xs text-red-800">שגיאה</span> : <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900">אזהרה</span>}</td>
              <td className="font-medium">{g.info.title}</td>
              <td className="num">{g.n.toLocaleString("he-IL")}</td>
              <td className="text-xs text-slate-600">{g.info.effect}</td>
              <td className="text-xs text-slate-600">{g.info.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-slate-600">פירוט לפי שורה ({issues.length}{truncated ? "+" : ""})</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {(["all", "error", "warning"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 ${filter === f ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
              {f === "all" ? "הכל" : f === "error" ? "שגיאות" : "אזהרות"}
            </button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש קוד פריט" className="rounded-full border border-slate-200 px-3 py-1" aria-label="חיפוש בבעיות" />
        </div>
        <div className="mt-2 max-h-72 overflow-auto rounded-xl ring-1 ring-slate-100">
          <table className="w-full text-xs [&_td]:px-2 [&_th]:px-2">
            <thead className="sticky top-0 bg-slate-50 text-right"><tr><th className="p-2">שורה</th><th>קוד פריט</th><th>סוג</th><th>הסבר</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((i, k) => (
                <tr key={k}>
                  <td className="num p-2">{i.record ?? "—"}</td>
                  <td className="num">{i.itemCode ?? ""}</td>
                  <td>{i.severity === "error" ? <span className="text-red-700">שגיאה</span> : <span className="text-amber-700">אזהרה</span>}</td>
                  <td className="py-1">{i.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* ───────────────────────────── History ───────────────────────────── */

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
      <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2">
        <thead className="text-right text-xs text-slate-500"><tr><th className="p-2">יובא</th><th>ע״י</th><th>רשת</th><th>סניף</th><th>סוג</th><th>פורסם</th><th>קובץ</th><th>תקינות</th><th>נכתבו</th><th /></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {data.imports.map((b) => (
            <tr key={b.id}>
              <td className="p-2">{formatDateTimeHe(b.importedAt)}</td>
              <td className="text-xs">{b.importedBy === "admin-web" ? "ממשק ניהול" : "שורת פקודה"}</td>
              <td>{RETAILER_BY_ID[b.retailerId]?.nameHe ?? b.retailerId}</td>
              <td>{b.storeId ?? "—"}</td>
              <td>{KIND_LABEL[b.kind] ?? b.kind}</td>
              <td>{formatDateTimeHe(b.publishedAt)}</td>
              <td className="max-w-48 truncate text-xs" dir="ltr" title={b.entryName}>{b.entryName}</td>
              <td className="num">{b.counts.valid}/{b.counts.total}</td>
              <td className="num">{b.applied.written}</td>
              <td>
                <button type="button" className="text-xs text-brand-700 underline" onClick={async () => setIssues({ id: b.id, list: (await call<{ issues: Issue[] }>(`/api/admin/imports?issues=${encodeURIComponent(b.id)}`)).issues })}>
                  בעיות ({b.counts.errors + b.counts.warnings})
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {issues && <IssueReport issues={issues.list} />}
    </div>
  );
}

/* ───────────────────────────── Matching review ───────────────────────────── */

type MTab = "pending" | "approved" | "unlinked" | "conflicts" | "records";

const SOURCE_LABEL: Record<string, string> = { file: "קובץ קישורים (git)", "admin-web": "ממשק ניהול", cli: "שורת פקודה" };

function MatchingPanel() {
  const [o, setO] = useState<MatchingOverview>();
  const [tab, setTab] = useState<MTab>("pending");
  const [msg, setMsg] = useState<{ ok: boolean; message: string }>();
  const [q, setQ] = useState("");
  const [manual, setManual] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string>();
  const queryClient = useQueryClient();
  const load = useCallback(() => {
    call<MatchingOverview>("/api/admin/report").then(setO).catch((e) => setMsg({ ok: false, message: e.message }));
  }, []);
  useEffect(load, [load]);

  const decide = async (productId: string, identifier: string, action: "approve" | "reject" | "unlink") => {
    if (action === "unlink" && !window.confirm("להסיר את הקישור? המחירים הרשמיים לא יוצגו עוד למוצר זה.")) return;
    setBusyKey(`${productId}|${identifier}`);
    try {
      const r = await call<{ ok: boolean; message: string }>("/api/admin/mapping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, identifier, action }) });
      setMsg(r);
      if (r.ok) {
        load();
        void queryClient.invalidateQueries();
      }
    } catch (e) {
      setMsg({ ok: false, message: e instanceof Error ? e.message : "שגיאה" });
    } finally {
      setBusyKey(undefined);
    }
  };

  if (!o) return <p className="text-slate-500">טוען…</p>;
  const match = (text: string) => !q || text.toLowerCase().includes(q.toLowerCase());
  const totalDup = o.duplicates.reduce((n, d) => n + d.count, 0);
  const totalConf = o.conflicts.priceConflicts.reduce((n, d) => n + d.count, 0) + o.conflicts.sizeConflicts.length;
  const tabs: [MTab, string][] = [
    ["pending", `הצעות ממתינות (${o.suggestions.length})`],
    ["approved", `קישורים מאושרים (${o.approved.length})`],
    ["unlinked", `מוצרי קטלוג ללא קישור (${o.unmatchedCatalog.length})`],
    ["conflicts", `התנגשויות וכפילויות (${totalConf + totalDup})`],
    ["records", `רשומות לא מותאמות (${o.unmatchedRecords.total.toLocaleString("he-IL")})`],
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
        <b>איך מאשרים התאמה?</b> השוו את שם המוצר, היצרן וגודל האריזה לאריזה האמיתית (או לאתר הרשת). אשרו רק כשהם זהים. הצעות נוצרות לפי דמיון שם וגודל זהה בלבד, ו<b>אינן מוחלות לפני אישור</b>. כל החלטה נשמרת באחסון הקבוע.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1" role="tablist">
          {tabs.map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-xl px-3 py-1.5 text-sm ${tab === t ? "bg-white font-bold shadow-sm" : "text-slate-600"}`}>{label}</button>
          ))}
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="סינון" className="rounded-full border border-slate-200 py-1.5 pr-8 pl-3 text-sm" aria-label="סינון רשימה" />
        </label>
        <button type="button" onClick={load} className="mr-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm"><RefreshCw className="h-4 w-4" /> רענון</button>
      </div>
      {msg && <p role="status" className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.message}</p>}
      {o.invalidMapEntries.length > 0 && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">ערכים לא תקינים בקובץ הקישורים: {o.invalidMapEntries.join("; ")}</p>}

      {tab === "pending" && (
        <div className="space-y-2">
          {o.suggestions.length === 0 && <Empty text={o.unmatchedRecords.total ? "אין הצעות פתוחות. ניתן לקשר ידנית בלשונית 'מוצרי קטלוג ללא קישור'." : "אין הצעות – טרם יובאו קבצי מחירים."} />}
          {o.suggestions.filter((s) => match(`${s.productName} ${s.productBrand} ${s.recordName} ${s.productKey}`)).map((s) => (
            <SuggestionCard key={`${s.productId}|${s.productKey}`} s={s} busy={busyKey === `${s.productId}|${s.productKey}`} onDecide={(a) => decide(s.productId, s.productKey, a)} />
          ))}
        </div>
      )}

      {tab === "approved" && (
        <div className="overflow-x-auto rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          {o.approved.length === 0 ? <Empty text="טרם אושרו קישורים." /> : (
            <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2">
              <thead className="text-right text-xs text-slate-500"><tr><th className="p-2">מצב</th><th>מוצר קטלוג</th><th>מזהה</th><th>אושר ע״י</th><th>מחירים רשמיים</th><th /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {o.approved.filter((a) => match(`${a.productName} ${a.key}`)).map((a) => (
                  <tr key={`${a.productId}|${a.key}`}>
                    <td className="p-2"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white"><Check className="h-3 w-3" /> מאושר</span></td>
                    <td className="font-medium">{a.productName}</td>
                    <td className="num text-xs">{a.key}</td>
                    <td className="text-xs">{SOURCE_LABEL[a.source]}{a.decidedAt && <span className="block text-slate-400">{formatDateTimeHe(a.decidedAt)}</span>}</td>
                    <td className="text-xs">{Object.keys(a.offersByRetailer).length ? Object.entries(a.offersByRetailer).map(([r, n]) => `${RETAILER_BY_ID[r]?.nameHe ?? r}: ${n}`).join(" · ") : <span className="text-amber-700">אין עדיין</span>}</td>
                    <td><button type="button" disabled={busyKey === `${a.productId}|${a.key}`} onClick={() => decide(a.productId, a.key, "unlink")} className="inline-flex items-center gap-1 text-xs text-red-700 underline"><Unlink className="h-3.5 w-3.5" /> הסרה</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "unlinked" && (
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="mb-2 text-xs text-slate-500">הזינו ברקוד (GTIN) שנבדק מול האריזה, או קוד פנימי בפורמט i:&lt;רשת&gt;:&lt;קוד&gt; (למשל לירקות). גודל האריזה נבדק מול הקבצים לפני הקישור.</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {o.unmatchedCatalog.filter((p) => match(p.productName)).map((p) => (
              <li key={p.productId} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="flex-1">{p.productName} <span className="text-xs text-slate-500">· {p.size}</span></span>
                <input value={manual[p.productId] ?? ""} onChange={(e) => setManual({ ...manual, [p.productId]: e.target.value })} placeholder="ברקוד מאומת" dir="ltr" className="w-44 rounded-lg border border-slate-200 px-2 py-1 text-xs" aria-label={`ברקוד עבור ${p.productName}`} />
                <button type="button" disabled={!manual[p.productId] || busyKey === `${p.productId}|${manual[p.productId]}`} onClick={() => decide(p.productId, manual[p.productId], "approve")} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white disabled:opacity-40">אישור קישור</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "conflicts" && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2">
              <caption className="mb-1 text-right font-bold">התנגשויות גודל אריזה (לא מוצגות כאותו מוצר)</caption>
              <thead className="text-right text-xs text-slate-500"><tr><th className="p-2">מוצר</th><th>שם בקובץ</th><th>גודל צפוי</th><th>גודל בקובץ</th><th>מזהה</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {o.conflicts.sizeConflicts.filter((c) => match(`${c.productName} ${c.recordName}`)).map((c, i) => (
                  <tr key={i}><td className="p-2">{c.productName}</td><td>{c.recordName}</td><td>{c.expected}</td><td className="text-red-700">{c.found}</td><td className="num text-xs">{c.productKey}</td></tr>
                ))}
              </tbody>
            </table>
            {o.conflicts.sizeConflicts.length === 0 && <Empty text="אין התנגשויות גודל." />}
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2">
              <caption className="mb-1 text-right font-bold">מחירים סותרים וכפילויות בקבצים</caption>
              <thead className="text-right text-xs text-slate-500"><tr><th className="p-2">קובץ</th><th>סוג</th><th>כמות</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {o.conflicts.priceConflicts.map((c) => <tr key={`c-${c.importId}`}><td className="p-2 text-xs" dir="ltr">{c.entryName}</td><td>מחירים סותרים לאותו פריט (לא יובאו)</td><td className="num">{c.count}</td></tr>)}
                {o.duplicates.map((d) => <tr key={`d-${d.importId}`}><td className="p-2 text-xs" dir="ltr">{d.entryName}</td><td>שורות כפולות (נשמרה אחת)</td><td className="num">{d.count}</td></tr>)}
              </tbody>
            </table>
            {totalDup + o.conflicts.priceConflicts.length === 0 && <Empty text="אין כפילויות או סתירות." />}
          </div>
        </div>
      )}

      {tab === "records" && (
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="mb-2 text-xs text-slate-500">מוצרים מקבצי המחירים שאינם מקושרים למוצר קטלוג. הם מופיעים באתר כמוצרים נפרדים (חיפוש, עמוד מוצר, סל) ונשמרים לבדיקה. מוצגות עד 100 רשומות.</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {o.unmatchedRecords.sample.filter((r) => match(`${r.name} ${r.productKey}`)).map((r) => (
              <li key={r.productKey} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="flex-1">{r.name} · {r.size}</span>
                <span className="num text-xs text-slate-400">{r.productKey}</span>
                <span className="text-xs text-slate-500">{r.retailers} רשתות</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ s, busy, onDecide }: { s: SuggestionDetail; busy: boolean; onDecide: (a: "approve" | "reject") => void }) {
  const sameSizeText = s.productSize === s.recordSize;
  return (
    <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">הצעה – טרם אושרה</span>
        <span className="text-xs text-slate-500">דמיון שם {Math.round(s.score * 100)}%</span>
        {sameSizeText && <span className="text-xs text-emerald-700">גודל אריזה זהה</span>}
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">מוצר הקטלוג (במדפי התלת־ממד)</p>
          <p className="font-bold">{s.productName}</p>
          <p className="text-slate-600">{s.productBrand} · {s.productSize}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">רשומה מקובץ המחירים</p>
          <p className="font-bold">{s.recordName}</p>
          <p className="text-slate-600">{s.recordManufacturer ?? "יצרן לא צוין"} · {s.recordSize}</p>
          <p className="num mt-1 text-xs text-slate-500">{s.productKey}{s.retailers.length ? ` · ${s.retailers.map((r) => RETAILER_BY_ID[r]?.nameHe ?? r).join(", ")}` : ""}{s.priceRange ? ` · ₪${s.priceRange[0]}–${s.priceRange[1]}` : ""}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={() => onDecide("approve")} className="inline-flex items-center gap-1 rounded-full bg-brand-700 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50"><Link2 className="h-4 w-4" /> אישור קישור</button>
        <button type="button" disabled={busy} onClick={() => onDecide("reject")} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold disabled:opacity-50"><X className="h-4 w-4" /> לא אותו מוצר</button>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">{text}</p>;
}
