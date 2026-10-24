/** Plain-language explanations of import issue codes, shown in the admin import report. */
export interface IssueInfo {
  title: string;
  /** What it means for the data. */
  effect: string;
  /** What the operator should do. */
  action: string;
}

export const ISSUE_INFO: Record<string, IssueInfo> = {
  missing_item_code: { title: "חסר קוד פריט", effect: "השורה לא יובאה", action: "אין צורך בפעולה; אם חוזר בהרבה שורות – בדקו שזה קובץ המחירים הנכון" },
  missing_name: { title: "חסר שם מוצר", effect: "השורה לא יובאה", action: "אין צורך בפעולה" },
  missing_price: { title: "חסר מחיר", effect: "השורה לא יובאה", action: "אין צורך בפעולה" },
  invalid_price: { title: "מחיר לא תקין", effect: "השורה לא יובאה", action: "אם רוב השורות כאלה – ייתכן שהקובץ פגום; הורידו אותו שוב" },
  non_positive_price: { title: "מחיר אפס או שלילי", effect: "השורה לא יובאה", action: "אין צורך בפעולה" },
  implausible_price: { title: "מחיר חריג", effect: "השורה לא יובאה", action: "בדקו ידנית אם יש צורך" },
  missing_package_size: { title: "גודל אריזה חסר או לא מוכר", effect: "השורה לא יובאה – אי אפשר להשוות מחיר ליחידה", action: "אם נפוץ מאוד – שלחו דוגמה לצוות הפיתוח להוספת יחידת מידה" },
  invalid_barcode: { title: "ברקוד עם ספרת ביקורת שגויה", effect: "יובא כקוד פנימי של הרשת – ללא השוואה לרשתות אחרות", action: "אין צורך בפעולה" },
  invalid_date: { title: "תאריך עדכון מחיר לא תקין", effect: "המחיר יובא בלי תאריך שינוי", action: "אין צורך בפעולה" },
  duplicate_record: { title: "שורה כפולה (אותו מחיר)", effect: "נשמרה שורה אחת", action: "אין צורך בפעולה" },
  conflicting_record: { title: "אותו פריט במחירים שונים", effect: "אף אחד מהמחירים לא יובא", action: "אין צורך בפעולה; הפריט יתעדכן בקובץ הבא" },
  missing_promotion_id: { title: "מבצע ללא מזהה", effect: "המבצע לא יובא", action: "אין צורך בפעולה" },
  promotion_without_items: { title: "מבצע ללא פריטים", effect: "המבצע לא יובא", action: "אין צורך בפעולה" },
  promotion_dates_unverified: { title: "מבצע בלי תאריכים תקינים", effect: "יוצג כ\"תאריכים לא אומתו\"", action: "אין צורך בפעולה" },
  duplicate_promotion: { title: "מבצע כפול", effect: "נשמר הראשון", action: "אין צורך בפעולה" },
  missing_store_id: { title: "סניף ללא מספר", effect: "הסניף לא יובא", action: "אין צורך בפעולה" },
  duplicate_store: { title: "סניף כפול", effect: "נשמר הראשון", action: "אין צורך בפעולה" },
  kind_mismatch: { title: "סוג הקובץ שונה מהשם", effect: "נעשה שימוש בתוכן", action: "ודאו שזה הקובץ שהתכוונתם אליו" },
  store_mismatch: { title: "מספר סניף שונה בשם הקובץ", effect: "נעשה שימוש בערך שבתוך הקובץ", action: "ודאו שזה הסניף הנכון" },
  published_at_inferred: { title: "זמן פרסום הוסק מהתוכן", effect: "נלקח העדכון האחרון בקובץ (הערכה שמרנית)", action: "עדיף להעלות את הקובץ בשמו המקורי" },
  stale_file: { title: "קובץ ישן", effect: "המחירים יסומנו \"לא עדכני\" ולא ייכללו בחישובים", action: "הורידו קובץ עדכני יותר" },
  order_stores_missing: { title: "קובץ הסניפים טרם יובא", effect: "שם הסניף והעיר לא יוצגו", action: "ייבאו קודם את קובץ ה-Stores של הרשת" },
  order_prices_missing: { title: "מבצעים לסניף בלי מחירים", effect: "המבצעים יוצגו רק אחרי ייבוא מחירים לסניף", action: "ייבאו את קובץ ה-PriceFull של אותו סניף" },
};

export function issueInfo(code: string): IssueInfo {
  return ISSUE_INFO[code] ?? { title: code, effect: "", action: "" };
}

/** Recommended import order, shown in the admin UI. */
export const IMPORT_STEPS = [
  { kind: "stores", file: "Stores…", title: "קובץ סניפים", why: "כדי שיוצגו שמות סניפים וערים" },
  { kind: "price_full", file: "PriceFull…", title: "קובץ מחירים מלא", why: "כל המחירים של סניף אחד" },
  { kind: "promo_full", file: "PromoFull…", title: "קובץ מבצעים מלא (רשות)", why: "מבצעים מוצגים לעיון, לא בחישוב" },
  { kind: "price", file: "Price… / Promo…", title: "קבצי עדכון", why: "שינויים שפורסמו אחרי הקובץ המלא" },
] as const;
