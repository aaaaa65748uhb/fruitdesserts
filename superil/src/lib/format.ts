const ils = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 2 });

/** Formats a price in shekels, e.g. "‏7.90 ₪". */
export function formatILS(amount: number): string {
  return ils.format(Math.round(amount * 100) / 100);
}

export function formatDateTimeHe(iso?: string): string {
  if (!iso) return "לא ידוע";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "לא ידוע";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(d);
}

export type Locale = "he" | "en";
export function directionFor(locale: Locale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
