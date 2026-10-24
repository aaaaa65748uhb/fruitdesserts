import type { FreshnessStatus } from "./types";

export const FRESHNESS_LABEL_HE: Record<FreshnessStatus, string> = {
  live: "מחיר מאומת",
  cached: "מחיר שמור",
  stale: "מחיר לא עדכני",
  sample: "נתון לדוגמה",
  unavailable: "מחיר לא זמין",
};

export const FRESHNESS_HINT_HE: Record<FreshnessStatus, string> = {
  live: "מקובץ מחירים רשמי שפורסם לאחרונה ועבר בדיקות תקינות",
  cached: "מקובץ מחירים רשמי, בתאריך הפרסום המצוין – ייתכן שהמחיר השתנה מאז",
  stale: "קובץ המחירים ישן מדי – המחיר מוצג לעיון בלבד ואינו נכלל בחישובים",
  sample: "נתון להמחשה בלבד – אינו מחיר אמיתי בחנות",
  unavailable: "אין מחיר עבור מוצר זה",
};

/** Ranking used when the same product has several offers: lower is better. */
export const FRESHNESS_RANK: Record<FreshnessStatus, number> = { live: 0, cached: 1, sample: 2, stale: 3, unavailable: 4 };

/**
 * Freshness of an official-file price is determined by when the FILE was published (the price was valid
 * then), not by PriceUpdateDate (which can be months old for an unchanged price).
 */
export function freshnessFromPublication(publishedAt: string | undefined, verifiedMaxAgeMs: number, staleAfterMs: number, now = Date.now()): FreshnessStatus {
  if (!publishedAt) return "unavailable";
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return "unavailable";
  const age = now - t;
  if (age <= verifiedMaxAgeMs) return "live";
  if (age <= staleAfterMs) return "cached";
  return "stale";
}

/** A cached price older than this is downgraded to "unavailable" for decision-making. */
export const CACHED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function effectiveFreshness(status: FreshnessStatus, lastVerifiedAt?: string, now = Date.now()): FreshnessStatus {
  if (status === "live" || status === "cached") {
    if (!lastVerifiedAt) return "unavailable";
    const t = Date.parse(lastVerifiedAt);
    if (Number.isNaN(t)) return "unavailable";
    if (status === "live" && now - t > 24 * 60 * 60 * 1000) return "cached";
    if (now - t > CACHED_MAX_AGE_MS) return "unavailable";
  }
  return status;
}
