import { FRESHNESS_HINT_HE, FRESHNESS_LABEL_HE } from "@/lib/freshness";
import type { FreshnessStatus } from "@/lib/types";

const STYLES: Record<FreshnessStatus, string> = {
  live: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  cached: "bg-sky-100 text-sky-800 ring-sky-300",
  sample: "bg-amber-100 text-amber-900 ring-amber-300",
  unavailable: "bg-slate-100 text-slate-600 ring-slate-300",
};

export function FreshnessBadge({ status, className = "" }: { status: FreshnessStatus; className?: string }) {
  return (
    <span
      title={FRESHNESS_HINT_HE[status]}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STYLES[status]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-emerald-500" : status === "cached" ? "bg-sky-500" : status === "sample" ? "bg-amber-500" : "bg-slate-400"}`} />
      {FRESHNESS_LABEL_HE[status]}
    </span>
  );
}
