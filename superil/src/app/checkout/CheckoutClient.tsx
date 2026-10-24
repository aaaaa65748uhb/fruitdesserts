"use client";
import { CoverageNotice } from "@/components/CoverageNotice";
import { AlertTriangle, Check, ClipboardCopy, Download, ExternalLink, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cartLineList, useCart } from "@/client/cart-store";
import { useBasketComparison, useHandoff } from "@/client/queries";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { Price } from "@/components/Price";
import { RETAILERS, RETAILER_BY_ID } from "@/data/retailers";
import type { HandoffLine } from "@/lib/checkout";

function useChecklist(key: string) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem(key) ?? "{}"));
    } catch {
      setChecked({});
    }
  }, [key]);
  const toggle = (id: string) =>
    setChecked((c) => {
      const next = { ...c, [id]: !c[id] };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage may be unavailable
      }
      return next;
    });
  return { checked, toggle };
}

export function CheckoutClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const retailerId = sp.get("retailer") ?? undefined;
  const lines = useCart((s) => s.lines);
  const items = useMemo(() => cartLineList(lines).map((l) => ({ productId: l.productId, quantity: l.quantity })), [lines]);
  const comparison = useBasketComparison(items);
  const handoff = useHandoff(retailerId, items);
  const { checked, toggle } = useChecklist(`superil-checklist-${retailerId ?? "none"}`);
  const [copied, setCopied] = useState(false);

  if (!items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-extrabold">הסל ריק</h1>
        <p className="mt-2 text-slate-600">כדי להמשיך לקנייה, הוסיפו מוצרים לסל.</p>
        <Link href="/store" className="mt-6 inline-block rounded-full bg-brand-700 px-6 py-3 font-bold text-white">לסופר</Link>
      </div>
    );
  }

  const steps = ["סקירת הסל", "בחירת רשת", "המשך באתר הרשת"];
  const step = retailerId ? 2 : 1;
  const h = handoff.data;
  const all: HandoffLine[] = h ? [...h.matched, ...h.missing] : [];
  const doneCount = all.filter((l) => checked[l.productId]).length;

  const copy = async () => {
    if (!h) return;
    try {
      await navigator.clipboard.writeText(h.checklistText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    if (!h) return;
    const blob = new Blob([h.checklistText], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `superil-${h.retailerId}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">המשך לקנייה</h1>
      <CoverageNotice className="mt-3" />
      <ol className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="שלבים">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${i <= step ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500"}`} aria-current={i === step ? "step" : undefined}>
            <span className="num grid h-5 w-5 place-items-center rounded-full bg-white/20 text-xs">{i + 1}</span> {s}
          </li>
        ))}
      </ol>

      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-900 p-4 text-sm text-white">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
        <p>
          SUPERIL לא מבצע הזמנות ולא גובה תשלום. ההזמנה, התשלום והמשלוח מתבצעים באתר הרשמי של הרשת שתבחרו. לעולם לא נבקש סיסמה לאתר רשת או פרטי כרטיס אשראי.
        </p>
      </div>

      {/* Step 2: choose retailer */}
      <section className="mt-6">
        <h2 className="text-xl font-extrabold">בחירת רשת</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {RETAILERS.map((r) => {
            const b = comparison.data?.baskets.find((x) => x.retailerId === r.id);
            const active = r.id === retailerId;
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => router.replace(`/checkout?retailer=${r.id}`)}
                aria-pressed={active}
                className={`rounded-2xl bg-white p-3 text-right shadow-sm ring-1 transition ${active ? "ring-2 ring-brand-600" : "ring-slate-100 hover:ring-slate-300"}`}
              >
                <span className="mb-2 block h-1.5 w-10 rounded-full" style={{ background: r.color }} />
                <span className="block font-bold">{r.nameHe}</span>
                {b ? (
                  <span className="mt-1 block text-xs text-slate-600">
                    <span className="num">{b.pricedItems}/{items.length}</span> מוצרים · <Price value={b.itemsSubtotal} />
                  </span>
                ) : (
                  <span className="mt-1 block h-4 w-16 animate-pulse rounded bg-slate-100" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 3: handoff */}
      {retailerId && (
        <section className="mt-8">
          {handoff.isLoading && <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />}
          {handoff.isError && <p className="rounded-2xl bg-red-50 p-4 text-red-800">לא הצלחנו להכין את ההעברה לרשת. נסו שוב.</p>}
          {h && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-extrabold">רשימת סימון ל{h.retailerName}</h2>
                  <span className="num text-sm text-slate-500">{doneCount}/{all.length}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-brand-600 transition-all" style={{ width: `${all.length ? (doneCount / all.length) * 100 : 0}%` }} />
                </div>
                <ul className="mt-4 divide-y divide-slate-100">
                  {all.map((l) => (
                    <li key={l.productId} className="flex items-start gap-3 py-2.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={!!checked[l.productId]}
                        aria-label={`סימון ${l.nameHe}`}
                        onClick={() => toggle(l.productId)}
                        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ring-2 ${checked[l.productId] ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-300"}`}
                      >
                        {checked[l.productId] && <Check className="h-4 w-4" />}
                      </button>
                      <div className={`min-w-0 flex-1 ${checked[l.productId] ? "text-slate-400 line-through" : ""}`}>
                        <p className="font-bold">
                          <span className="num">{l.quantity}</span> × {l.nameHe} <span className="font-normal text-slate-500">{l.brand}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {l.packageLabel}
                          {l.barcode && <> · ברקוד <span className="num">{l.barcode}</span></>}
                        </p>
                      </div>
                      <div className="text-left text-sm">
                        {l.offer ? (
                          <>
                            <Price value={l.subtotal!} className="font-bold" />
                            <FreshnessBadge status={l.offer.freshness} className="mt-0.5" />
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> ללא התאמה</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="font-medium">סכום ידוע למוצרים (ללא משלוח)</span>
                  <Price value={h.knownSubtotal} className="text-xl font-extrabold" />
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                  <h3 className="font-extrabold">איך ממשיכים?</h3>
                  <ol className="mt-2 list-decimal space-y-2 pr-5 text-sm text-slate-700">
                    {h.instructions.map((t) => <li key={t}>{t}</li>)}
                  </ol>
                  <a
                    href={h.destinationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-lg font-extrabold shadow"
                    style={{ background: RETAILER_BY_ID[h.retailerId]?.color, color: RETAILER_BY_ID[h.retailerId]?.textColor }}
                  >
                    לאתר {h.retailerName} <ExternalLink className="h-5 w-5" />
                  </a>
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    נפתח בלשונית חדשה · {new URL(h.destinationUrl).hostname}
                    {!RETAILER_BY_ID[h.retailerId]?.homepageVerified && " · כתובת לא אומתה ע״י מפעיל האתר"}
                  </p>
                </div>
                <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                  <h3 className="font-extrabold">לקחת את הרשימה איתכם</h3>
                  <div className="mt-3 grid gap-2">
                    <button type="button" onClick={copy} className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 font-bold hover:bg-slate-200">
                      {copied ? <Check className="h-4 w-4 text-brand-700" /> : <ClipboardCopy className="h-4 w-4" />} {copied ? "הועתק!" : "העתקת הרשימה"}
                    </button>
                    <button type="button" onClick={download} className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 font-bold hover:bg-slate-200">
                      <Download className="h-4 w-4" /> הורדה כקובץ
                    </button>
                    <a href={h.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#25d366] py-2.5 font-bold text-white">
                      <MessageCircle className="h-4 w-4" /> שליחה בוואטסאפ
                    </a>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
