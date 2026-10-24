"use client";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useProviderStatus } from "@/client/queries";
import { RETAILERS, RETAILER_BY_ID } from "@/data/retailers";
import { formatDateTimeHe } from "@/lib/format";

/**
 * States exactly which chains/branches have official prices, so the site never implies full coverage of
 * Israeli supermarkets, and that prices are updated by manual file imports (not live).
 */
export function CoverageNotice({ className = "" }: { className?: string }) {
  const { data } = useProviderStatus();
  // The status is often already cached when a late-hydrating (Suspense) page mounts; render only after mount
  // so the first client render matches the prerendered HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !data) return null;
  if (!data.coverage.length) {
    return (
      <p className={`rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200 ${className}`}>
        טרם יובאו מחירים רשמיים מאף רשת. כל המחירים כאן הם <b>נתונים לדוגמה</b> להמחשה בלבד.
      </p>
    );
  }
  const covered = new Set(data.coverage.map((c) => c.retailerId));
  const missing = RETAILERS.filter((r) => !covered.has(r.id));
  const latest = data.coverage.flatMap((c) => c.branches.map((b) => b.lastPublishedAt)).filter(Boolean).sort().at(-1);
  return (
    <div className={`rounded-2xl bg-sky-50 px-4 py-2.5 text-sm text-sky-950 ring-1 ring-sky-200 ${className}`}>
      <p className="flex flex-wrap items-center gap-x-2">
        <MapPin className="h-4 w-4" />
        <b>מחירים רשמיים זמינים עבור:</b>
        {data.coverage.map((c) => (
          <span key={c.retailerId}>
            {RETAILER_BY_ID[c.retailerId]?.nameHe ?? c.retailerId} ({c.branches.length === 1 ? c.branches[0].name ?? `סניף ${c.branches[0].storeId}` : `${c.branches.length} סניפים`})
          </span>
        ))}
      </p>
      <p className="mt-1 text-xs text-sky-900/80">
        {missing.length > 0 && <>לרשתות {missing.map((r) => r.nameHe).join(", ")} אין כרגע נתונים. </>}
        המחירים מתעדכנים כשמיובא קובץ חדש מהרשת – לא בזמן אמת{latest ? `; הקובץ העדכני ביותר פורסם ${formatDateTimeHe(latest)}` : ""}.{" "}
        <Link href="/data-sources" className="underline">פרטים</Link>
      </p>
    </div>
  );
}
