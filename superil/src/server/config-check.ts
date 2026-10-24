import "server-only";
import { adminEnabled } from "./admin-auth";
import { priceConfig } from "./prices/config";
import { storageMode } from "./prices/service";

export type CheckLevel = "ok" | "warn" | "error";

export interface ConfigCheck {
  id: string;
  label: string;
  level: CheckLevel;
  detail: string;
}

/**
 * Configuration checks for the admin readiness page and startup logs.
 * Reports only whether values are set and sane – never the values of secrets.
 */
export function configChecks(): ConfigCheck[] {
  const prod = process.env.NODE_ENV === "production";
  const mode = storageMode();
  const rawToken = process.env.ADMIN_TOKEN;
  const checks: ConfigCheck[] = [
    {
      id: "NODE_ENV",
      label: "מצב הפעלה (NODE_ENV)",
      level: prod ? "ok" : "warn",
      detail: prod ? "production" : `${process.env.NODE_ENV ?? "לא הוגדר"} – לשרת ציבורי יש להפעיל עם npm run build ו-npm start`,
    },
    {
      id: "ADMIN_TOKEN",
      label: "קוד גישת מנהל (ADMIN_TOKEN)",
      level: adminEnabled() ? "ok" : "error",
      detail: adminEnabled() ? "מוגדר (הערך אינו מוצג)" : rawToken ? "קצר מדי – נדרשים לפחות 24 תווים; ממשק הניהול כבוי" : "לא הוגדר – ממשק הניהול כבוי",
    },
    {
      id: "DATABASE_URL",
      label: "מסד נתונים (DATABASE_URL)",
      level: mode === "postgres" ? "ok" : mode === "file" && !prod ? "warn" : mode === "file" ? "warn" : "error",
      detail:
        mode === "postgres"
          ? "מוגדר (הערך אינו מוצג)"
          : mode === "file"
            ? `לא הוגדר – נתונים נשמרים כקבצים ב-${prod ? "PRICE_DATA_DIR (ודאו שזה כונן קבוע)" : "data/imported (מתאים לפיתוח)"}`
            : "לא הוגדר בסביבת ייצור ואין PRICE_DATA_DIR – ייבוא חסום כדי שנתונים לא יאבדו",
    },
    {
      id: "SAMPLE_PRICES",
      label: "מחירים לדוגמה (SAMPLE_PRICES)",
      level: priceConfig.samplePrices === "on" && prod ? "warn" : "ok",
      detail:
        priceConfig.samplePrices === "auto"
          ? "auto – מוצגים רק עד הייבוא הרשמי הראשון"
          : priceConfig.samplePrices === "on"
            ? "on – מחירים לדוגמה מוצגים גם לצד מחירים רשמיים (מסומנים)"
            : "off – לא מוצגים מחירים לדוגמה",
    },
    {
      id: "FRESHNESS",
      label: "חלונות טריות",
      level: "ok",
      detail: `מאומת עד ${priceConfig.verifiedMaxAgeMs / 3600_000} שעות, לא עדכני אחרי ${priceConfig.staleAfterMs / 86_400_000} ימים`,
    },
    {
      id: "CHP",
      label: "מתאם CHP",
      level: "ok",
      detail: process.env.CHP_AUTHORIZED === "true" ? "סומן כמורשה, אך המתאם לא מומש – נשאר כבוי" : "כבוי (אין הרשאה)",
    },
  ];
  return checks;
}
