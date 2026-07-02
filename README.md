# 🦑 Squidget — חנות הסקווישים הוויראלית

מערכת איקומרס מלאה בעברית (RTL) עבור מותג הסקווישים Squidget: חנות אונליין,
עגלת קניות, קופונים, checkout, תשלום דמו, מעקב הזמנות ודשבורד ניהול מלא בסגנון
Shopify — הכל בזמן אמת מעל Firebase.

> 🎨 ערכת המיתוג המלאה (צבעים, טון דיבור, תוכנית תוכן ל-30 יום ועוד): [BRAND.md](./BRAND.md)

## טכנולוגיות

- **Frontend:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS
- **Backend:** Firebase בלבד — Auth (Google), Firestore, Storage, Security Rules
- **פריסה:** Export סטטי (`out/`) — מתאים ל-Firebase Hosting / GitHub Pages / כל אחסון סטטי

## הרצה מקומית

```bash
npm install
npm run dev
```

האתר יעלה בכתובת http://localhost:3000

**ללא הגדרת Firebase האתר רץ במצב דמו:** קטלוג מוצרים מובנה, הזמנות ומלאי
נשמרים מקומית בדפדפן, וניתן להתנסות גם בכניסת דמו כלקוח וכמנהל (מתפריט
ההתחברות). זה מצוין לפיתוח ולהתרשמות — אבל לא לפרודקשן.

## חיבור ל-Firebase (פרודקשן)

1. צרו פרויקט ב-[Firebase Console](https://console.firebase.google.com).
2. הוסיפו אפליקציית Web והעתיקו את ערכי ה-Config.
3. העתיקו את `.env.example` ל-`.env.local` ומלאו את הערכים:
   ```bash
   cp .env.example .env.local
   ```
4. הפעילו **Authentication ← Sign-in method ← Google**.
5. הפעילו **Firestore Database** (מצב production).
6. פרסו את חוקי האבטחה והאינדקסים:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use <project-id>
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
7. הריצו את האתר, היכנסו עם חשבון ה-Admin, ובדשבורד הניהול ← מוצרים לחצו
   **"ייבוא מוצרי דמו"** כדי לזרוע את הקטלוג הראשוני.

### משתמש Admin יחיד

הדשבורד (`/admin`) פתוח אך ורק לחשבון Google שמוגדר ב:

- `NEXT_PUBLIC_ADMIN_EMAIL` בקובץ `.env.local` (ברירת מחדל: `aecake273@gmail.com`)
- הפונקציה `isAdmin()` בקבצים `firestore.rules` ו-`storage.rules`

**חשוב:** אם משנים את האימייל — לעדכן בשלושת המקומות. כל משתמש אחר שינסה
לגשת ל-`/admin` יקבל מסך "403 הגישה נדחתה", וחוקי האבטחה של Firestore חוסמים
אותו גם ברמת הנתונים (ההגנה האמיתית אינה בצד הלקוח).

## מבנה הנתונים (Firestore)

| Collection | תוכן |
|---|---|
| `products` | קטלוג המוצרים כולל מלאי בזמן אמת |
| `orders` | הזמנות מלאות: פריטים, סכומים, סטטוס, מעקב משלוח |
| `customers` | סיכומי לקוחות (מפתח = אימייל): מספר הזמנות, סה"כ רכישות |
| `inventory` | יומן תנועות מלאי (כל הורדת מלאי נרשמת) |

יצירת הזמנה מתבצעת ב**טרנזקציה אחת**: בדיקת מלאי ← הורדת מלאי ← כתיבת
ההזמנה ← רישום תנועות מלאי ← עדכון סיכום הלקוח. כל המסכים (חנות ודשבורד)
מאזינים ב-`onSnapshot` ומתעדכנים בזמן אמת.

## קופונים ומשלוחים

| קופון | הנחה |
|---|---|
| `WELCOME10` | 10% |
| `SQUISH20` | 20% |

| שיטת משלוח | מחיר |
|---|---|
| איסוף עצמי | חינם |
| משלוח רגיל | ₪25 |
| משלוח מהיר | ₪45 |

## תשלום — דמו בלבד ⚠️

מסך התשלום (כרטיס אשראי / Apple Pay / Google Pay / PayPal) הוא **דמו לצורכי
הדגמה בלבד**: יש ולידציה מלאה ומסך "מעבד את התשלום…", אבל לא מתבצע חיוב אמיתי
ואסור להזין בו פרטי אשראי אמיתיים. לחיבור סליקה אמיתית יש לשלב ספק תשלומים
(Stripe, PayPal SDK וכו').

## בנייה ופריסה

```bash
npm run build   # יוצר export סטטי בתיקיית out/
```

- **Firebase Hosting:** `firebase deploy --only hosting`
- **GitHub Pages:** ה-workflow בקובץ `.github/workflows/pages.yml` בונה ופורס
  אוטומטית בכל push ל-branch הראשי (כולל `NEXT_PUBLIC_BASE_PATH` לתת-נתיב).

## סקריפטים

| פקודה | פעולה |
|---|---|
| `npm run dev` | שרת פיתוח |
| `npm run build` | בנייה + export סטטי |
| `npm run typecheck` | בדיקת טיפוסים |
