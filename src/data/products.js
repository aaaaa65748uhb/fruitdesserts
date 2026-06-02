export const ISRAELI_PRODUCTS = [
  {
    id: '1', barcode: '7290000066614', name: 'חלב תנובה 3%', brand: 'תנובה',
    category: 'חלב וגבינות', weight: 1000, unit: 'מ"ל', image: '🥛',
    kosher: 'חלק', allergens: ['חלב'],
    nutrition: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.0 },
    prices: { shufersal: 5.90, ramiLevy: 5.20, yochananof: 5.60, victory: 5.50, carrefour: 5.80, osherAd: 5.40, tivTaam: 5.70, haziHinam: 5.30 }
  },
  {
    id: '2', barcode: '7290000066621', name: 'גבינה לבנה 5%', brand: 'תנובה',
    category: 'חלב וגבינות', weight: 250, unit: 'גרם', image: '🧀',
    kosher: 'חלק', allergens: ['חלב'],
    nutrition: { calories: 105, protein: 8.5, carbs: 3.1, fat: 5.0 },
    prices: { shufersal: 6.90, ramiLevy: 5.90, yochananof: 6.50, victory: 6.30, carrefour: 6.70, osherAd: 6.10, tivTaam: 6.80, haziHinam: 5.80 }
  },
  {
    id: '3', barcode: '7290002443582', name: 'ביצים גדולות', brand: 'תנובה',
    category: 'ביצים', weight: 720, unit: 'גרם (12)', image: '🥚',
    kosher: 'חלק', allergens: ['ביצים'],
    nutrition: { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
    prices: { shufersal: 18.90, ramiLevy: 15.90, yochananof: 17.50, victory: 16.90, carrefour: 18.50, osherAd: 16.50, tivTaam: 17.90, haziHinam: 15.50 }
  },
  {
    id: '4', barcode: '7290000652191', name: 'לחם אחיד פרוס', brand: 'אנגל',
    category: 'לחם ומאפים', weight: 700, unit: 'גרם', image: '🍞',
    kosher: 'פרווה', allergens: ['גלוטן'],
    nutrition: { calories: 265, protein: 8, carbs: 50, fat: 2.5 },
    prices: { shufersal: 7.90, ramiLevy: 6.90, yochananof: 7.50, victory: 7.20, carrefour: 7.80, osherAd: 7.00, tivTaam: 7.60, haziHinam: 6.80 }
  },
  {
    id: '5', barcode: '7290110597643', name: 'שמן זית כתית מעולה', brand: 'יד מרדכי',
    category: 'שמנים ורטבים', weight: 750, unit: 'מ"ל', image: '🫒',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 884, protein: 0, carbs: 0, fat: 100 },
    prices: { shufersal: 39.90, ramiLevy: 32.90, yochananof: 37.50, victory: 36.00, carrefour: 38.50, osherAd: 34.90, tivTaam: 38.00, haziHinam: 32.00 }
  },
  {
    id: '6', barcode: '7290000228716', name: 'פסטה ספגטי', brand: 'ברילה',
    category: 'פסטה ואורז', weight: 500, unit: 'גרם', image: '🍝',
    kosher: 'פרווה', allergens: ['גלוטן'],
    nutrition: { calories: 352, protein: 12, carbs: 71, fat: 1.5 },
    prices: { shufersal: 8.90, ramiLevy: 7.20, yochananof: 8.50, victory: 8.00, carrefour: 8.70, osherAd: 7.50, tivTaam: 8.30, haziHinam: 7.00 }
  },
  {
    id: '7', barcode: '7290000236223', name: 'אורז בסמטי', brand: 'אמא',
    category: 'פסטה ואורז', weight: 1000, unit: 'גרם', image: '🍚',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 350, protein: 7, carbs: 77, fat: 0.5 },
    prices: { shufersal: 12.90, ramiLevy: 10.50, yochananof: 12.00, victory: 11.50, carrefour: 12.50, osherAd: 11.00, tivTaam: 12.20, haziHinam: 10.20 }
  },
  {
    id: '8', barcode: '7290105758015', name: 'עגבניות שרי', brand: 'גינות עדן',
    category: 'ירקות ופירות', weight: 250, unit: 'גרם', image: '🍅',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
    prices: { shufersal: 8.90, ramiLevy: 7.50, yochananof: 8.50, victory: 8.00, carrefour: 9.00, osherAd: 7.90, tivTaam: 8.70, haziHinam: 7.30 }
  },
  {
    id: '9', barcode: '7290108500000', name: 'מלפפון', brand: 'טרי',
    category: 'ירקות ופירות', weight: 500, unit: 'גרם', image: '🥒',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 16, protein: 0.7, carbs: 3.6, fat: 0.1 },
    prices: { shufersal: 4.90, ramiLevy: 3.90, yochananof: 4.50, victory: 4.20, carrefour: 4.80, osherAd: 4.00, tivTaam: 4.60, haziHinam: 3.80 }
  },
  {
    id: '10', barcode: '7290000162034', name: 'גבינה צהובה 28%', brand: 'מחלבות גד',
    category: 'חלב וגבינות', weight: 200, unit: 'גרם', image: '🧀',
    kosher: 'חלק', allergens: ['חלב'],
    nutrition: { calories: 320, protein: 24, carbs: 0, fat: 25 },
    prices: { shufersal: 16.90, ramiLevy: 13.90, yochananof: 15.50, victory: 15.00, carrefour: 16.50, osherAd: 14.50, tivTaam: 16.00, haziHinam: 13.50 }
  },
  {
    id: '11', barcode: '7290000652801', name: 'חזה עוף טרי', brand: 'עוף טוב',
    category: 'בשר ועוף', weight: 1000, unit: 'גרם', image: '🍗',
    kosher: 'גלאט', allergens: [],
    nutrition: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    prices: { shufersal: 29.90, ramiLevy: 24.90, yochananof: 27.50, victory: 26.90, carrefour: 29.00, osherAd: 25.90, tivTaam: 28.50, haziHinam: 24.50 }
  },
  {
    id: '12', barcode: '7290000228259', name: 'שוקולד מריר 70%', brand: 'עלית',
    category: 'חטיפים וממתקים', weight: 100, unit: 'גרם', image: '🍫',
    kosher: 'פרווה', allergens: ['חלב', 'אגוזים'],
    nutrition: { calories: 598, protein: 7, carbs: 46, fat: 43 },
    prices: { shufersal: 9.90, ramiLevy: 7.90, yochananof: 9.20, victory: 8.70, carrefour: 9.50, osherAd: 8.20, tivTaam: 9.30, haziHinam: 7.70 }
  },
  {
    id: '13', barcode: '7290000098395', name: 'קפה נס', brand: 'קפה עלית',
    category: 'קפה ותה', weight: 200, unit: 'גרם', image: '☕',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 2, protein: 0.1, carbs: 0, fat: 0 },
    prices: { shufersal: 24.90, ramiLevy: 19.90, yochananof: 22.50, victory: 21.90, carrefour: 23.90, osherAd: 20.90, tivTaam: 23.50, haziHinam: 19.50 }
  },
  {
    id: '14', barcode: '7290000098401', name: 'תה ויסוצקי', brand: 'ויסוצקי',
    category: 'קפה ותה', weight: 50, unit: 'שקיות (25)', image: '🍵',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 1, protein: 0, carbs: 0.2, fat: 0 },
    prices: { shufersal: 12.90, ramiLevy: 9.90, yochananof: 11.50, victory: 11.00, carrefour: 12.50, osherAd: 10.50, tivTaam: 12.00, haziHinam: 9.50 }
  },
  {
    id: '15', barcode: '7290000162065', name: 'יוגורט תות', brand: 'דנונה',
    category: 'חלב וגבינות', weight: 150, unit: 'גרם', image: '🍓',
    kosher: 'חלק', allergens: ['חלב'],
    nutrition: { calories: 99, protein: 4, carbs: 16, fat: 2.5 },
    prices: { shufersal: 4.50, ramiLevy: 3.50, yochananof: 4.20, victory: 4.00, carrefour: 4.40, osherAd: 3.70, tivTaam: 4.30, haziHinam: 3.40 }
  },
  {
    id: '16', barcode: '7290000228921', name: 'חמאה מתוקה', brand: 'תנובה',
    category: 'חלב וגבינות', weight: 200, unit: 'גרם', image: '🧈',
    kosher: 'חלק', allergens: ['חלב'],
    nutrition: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
    prices: { shufersal: 14.90, ramiLevy: 11.90, yochananof: 13.50, victory: 13.00, carrefour: 14.50, osherAd: 12.50, tivTaam: 14.00, haziHinam: 11.50 }
  },
  {
    id: '17', barcode: '7290000121031', name: 'מיץ תפוזים טרי', brand: 'פריגת',
    category: 'משקאות', weight: 1000, unit: 'מ"ל', image: '🍊',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 45, protein: 0.7, carbs: 10, fat: 0.2 },
    prices: { shufersal: 12.90, ramiLevy: 9.90, yochananof: 11.50, victory: 11.00, carrefour: 12.50, osherAd: 10.50, tivTaam: 12.00, haziHinam: 9.70 }
  },
  {
    id: '18', barcode: '7290000234081', name: 'קוטג׳ 5%', brand: 'תנובה',
    category: 'חלב וגבינות', weight: 250, unit: 'גרם', image: '🥛',
    kosher: 'חלק', allergens: ['חלב'],
    nutrition: { calories: 98, protein: 11, carbs: 3, fat: 5 },
    prices: { shufersal: 7.90, ramiLevy: 6.50, yochananof: 7.50, victory: 7.00, carrefour: 7.70, osherAd: 6.80, tivTaam: 7.60, haziHinam: 6.30 }
  },
  {
    id: '19', barcode: '7290000662175', name: 'נקניקיות פרנקפורטר', brand: 'זוגלובק',
    category: 'בשר ועוף', weight: 360, unit: 'גרם', image: '🌭',
    kosher: 'גלאט', allergens: ['גלוטן'],
    nutrition: { calories: 290, protein: 11, carbs: 2, fat: 26 },
    prices: { shufersal: 24.90, ramiLevy: 19.90, yochananof: 22.50, victory: 21.50, carrefour: 24.00, osherAd: 20.90, tivTaam: 23.50, haziHinam: 19.50 }
  },
  {
    id: '20', barcode: '7290000234197', name: 'שמנת מתוקה 38%', brand: 'תנובה',
    category: 'חלב וגבינות', weight: 250, unit: 'מ"ל', image: '🥛',
    kosher: 'חלק', allergens: ['חלב'],
    nutrition: { calories: 345, protein: 2.4, carbs: 3, fat: 36 },
    prices: { shufersal: 11.90, ramiLevy: 9.50, yochananof: 11.00, victory: 10.50, carrefour: 11.50, osherAd: 9.90, tivTaam: 11.20, haziHinam: 9.30 }
  },
  {
    id: '21', barcode: '7290005902735', name: 'חומוס מבושל', brand: 'אסם',
    category: 'שימורים', weight: 400, unit: 'גרם', image: '🫘',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 164, protein: 8.9, carbs: 27, fat: 2.6 },
    prices: { shufersal: 5.90, ramiLevy: 4.50, yochananof: 5.50, victory: 5.20, carrefour: 5.80, osherAd: 4.70, tivTaam: 5.60, haziHinam: 4.40 }
  },
  {
    id: '22', barcode: '7290000236285', name: 'טונה בשמן', brand: 'דל מונטה',
    category: 'שימורים', weight: 160, unit: 'גרם', image: '🐟',
    kosher: 'דגים', allergens: ['דגים'],
    nutrition: { calories: 198, protein: 27, carbs: 0, fat: 10 },
    prices: { shufersal: 7.90, ramiLevy: 6.20, yochananof: 7.50, victory: 7.00, carrefour: 7.70, osherAd: 6.50, tivTaam: 7.50, haziHinam: 6.00 }
  },
  {
    id: '23', barcode: '7290000228525', name: 'רסק עגבניות', brand: 'אסם',
    category: 'שימורים', weight: 570, unit: 'גרם', image: '🍅',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 82, protein: 4, carbs: 19, fat: 0.5 },
    prices: { shufersal: 8.90, ramiLevy: 6.90, yochananof: 8.20, victory: 7.80, carrefour: 8.70, osherAd: 7.20, tivTaam: 8.50, haziHinam: 6.70 }
  },
  {
    id: '24', barcode: '7290000162140', name: 'קמח לבן', brand: 'שיבולת',
    category: 'אפייה', weight: 1000, unit: 'גרם', image: '🌾',
    kosher: 'פרווה', allergens: ['גלוטן'],
    nutrition: { calories: 364, protein: 10, carbs: 76, fat: 1 },
    prices: { shufersal: 7.90, ramiLevy: 6.20, yochananof: 7.50, victory: 7.00, carrefour: 7.70, osherAd: 6.50, tivTaam: 7.50, haziHinam: 6.00 }
  },
  {
    id: '25', barcode: '7290000228396', name: 'סוכר לבן', brand: 'שוגר',
    category: 'אפייה', weight: 1000, unit: 'גרם', image: '🍬',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 400, protein: 0, carbs: 100, fat: 0 },
    prices: { shufersal: 6.90, ramiLevy: 5.50, yochananof: 6.50, victory: 6.20, carrefour: 6.70, osherAd: 5.70, tivTaam: 6.50, haziHinam: 5.30 }
  },
  {
    id: '26', barcode: '7290000099514', name: 'שוקולד עלית נשיקות', brand: 'עלית',
    category: 'חטיפים וממתקים', weight: 220, unit: 'גרם', image: '🍫',
    kosher: 'חלק', allergens: ['חלב', 'גלוטן'],
    nutrition: { calories: 530, protein: 6, carbs: 62, fat: 30 },
    prices: { shufersal: 24.90, ramiLevy: 19.90, yochananof: 22.50, victory: 21.50, carrefour: 24.00, osherAd: 20.90, tivTaam: 23.50, haziHinam: 19.50 }
  },
  {
    id: '27', barcode: '7290000138022', name: 'פיתות', brand: 'אחלה',
    category: 'לחם ומאפים', weight: 400, unit: 'גרם (8)', image: '🫓',
    kosher: 'פרווה', allergens: ['גלוטן'],
    nutrition: { calories: 275, protein: 9, carbs: 54, fat: 1.5 },
    prices: { shufersal: 7.90, ramiLevy: 6.50, yochananof: 7.50, victory: 7.20, carrefour: 7.70, osherAd: 6.70, tivTaam: 7.50, haziHinam: 6.30 }
  },
  {
    id: '28', barcode: '7290000135168', name: 'גבינה מלוחה', brand: 'מחלבות גד',
    category: 'חלב וגבינות', weight: 300, unit: 'גרם', image: '🧀',
    kosher: 'חלק', allergens: ['חלב'],
    nutrition: { calories: 260, protein: 16, carbs: 2, fat: 21 },
    prices: { shufersal: 19.90, ramiLevy: 15.90, yochananof: 18.50, victory: 17.50, carrefour: 19.50, osherAd: 16.50, tivTaam: 19.00, haziHinam: 15.50 }
  },
  {
    id: '29', barcode: '7290000652610', name: 'בצל סגול', brand: 'גינות ישראל',
    category: 'ירקות ופירות', weight: 1000, unit: 'גרם', image: '🧅',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 40, protein: 1.1, carbs: 9, fat: 0.1 },
    prices: { shufersal: 5.90, ramiLevy: 4.20, yochananof: 5.50, victory: 5.00, carrefour: 5.70, osherAd: 4.50, tivTaam: 5.50, haziHinam: 4.00 }
  },
  {
    id: '30', barcode: '7290000121000', name: 'שום טרי', brand: 'ישראל טרי',
    category: 'ירקות ופירות', weight: 200, unit: 'גרם', image: '🧄',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 149, protein: 6.4, carbs: 33, fat: 0.5 },
    prices: { shufersal: 7.90, ramiLevy: 5.90, yochananof: 7.20, victory: 6.70, carrefour: 7.70, osherAd: 6.20, tivTaam: 7.50, haziHinam: 5.70 }
  },
  {
    id: '31', barcode: '7290005701009', name: 'פריכיות אורז', brand: 'ביסלי',
    category: 'חטיפים וממתקים', weight: 100, unit: 'גרם', image: '🌾',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 390, protein: 8, carbs: 82, fat: 3 },
    prices: { shufersal: 7.90, ramiLevy: 5.90, yochananof: 7.20, victory: 6.80, carrefour: 7.70, osherAd: 6.20, tivTaam: 7.50, haziHinam: 5.70 }
  },
  {
    id: '32', barcode: '7290000236346', name: 'ממרח שוקולד', brand: 'נוטלה',
    category: 'ממרחים', weight: 400, unit: 'גרם', image: '🍫',
    kosher: 'חלק', allergens: ['חלב', 'אגוזים'],
    nutrition: { calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
    prices: { shufersal: 22.90, ramiLevy: 17.90, yochananof: 21.00, victory: 19.90, carrefour: 22.00, osherAd: 18.90, tivTaam: 21.50, haziHinam: 17.50 }
  },
  {
    id: '33', barcode: '7290000228754', name: 'ריבת תות', brand: 'הלמה',
    category: 'ממרחים', weight: 340, unit: 'גרם', image: '🍓',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 250, protein: 0.5, carbs: 60, fat: 0.2 },
    prices: { shufersal: 12.90, ramiLevy: 9.90, yochananof: 11.50, victory: 11.00, carrefour: 12.50, osherAd: 10.50, tivTaam: 12.00, haziHinam: 9.50 }
  },
  {
    id: '34', barcode: '7290000162096', name: 'מים מינרלים', brand: 'נביעות',
    category: 'משקאות', weight: 1500, unit: 'מ"ל', image: '💧',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    prices: { shufersal: 4.90, ramiLevy: 3.50, yochananof: 4.50, victory: 4.20, carrefour: 4.70, osherAd: 3.70, tivTaam: 4.50, haziHinam: 3.40 }
  },
  {
    id: '35', barcode: '7290000228617', name: 'שמנת חמוצה 15%', brand: 'תנובה',
    category: 'חלב וגבינות', weight: 200, unit: 'גרם', image: '🥛',
    kosher: 'חלק', allergens: ['חלב'],
    nutrition: { calories: 136, protein: 2.8, carbs: 4.2, fat: 13 },
    prices: { shufersal: 7.90, ramiLevy: 6.20, yochananof: 7.50, victory: 7.00, carrefour: 7.70, osherAd: 6.50, tivTaam: 7.50, haziHinam: 6.00 }
  },
  {
    id: '36', barcode: '7290000228389', name: 'אבקת אפייה', brand: 'רויאל',
    category: 'אפייה', weight: 10, unit: 'גרם', image: '🧁',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 53, protein: 0, carbs: 27, fat: 0 },
    prices: { shufersal: 2.90, ramiLevy: 2.20, yochananof: 2.70, victory: 2.50, carrefour: 2.80, osherAd: 2.30, tivTaam: 2.70, haziHinam: 2.10 }
  },
  {
    id: '37', barcode: '7290000662236', name: 'שניצל עוף קפוא', brand: 'זוגלובק',
    category: 'קפואים', weight: 700, unit: 'גרם', image: '🍗',
    kosher: 'גלאט', allergens: ['גלוטן', 'ביצים'],
    nutrition: { calories: 240, protein: 19, carbs: 15, fat: 11 },
    prices: { shufersal: 32.90, ramiLevy: 26.90, yochananof: 30.50, victory: 29.00, carrefour: 32.00, osherAd: 27.90, tivTaam: 31.50, haziHinam: 26.50 }
  },
  {
    id: '38', barcode: '7290000234043', name: 'גלידת וניל', brand: 'עלית',
    category: 'קפואים', weight: 750, unit: 'מ"ל', image: '🍦',
    kosher: 'חלק', allergens: ['חלב', 'ביצים'],
    nutrition: { calories: 197, protein: 3.8, carbs: 26, fat: 9 },
    prices: { shufersal: 24.90, ramiLevy: 19.90, yochananof: 22.50, victory: 21.50, carrefour: 24.00, osherAd: 20.90, tivTaam: 23.50, haziHinam: 19.50 }
  },
  {
    id: '39', barcode: '7290000228303', name: 'דטרגנט כלים', brand: 'פיירי',
    category: 'ניקיון', weight: 500, unit: 'מ"ל', image: '🧴',
    kosher: null, allergens: [],
    nutrition: null,
    prices: { shufersal: 14.90, ramiLevy: 11.90, yochananof: 13.50, victory: 13.00, carrefour: 14.50, osherAd: 12.50, tivTaam: 14.00, haziHinam: 11.50 }
  },
  {
    id: '40', barcode: '7290000228310', name: 'נייר טואלט', brand: 'ניגב',
    category: 'היגיינה', weight: 0, unit: '32 גלילות', image: '🧻',
    kosher: null, allergens: [],
    nutrition: null,
    prices: { shufersal: 49.90, ramiLevy: 39.90, yochananof: 45.00, victory: 43.50, carrefour: 48.50, osherAd: 41.90, tivTaam: 47.50, haziHinam: 38.90 }
  },
  {
    id: '41', barcode: '7290000228327', name: 'תפוחי אדמה', brand: 'טרי',
    category: 'ירקות ופירות', weight: 1000, unit: 'גרם', image: '🥔',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 77, protein: 2, carbs: 17, fat: 0.1 },
    prices: { shufersal: 5.90, ramiLevy: 4.20, yochananof: 5.50, victory: 5.00, carrefour: 5.70, osherAd: 4.50, tivTaam: 5.50, haziHinam: 4.00 }
  },
  {
    id: '42', barcode: '7290000228334', name: 'גזר', brand: 'טרי',
    category: 'ירקות ופירות', weight: 1000, unit: 'גרם', image: '🥕',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 41, protein: 0.9, carbs: 10, fat: 0.2 },
    prices: { shufersal: 4.90, ramiLevy: 3.50, yochananof: 4.50, victory: 4.20, carrefour: 4.70, osherAd: 3.70, tivTaam: 4.50, haziHinam: 3.40 }
  },
  {
    id: '43', barcode: '7290000228341', name: 'בננות', brand: 'חקלאי',
    category: 'ירקות ופירות', weight: 1000, unit: 'גרם', image: '🍌',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    prices: { shufersal: 6.90, ramiLevy: 5.20, yochananof: 6.50, victory: 6.00, carrefour: 6.70, osherAd: 5.50, tivTaam: 6.50, haziHinam: 5.00 }
  },
  {
    id: '44', barcode: '7290000228358', name: 'תפוחים אדומים', brand: 'הגלבוע',
    category: 'ירקות ופירות', weight: 1000, unit: 'גרם', image: '🍎',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
    prices: { shufersal: 7.90, ramiLevy: 5.90, yochananof: 7.20, victory: 6.80, carrefour: 7.70, osherAd: 6.20, tivTaam: 7.50, haziHinam: 5.70 }
  },
  {
    id: '45', barcode: '7290000228365', name: 'לימונים', brand: 'ישראלי',
    category: 'ירקות ופירות', weight: 500, unit: 'גרם', image: '🍋',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 29, protein: 1.1, carbs: 9, fat: 0.3 },
    prices: { shufersal: 4.90, ramiLevy: 3.50, yochananof: 4.50, victory: 4.20, carrefour: 4.70, osherAd: 3.70, tivTaam: 4.50, haziHinam: 3.40 }
  },
  {
    id: '46', barcode: '7290000228372', name: 'כוסמת', brand: 'אמא',
    category: 'דגנים', weight: 500, unit: 'גרם', image: '🌾',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 343, protein: 13, carbs: 72, fat: 3.4 },
    prices: { shufersal: 13.90, ramiLevy: 10.90, yochananof: 12.50, victory: 12.00, carrefour: 13.50, osherAd: 11.50, tivTaam: 13.00, haziHinam: 10.50 }
  },
  {
    id: '47', barcode: '7290000228341', name: 'שוקו תנובה', brand: 'תנובה',
    category: 'משקאות', weight: 500, unit: 'מ"ל', image: '🍫',
    kosher: 'חלק', allergens: ['חלב'],
    nutrition: { calories: 88, protein: 3.8, carbs: 12, fat: 2.8 },
    prices: { shufersal: 5.90, ramiLevy: 4.90, yochananof: 5.50, victory: 5.20, carrefour: 5.70, osherAd: 5.00, tivTaam: 5.60, haziHinam: 4.70 }
  },
  {
    id: '48', barcode: '7290000228342', name: 'קרמבו', brand: 'עלית',
    category: 'חטיפים וממתקים', weight: 288, unit: 'גרם (12)', image: '🍬',
    kosher: 'חלק', allergens: ['חלב', 'גלוטן'],
    nutrition: { calories: 390, protein: 4, carbs: 58, fat: 16 },
    prices: { shufersal: 29.90, ramiLevy: 24.90, yochananof: 27.50, victory: 26.00, carrefour: 29.00, osherAd: 25.90, tivTaam: 28.50, haziHinam: 24.50 }
  },
  {
    id: '49', barcode: '7290000228243', name: 'פלפל אדום', brand: 'טרי',
    category: 'ירקות ופירות', weight: 500, unit: 'גרם', image: '🌶️',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 31, protein: 1, carbs: 6, fat: 0.3 },
    prices: { shufersal: 7.90, ramiLevy: 5.90, yochananof: 7.20, victory: 6.80, carrefour: 7.70, osherAd: 6.20, tivTaam: 7.50, haziHinam: 5.70 }
  },
  {
    id: '50', barcode: '7290000228250', name: 'פטריות שמפיניון', brand: 'מבחר',
    category: 'ירקות ופירות', weight: 250, unit: 'גרם', image: '🍄',
    kosher: 'פרווה', allergens: [],
    nutrition: { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3 },
    prices: { shufersal: 9.90, ramiLevy: 7.50, yochananof: 9.20, victory: 8.70, carrefour: 9.70, osherAd: 7.90, tivTaam: 9.50, haziHinam: 7.30 }
  },
]

export const CATEGORIES = [
  'הכל', 'חלב וגבינות', 'בשר ועוף', 'ירקות ופירות', 'לחם ומאפים',
  'שימורים', 'משקאות', 'חטיפים וממתקים', 'קפואים', 'ניקיון', 'היגיינה',
  'פסטה ואורז', 'אפייה', 'ממרחים', 'קפה ותה', 'דגנים'
]
