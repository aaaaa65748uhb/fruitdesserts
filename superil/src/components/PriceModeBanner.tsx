"use client";
import { Info } from "lucide-react";
import Link from "next/link";
import { useProviderStatus } from "@/client/queries";

/** Tells users, on every page, what kind of prices they are looking at. */
export function PriceModeBanner() {
  const { data } = useProviderStatus();
  if (!data || data.priceMode === "official") return null;
  const text =
    data.priceMode === "sample"
      ? "המחירים באתר הם נתונים לדוגמה בלבד – טרם יובאו קבצי מחירים רשמיים."
      : data.priceMode === "mixed"
        ? "חלק מהמחירים הם נתונים לדוגמה ומסומנים כך; הם אינם נכללים בקביעת הסל הזול."
        : "אין כרגע מחירים זמינים.";
  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900" role="status">
      <p className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 text-xs">
        <Info className="h-3.5 w-3.5 shrink-0" /> {text}
        <Link href="/data-sources" className="mr-auto font-bold underline">מקורות הנתונים</Link>
      </p>
    </div>
  );
}
