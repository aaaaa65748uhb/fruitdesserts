"use client";
import { Minus, Plus } from "lucide-react";

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  const btn = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1" role="group" aria-label={`כמות: ${label}`}>
      <button type="button" className={`${btn} grid place-items-center rounded-full bg-white shadow-sm hover:bg-slate-50 disabled:opacity-40`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="הוסף אחד">
        <Plus className="h-4 w-4" />
      </button>
      <span className="num min-w-8 text-center font-bold" aria-live="polite">{value}</span>
      <button type="button" className={`${btn} grid place-items-center rounded-full bg-white shadow-sm hover:bg-slate-50 disabled:opacity-40`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="הפחת אחד">
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
}
