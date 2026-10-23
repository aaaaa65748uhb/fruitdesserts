import type { FreshnessStatus } from "./types";

export const FRESHNESS_LABEL_HE: Record<FreshnessStatus, string> = {
  live: "מחיר מעודכן",
  cached: "מחיר שמור",
  sample: "נתון לדוגמה",
  unavailable: "מחיר לא זמין",
};

export const FRESHNESS_HINT_HE: Record<FreshnessStatus, string> = {
  live: "אומת מול מקור מורשה בזמן אמת",
  cached: "נלקח מקובץ מחירים שפורסם, בתאריך המצוין",
  sample: "נתון להמחשה בלבד – אינו מחיר אמיתי בחנות",
  unavailable: "אין מחיר מאומת עבור מוצר זה",
};

/** Ranking used when the same product has several offers: lower is better. */
export const FRESHNESS_RANK: Record<FreshnessStatus, number> = { live: 0, cached: 1, sample: 2, unavailable: 3 };

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
