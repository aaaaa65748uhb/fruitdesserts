import type { CategoryId, PackageUnit, PackagingShape, Product } from "@/lib/types";

/**
 * DEVELOPMENT DATASET — curated demonstration records.
 *
 * - Names and brands are well-known Israeli grocery products.
 * - Package sizes reflect commonly sold variants but were NOT verified against manufacturer data in this
 *   project, so every record is marked `provenance: "curated_demo"` and the UI says so.
 * - No barcodes are included on purpose: we never invent GTINs. Barcodes arrive from real price-transparency
 *   files via `npm run import:feed`.
 * - `samplePrice` is a demonstration value used to generate offers labelled "נתון לדוגמה". It is never shown
 *   as a live or verified price.
 * - No official packaging artwork is used; the 3D store renders generated placeholder packaging.
 */

type Row = [
  id: string,
  nameHe: string,
  nameEn: string,
  brand: string,
  category: CategoryId,
  size: number,
  unit: PackageUnit,
  shape: PackagingShape,
  color: string,
  accent: string,
  samplePrice: number,
  extra?: { multipack?: number; tags?: string[]; desc?: string },
];

const ROWS: Row[] = [
  // ── חטיפים וממתקים ──
  ["bamba-80", "במבה", "Bamba", "אסם", "snacks", 80, "g", "bag", "#f4b400", "#d32f2f", 5.4, { tags: ["פרווה"], desc: "חטיף תירס בטעם בוטנים" }],
  ["bamba-25x4", "במבה מארז", "Bamba multipack", "אסם", "snacks", 25, "g", "bag", "#f4b400", "#1565c0", 9.9, { multipack: 4 }],
  ["bamba-nougat", "במבה נוגט", "Bamba Nougat", "אסם", "snacks", 60, "g", "bag", "#7b1fa2", "#f4b400", 6.9],
  ["bissli-grill", "ביסלי גריל", "Bissli Grill", "אסם", "snacks", 70, "g", "bag", "#c62828", "#ffd54f", 5.4],
  ["bissli-bbq", "ביסלי ברביקיו", "Bissli BBQ", "אסם", "snacks", 70, "g", "bag", "#4e342e", "#ff7043", 5.4],
  ["bissli-onion", "ביסלי בצל", "Bissli Onion", "אסם", "snacks", 70, "g", "bag", "#2e7d32", "#ffd54f", 5.4],
  ["doritos-nacho", "דוריטוס נאצ'ו", "Doritos Nacho", "סטרוס", "snacks", 70, "g", "bag", "#e53935", "#212121", 6.5],
  ["tapuchips-classic", "תפוצ'יפס קלאסי", "Tapuchips Classic", "עלית", "snacks", 50, "g", "bag", "#fbc02d", "#c62828", 5.2],
  ["apropo", "אפרופו", "Apropo", "עלית", "snacks", 70, "g", "bag", "#ffeb3b", "#1b5e20", 5.9],
  ["pretzels-beigale", "בייגלה שטוחים", "Flat Pretzels", "בייגל בייגל", "snacks", 400, "g", "bag", "#0d47a1", "#ffca28", 9.9],
  ["parah-milk-100", "שוקולד פרה חלב", "Para Milk Chocolate", "עלית", "snacks", 100, "g", "box", "#1565c0", "#ffffff", 6.9, { tags: ["חלבי"] }],
  ["parah-dark-100", "שוקולד פרה מריר", "Para Dark Chocolate", "עלית", "snacks", 100, "g", "box", "#3e2723", "#ffffff", 7.5],
  ["kif-kef", "כיף כף", "Kif Kef", "עלית", "snacks", 25, "g", "box", "#d32f2f", "#fff176", 3.5],
  ["pesek-zman", "פסק זמן", "Pesek Zman", "עלית", "snacks", 45, "g", "box", "#283593", "#ffd54f", 4.5],
  ["klik-cornflakes", "קליק קורנפלקס", "Klik Cornflakes", "עלית", "snacks", 65, "g", "bag", "#f57f17", "#4e342e", 6.9],
  ["mekupelet", "מקופלת", "Mekupelet", "עלית", "snacks", 27, "g", "box", "#6a1b9a", "#ffd54f", 3.9],
  ["wafers-manner", "ופלים במילוי שוקולד", "Chocolate Wafers", "מאנר", "snacks", 500, "g", "box", "#c2185b", "#fce4ec", 14.9],
  ["krembo", "קרמבו וניל", "Krembo Vanilla", "שטראוס", "snacks", 25, "g", "box", "#d32f2f", "#ffffff", 9.9, { multipack: 10 }],
  ["halva-plain", "חלווה וניל", "Vanilla Halva", "אחווה", "snacks", 500, "g", "tub", "#8d6e63", "#fff8e1", 16.9],
  ["popcorn-micro", "פופקורן למיקרוגל", "Microwave Popcorn", "מאסטר שף", "snacks", 300, "g", "box", "#ffeb3b", "#d32f2f", 8.9, { multipack: 3 }],

  // ── משקאות ──
  ["coke-1.5", "קוקה-קולה", "Coca-Cola", "קוקה-קולה", "drinks", 1.5, "l", "bottle", "#c62828", "#ffffff", 7.9],
  ["coke-zero-1.5", "קוקה-קולה זירו", "Coca-Cola Zero", "קוקה-קולה", "drinks", 1.5, "l", "bottle", "#212121", "#e53935", 7.9],
  ["coke-can-6", "קוקה-קולה פחית", "Coca-Cola Cans", "קוקה-קולה", "drinks", 330, "ml", "can", "#c62828", "#ffffff", 19.9, { multipack: 6 }],
  ["sprite-1.5", "ספרייט", "Sprite", "קוקה-קולה", "drinks", 1.5, "l", "bottle", "#2e7d32", "#ffeb3b", 7.5],
  ["fanta-1.5", "פאנטה תפוזים", "Fanta Orange", "קוקה-קולה", "drinks", 1.5, "l", "bottle", "#ef6c00", "#1565c0", 7.5],
  ["mei-eden-1.5x6", "מי עדן מים מינרליים", "Mey Eden Water", "מי עדן", "drinks", 1.5, "l", "bottle", "#29b6f6", "#ffffff", 16.9, { multipack: 6 }],
  ["neviot-1.5x6", "נביעות מים מינרליים", "Neviot Water", "נביעות", "drinks", 1.5, "l", "bottle", "#0288d1", "#e1f5fe", 15.9, { multipack: 6 }],
  ["spring-0.5", "מים מינרליים קטנים", "Spring Water", "סאן פלגרינו", "drinks", 0.5, "l", "bottle", "#00838f", "#ffffff", 4.5],
  ["prigat-orange", "פריגת תפוזים", "Prigat Orange", "פריגת", "drinks", 1.5, "l", "bottle", "#fb8c00", "#2e7d32", 10.9],
  ["prigat-grape", "פריגת ענבים", "Prigat Grape", "פריגת", "drinks", 1.5, "l", "bottle", "#6a1b9a", "#2e7d32", 10.9],
  ["tapuzina", "תפוזינה", "Tapuzina", "יפאורה", "drinks", 1.5, "l", "bottle", "#ff9800", "#fff3e0", 8.9],
  ["xl-energy", "XL משקה אנרגיה", "XL Energy", "XL", "drinks", 250, "ml", "can", "#1a237e", "#ff1744", 6.9],
  ["schweppes-soda", "סודה", "Soda", "שוופס", "drinks", 1.5, "l", "bottle", "#e0f7fa", "#c62828", 5.9],
  ["goldstar-6", "גולדסטאר בירה", "Goldstar Beer", "טמפו", "drinks", 330, "ml", "can", "#b71c1c", "#ffd700", 34.9, { multipack: 6, tags: ["אלכוהול"] }],
  ["iced-tea-peach", "תה קר אפרסק", "Peach Iced Tea", "נסטי", "drinks", 1.5, "l", "bottle", "#ffab91", "#bf360c", 8.5],

  // ── חלב, גבינות וביצים ──
  ["milk-tnuva-3-1l", "חלב טרי 3% בקרטון", "Fresh Milk 3%", "תנובה", "dairy", 1, "l", "carton", "#1976d2", "#ffffff", 7.1, { tags: ["חלבי"] }],
  ["milk-tnuva-1-1l", "חלב טרי 1% בקרטון", "Fresh Milk 1%", "תנובה", "dairy", 1, "l", "carton", "#0d47a1", "#bbdefb", 7.1],
  ["milk-tara-3-1l", "חלב טרי 3%", "Fresh Milk 3%", "טרה", "dairy", 1, "l", "carton", "#e53935", "#ffffff", 7.1],
  ["cottage-tnuva-250", "קוטג' 5%", "Cottage Cheese 5%", "תנובה", "dairy", 250, "g", "tub", "#ffffff", "#1565c0", 6.2],
  ["cottage-tnuva-3", "קוטג' 3%", "Cottage Cheese 3%", "תנובה", "dairy", 250, "g", "tub", "#ffffff", "#43a047", 6.2],
  ["white-cheese-5", "גבינה לבנה 5%", "White Cheese 5%", "תנובה", "dairy", 250, "g", "tub", "#ffffff", "#1e88e5", 5.4],
  ["yellow-emek-200", "גבינה צהובה עמק", "Emek Yellow Cheese", "תנובה", "dairy", 200, "g", "box", "#fdd835", "#1565c0", 14.9],
  ["bulgarian-5", "גבינה בולגרית 5%", "Bulgarian Cheese 5%", "פיראוס", "dairy", 250, "g", "tub", "#ffffff", "#2e7d32", 12.9],
  ["labaneh", "לבנה", "Labaneh", "תנובה", "dairy", 250, "g", "tub", "#ffffff", "#8e24aa", 7.9],
  ["butter-tnuva", "חמאה", "Butter", "תנובה", "dairy", 200, "g", "box", "#fff59d", "#1565c0", 8.9],
  ["eggs-l-12", "ביצים L", "Eggs Large", "משק", "dairy", 12, "unit", "box", "#ffe0b2", "#6d4c41", 15.9],
  ["eggs-m-12", "ביצים M", "Eggs Medium", "משק", "dairy", 12, "unit", "box", "#fff3e0", "#8d6e63", 13.9],
  ["sour-cream-15", "שמנת חמוצה 15%", "Sour Cream 15%", "תנובה", "dairy", 200, "ml", "tub", "#ffffff", "#e53935", 4.9],
  ["sweet-cream-38", "שמנת מתוקה 38%", "Whipping Cream 38%", "תנובה", "dairy", 250, "ml", "carton", "#ffffff", "#1e88e5", 6.9],
  ["gil-leben", "לבן גיל", "Gil Leben", "תנובה", "dairy", 200, "ml", "tub", "#e3f2fd", "#0d47a1", 3.9],
  ["eshel", "אשל", "Eshel", "תנובה", "dairy", 200, "ml", "tub", "#ffffff", "#2e7d32", 3.9],

  // ── מוצרי חלב ותחליפים ──
  ["milky-3", "מילקי", "Milky", "שטראוס", "dairy-alt", 170, "g", "tub", "#4e342e", "#ffffff", 10.9, { multipack: 3 }],
  ["danone-strawberry", "יוגורט דנונה תות", "Danone Strawberry", "שטראוס", "dairy-alt", 150, "g", "tub", "#f8bbd0", "#c2185b", 4.2],
  ["yoplait-greek", "יוגורט יווני", "Greek Yogurt", "יופלה", "dairy-alt", 200, "g", "tub", "#e3f2fd", "#1565c0", 5.9],
  ["dani-vanilla", "דני וניל", "Dani Vanilla", "שטראוס", "dairy-alt", 115, "g", "tub", "#fff9c4", "#5d4037", 3.9],
  ["pudding-choco", "פודינג שוקולד", "Chocolate Pudding", "שטראוס", "dairy-alt", 125, "g", "tub", "#6d4c41", "#ffffff", 3.5],
  ["alpro-soy", "משקה סויה", "Soy Drink", "אלפרו", "dairy-alt", 1, "l", "carton", "#43a047", "#ffffff", 13.9, { tags: ["טבעוני"] }],
  ["oat-drink", "משקה שיבולת שועל", "Oat Drink", "אלפרו", "dairy-alt", 1, "l", "carton", "#d7ccc8", "#3e2723", 14.9, { tags: ["טבעוני"] }],
  ["almond-drink", "משקה שקדים", "Almond Drink", "אלפרו", "dairy-alt", 1, "l", "carton", "#a1887f", "#ffffff", 14.9, { tags: ["טבעוני"] }],
  ["tofu", "טופו", "Tofu", "טבעול", "dairy-alt", 300, "g", "box", "#fafafa", "#2e7d32", 9.9, { tags: ["טבעוני"] }],
  ["yolo-choco", "יולו שוקולד", "Yolo Chocolate Yogurt", "תנובה", "dairy-alt", 150, "g", "tub", "#795548", "#ffeb3b", 4.5],
  ["shoko-tnuva", "שוקו בשקית", "Chocolate Milk Bag", "תנובה", "dairy-alt", 1, "l", "carton", "#5d4037", "#ffffff", 7.9],

  // ── פסטה, אורז וקטניות ──
  ["osem-spaghetti", "ספגטי", "Spaghetti", "אסם", "pasta-rice", 500, "g", "box", "#1565c0", "#ffd54f", 5.9],
  ["osem-penne", "פנה", "Penne", "אסם", "pasta-rice", 500, "g", "box", "#1565c0", "#ef5350", 5.9],
  ["osem-ptitim", "פתיתים אפויים", "Ptitim", "אסם", "pasta-rice", 500, "g", "box", "#0d47a1", "#ffeb3b", 6.4],
  ["osem-ptitim-rings", "פתיתים טבעות", "Ptitim Rings", "אסם", "pasta-rice", 500, "g", "box", "#0d47a1", "#81c784", 6.4],
  ["barilla-spaghetti", "ספגטי מס' 5", "Spaghetti No.5", "ברילה", "pasta-rice", 500, "g", "box", "#1e3a8a", "#ffffff", 7.9],
  ["rice-sugat-persian", "אורז פרסי", "Persian Rice", "סוגת", "pasta-rice", 1, "kg", "bag", "#ffffff", "#c62828", 11.9],
  ["rice-sugat-basmati", "אורז בסמטי", "Basmati Rice", "סוגת", "pasta-rice", 1, "kg", "bag", "#fff8e1", "#6a1b9a", 15.9],
  ["rice-sugat-jasmine", "אורז יסמין", "Jasmine Rice", "סוגת", "pasta-rice", 1, "kg", "bag", "#fffde7", "#00897b", 14.9],
  ["lentils-red", "עדשים כתומות", "Red Lentils", "סוגת", "pasta-rice", 1, "kg", "bag", "#ff8a65", "#bf360c", 11.9],
  ["chickpeas-dry", "חומוס יבש", "Dried Chickpeas", "סוגת", "pasta-rice", 1, "kg", "bag", "#ffe0b2", "#e65100", 10.9],
  ["bulgur", "בורגול", "Bulgur", "סוגת", "pasta-rice", 1, "kg", "bag", "#d7ccc8", "#5d4037", 9.9],
  ["couscous", "קוסקוס", "Couscous", "אסם", "pasta-rice", 500, "g", "box", "#fff59d", "#1565c0", 7.9],
  ["noodles-egg", "אטריות ביצים", "Egg Noodles", "אסם", "pasta-rice", 400, "g", "bag", "#ffecb3", "#1565c0", 6.9],
  ["quinoa", "קינואה", "Quinoa", "סוגת", "pasta-rice", 500, "g", "bag", "#f5f5f5", "#558b2f", 17.9],

  // ── שימורים, רטבים ותבלינים ──
  ["osem-ketchup", "קטשופ", "Ketchup", "אסם", "canned-sauces", 750, "g", "bottle", "#d32f2f", "#ffffff", 9.9],
  ["heinz-ketchup", "קטשופ היינץ", "Heinz Ketchup", "היינץ", "canned-sauces", 570, "g", "bottle", "#c62828", "#2e7d32", 13.9],
  ["mayo-telma", "מיונז", "Mayonnaise", "תלמה", "canned-sauces", 500, "g", "jar", "#fffde7", "#1565c0", 11.9],
  ["tahini-har-bracha", "טחינה גולמית", "Raw Tahini", "הר ברכה", "canned-sauces", 500, "g", "jar", "#d7ccc8", "#1b5e20", 19.9],
  ["hummus-tzabar", "חומוס צבר", "Tzabar Hummus", "צבר", "canned-sauces", 400, "g", "tub", "#ffe0b2", "#2e7d32", 8.9],
  ["tuna-starkist", "טונה בשמן", "Tuna in Oil", "סטארקיסט", "canned-sauces", 160, "g", "can", "#1565c0", "#ffeb3b", 23.9, { multipack: 4 }],
  ["corn-can", "תירס מתוק", "Sweet Corn", "יכין", "canned-sauces", 340, "g", "can", "#fdd835", "#2e7d32", 5.9],
  ["pickles", "מלפפונים חמוצים", "Pickles", "יכין", "canned-sauces", 560, "g", "jar", "#558b2f", "#ffeb3b", 7.9],
  ["tomato-paste", "רסק עגבניות", "Tomato Paste", "פרי ניר", "canned-sauces", 100, "g", "can", "#c62828", "#ffd54f", 2.9],
  ["chickpeas-can", "חומוס בשימורים", "Canned Chickpeas", "יכין", "canned-sauces", 540, "g", "can", "#ffcc80", "#4e342e", 5.5],
  ["olives-green", "זיתים ירוקים", "Green Olives", "יכין", "canned-sauces", 560, "g", "jar", "#689f38", "#ffffff", 9.9],
  ["soup-powder", "אבקת מרק עוף", "Chicken Soup Powder", "אסם", "canned-sauces", 400, "g", "jar", "#ffeb3b", "#e65100", 14.9],
  ["paprika", "פפריקה מתוקה", "Sweet Paprika", "פרג", "canned-sauces", 100, "g", "jar", "#d84315", "#ffffff", 7.9],
  ["salt-atlit", "מלח שולחן", "Table Salt", "מלח הארץ", "canned-sauces", 1, "kg", "bag", "#1565c0", "#ffffff", 2.9],
  ["silan", "סילאן", "Date Syrup", "ממלכת הדבש", "canned-sauces", 350, "g", "jar", "#4e342e", "#ffb300", 12.9],
  ["schug", "סחוג ירוק", "Green Schug", "צבר", "canned-sauces", 200, "g", "tub", "#2e7d32", "#ffffff", 7.5],

  // ── בוקר, קפה ואפייה ──
  ["cornflakes-telma", "קורנפלקס", "Cornflakes", "תלמה", "breakfast-baking", 750, "g", "box", "#ffffff", "#f57c00", 16.9],
  ["kariot-telma", "כריות במילוי נוגט", "Nougat Pillows", "תלמה", "breakfast-baking", 375, "g", "box", "#6d4c41", "#ffd54f", 15.9],
  ["granola", "גרנולה", "Granola", "תלמה", "breakfast-baking", 500, "g", "bag", "#a1887f", "#2e7d32", 18.9],
  ["oats-quaker", "שיבולת שועל", "Rolled Oats", "קוואקר", "breakfast-baking", 500, "g", "box", "#1565c0", "#d32f2f", 11.9],
  ["flour-sugat", "קמח לבן", "White Flour", "סוגת", "breakfast-baking", 1, "kg", "bag", "#ffffff", "#1565c0", 5.9],
  ["flour-whole", "קמח מלא", "Whole Wheat Flour", "סוגת", "breakfast-baking", 1, "kg", "bag", "#d7ccc8", "#4e342e", 7.9],
  ["sugar-sugat", "סוכר לבן", "White Sugar", "סוגת", "breakfast-baking", 1, "kg", "bag", "#ffffff", "#c62828", 5.5],
  ["olive-oil-yad", "שמן זית כתית מעולה", "Extra Virgin Olive Oil", "יד מרדכי", "breakfast-baking", 750, "ml", "bottle", "#33691e", "#ffd54f", 39.9],
  ["canola-oil", "שמן קנולה", "Canola Oil", "עץ הזית", "breakfast-baking", 1, "l", "bottle", "#fff176", "#1565c0", 12.9],
  ["elite-coffee", "קפה טורקי", "Turkish Coffee", "עלית", "breakfast-baking", 200, "g", "bag", "#4e342e", "#ffd54f", 13.9],
  ["nescafe-taster", "קפה נמס טייסטרס צ'ויס", "Taster's Choice", "נסקפה", "breakfast-baking", 200, "g", "jar", "#3e2723", "#d32f2f", 34.9],
  ["tea-wissotzky", "תה קלאסי", "Classic Tea", "ויסוצקי", "breakfast-baking", 100, "unit", "box", "#c62828", "#ffd54f", 14.9],
  ["honey", "דבש פרחי בר", "Wildflower Honey", "יד מרדכי", "breakfast-baking", 500, "g", "jar", "#ffb300", "#4e342e", 24.9],
  ["hashachar", "ממרח השחר העולה", "Hashachar Spread", "השחר העולה", "breakfast-baking", 350, "g", "jar", "#5d4037", "#fff176", 13.9],
  ["jam-strawberry", "ריבת תות", "Strawberry Jam", "יכין", "breakfast-baking", 450, "g", "jar", "#c2185b", "#ffffff", 12.9],
  ["baking-powder", "אבקת אפייה", "Baking Powder", "שטראוס", "breakfast-baking", 10, "g", "box", "#ffffff", "#1565c0", 4.9, { multipack: 10 }],

  // ── מאפים ולחמים ──
  ["bread-angel-white", "לחם אחיד פרוס", "Sliced Standard Bread", "אנג'ל", "bakery", 750, "g", "loaf", "#ffe0b2", "#1565c0", 7.4],
  ["bread-angel-whole", "לחם מחיטה מלאה", "Whole Wheat Bread", "אנג'ל", "bakery", 750, "g", "loaf", "#bcaaa4", "#2e7d32", 13.9],
  ["bread-berman-rye", "לחם שיפון", "Rye Bread", "ברמן", "bakery", 750, "g", "loaf", "#8d6e63", "#ffd54f", 14.9],
  ["pita-8", "פיתות", "Pita", "אנג'ל", "bakery", 8, "unit", "bag", "#ffe0b2", "#d32f2f", 8.9],
  ["challah", "חלה מתוקה", "Sweet Challah", "אנג'ל", "bakery", 500, "g", "loaf", "#ffb74d", "#5d4037", 10.9],
  ["rugelach", "רוגלך שוקולד", "Chocolate Rugelach", "מאפיית הבית", "bakery", 400, "g", "box", "#6d4c41", "#ffe0b2", 19.9],
  ["bourekas-cheese", "בורקס גבינה", "Cheese Bourekas", "מאפיית הבית", "bakery", 500, "g", "box", "#ffcc80", "#1565c0", 22.9],
  ["crackers-osem", "קרקר מלוח", "Salted Crackers", "אסם", "bakery", 400, "g", "box", "#ffffff", "#c62828", 9.9],
  ["petit-beurre", "פתי בר", "Petit Beurre", "אסם", "bakery", 250, "g", "box", "#fff59d", "#0d47a1", 6.9],
  ["lachmaniyot", "לחמניות", "Rolls", "אנג'ל", "bakery", 6, "unit", "bag", "#ffcc80", "#2e7d32", 9.9],

  // ── ניקיון וטיפוח ──
  ["dish-soap-palmolive", "נוזל כלים", "Dish Soap", "פאלמוליב", "cleaning-care", 750, "ml", "bottle", "#43a047", "#ffffff", 8.9],
  ["fairy-dish", "נוזל כלים מרוכז", "Concentrated Dish Soap", "פיירי", "cleaning-care", 650, "ml", "bottle", "#00b0ff", "#ffeb3b", 11.9],
  ["sano-javel", "אקונומיקה", "Bleach", "סנו", "cleaning-care", 4, "l", "bottle", "#e3f2fd", "#1565c0", 13.9],
  ["sano-floor", "נוזל לניקוי רצפות", "Floor Cleaner", "סנו", "cleaning-care", 1.5, "l", "bottle", "#ce93d8", "#4a148c", 12.9],
  ["laundry-ariel", "אבקת כביסה", "Laundry Powder", "אריאל", "cleaning-care", 3, "kg", "box", "#1b5e20", "#ffeb3b", 49.9],
  ["laundry-gel-persil", "ג'ל כביסה", "Laundry Gel", "פרסיל", "cleaning-care", 2.5, "l", "bottle", "#c62828", "#1565c0", 44.9],
  ["softener-badin", "מרכך כביסה", "Fabric Softener", "בדין", "cleaning-care", 4, "l", "bottle", "#f48fb1", "#ffffff", 22.9],
  ["shampoo-hawaii", "שמפו", "Shampoo", "האוויי", "cleaning-care", 700, "ml", "bottle", "#26a69a", "#ffffff", 14.9],
  ["head-shoulders", "שמפו נגד קשקשים", "Anti-Dandruff Shampoo", "הד אנד שולדרס", "cleaning-care", 400, "ml", "bottle", "#0d47a1", "#ffffff", 24.9],
  ["toothpaste-colgate", "משחת שיניים", "Toothpaste", "קולגייט", "cleaning-care", 100, "ml", "box", "#d32f2f", "#ffffff", 9.9],
  ["deodorant-dove", "דאודורנט ספריי", "Deodorant Spray", "דאב", "cleaning-care", 150, "ml", "can", "#ffffff", "#1a237e", 15.9],
  ["soap-hands", "סבון ידיים נוזלי", "Liquid Hand Soap", "קרליין", "cleaning-care", 1, "l", "bottle", "#f8bbd0", "#880e4f", 9.9],
  ["sponges", "ספוגים לכלים", "Dish Sponges", "סנו", "cleaning-care", 10, "unit", "bag", "#ffeb3b", "#2e7d32", 9.9],
  ["windex", "מנקה חלונות", "Glass Cleaner", "סנו", "cleaning-care", 750, "ml", "bottle", "#4fc3f7", "#ffffff", 11.9],

  // ── מוצרים לבית ──
  ["tp-lily-32", "נייר טואלט", "Toilet Paper", "לילי", "home", 32, "unit", "roll", "#ffffff", "#1565c0", 39.9],
  ["tp-molett-24", "נייר טואלט מולט", "Molett Toilet Paper", "חוגלה", "home", 24, "unit", "roll", "#ffffff", "#e91e63", 34.9],
  ["paper-towels", "מגבות נייר", "Paper Towels", "לילי", "home", 6, "unit", "roll", "#ffffff", "#43a047", 19.9],
  ["tissues", "ממחטות נייר", "Tissues", "טאצ'", "home", 100, "unit", "box", "#e1f5fe", "#0277bd", 6.9],
  ["foil", "נייר כסף", "Aluminium Foil", "סנו", "home", 30, "unit", "box", "#cfd8dc", "#c62828", 14.9, { desc: "גליל 30 מטר" }],
  ["cling-wrap", "ניילון נצמד", "Cling Wrap", "סנו", "home", 100, "unit", "box", "#e3f2fd", "#1565c0", 11.9, { desc: "גליל 100 מטר" }],
  ["baking-paper", "נייר אפייה", "Baking Paper", "סנו", "home", 8, "unit", "box", "#fff8e1", "#6d4c41", 9.9, { desc: "גליל 8 מטר" }],
  ["trash-bags", "שקיות אשפה", "Trash Bags", "סנו", "home", 30, "unit", "box", "#212121", "#ffeb3b", 12.9],
  ["diapers-huggies", "חיתולים", "Diapers", "האגיס", "home", 40, "unit", "bag", "#e3f2fd", "#e53935", 54.9],
  ["wet-wipes", "מגבונים לחים", "Wet Wipes", "האגיס", "home", 64, "unit", "bag", "#e8f5e9", "#43a047", 9.9],
  ["disposable-plates", "צלחות חד-פעמיות", "Disposable Plates", "טאצ'", "home", 50, "unit", "bag", "#ffffff", "#ff7043", 11.9],
  ["candles-shabbat", "נרות שבת", "Shabbat Candles", "נרות הדר", "home", 72, "unit", "box", "#ffffff", "#1a237e", 14.9],

  // ── פירות וירקות ──
  ["tomatoes", "עגבניות", "Tomatoes", "תוצרת הארץ", "produce", 1, "kg", "produce", "#e53935", "#2e7d32", 6.9],
  ["cucumbers", "מלפפונים", "Cucumbers", "תוצרת הארץ", "produce", 1, "kg", "produce", "#43a047", "#1b5e20", 5.9],
  ["onions", "בצל יבש", "Onions", "תוצרת הארץ", "produce", 1, "kg", "produce", "#d7a86e", "#6d4c41", 4.9],
  ["potatoes", "תפוחי אדמה", "Potatoes", "תוצרת הארץ", "produce", 1, "kg", "produce", "#c8a165", "#5d4037", 4.9],
  ["carrots", "גזר", "Carrots", "תוצרת הארץ", "produce", 1, "kg", "produce", "#fb8c00", "#2e7d32", 4.5],
  ["peppers-red", "פלפל אדום", "Red Peppers", "תוצרת הארץ", "produce", 1, "kg", "produce", "#d32f2f", "#1b5e20", 9.9],
  ["bananas", "בננות", "Bananas", "תוצרת הארץ", "produce", 1, "kg", "produce", "#fdd835", "#6d4c41", 7.9],
  ["apples-pink", "תפוחי עץ פינק ליידי", "Pink Lady Apples", "תוצרת הארץ", "produce", 1, "kg", "produce", "#e57373", "#2e7d32", 12.9],
  ["oranges", "תפוזים", "Oranges", "תוצרת הארץ", "produce", 1, "kg", "produce", "#fb8c00", "#2e7d32", 6.9],
  ["avocado", "אבוקדו", "Avocado", "תוצרת הארץ", "produce", 1, "kg", "produce", "#33691e", "#827717", 14.9],
  ["lemons", "לימונים", "Lemons", "תוצרת הארץ", "produce", 1, "kg", "produce", "#ffee58", "#558b2f", 7.9],
  ["lettuce", "חסה ערבית", "Romaine Lettuce", "תוצרת הארץ", "produce", 1, "unit", "produce", "#7cb342", "#33691e", 5.9],
];

const SEED_TIMESTAMP = "2026-10-01T00:00:00.000Z";

export const SEED_PRODUCTS: Product[] = ROWS.map(
  ([id, nameHe, nameEn, brand, category, size, unit, shape, color, accent, , extra]) => ({
    id,
    nameHe,
    nameEn,
    brand,
    category,
    packageSize: size,
    packageUnit: unit,
    multipack: extra?.multipack,
    dietaryTags: extra?.tags,
    productDescription: extra?.desc,
    manufacturer: brand,
    provenance: "curated_demo",
    imageSource: "placeholder-generated",
    packaging: { shape, color, accent },
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  }),
);

/** Demonstration base price per product (₪). Only used to generate offers labelled as sample data. */
export const SEED_SAMPLE_PRICES: Record<string, number> = Object.fromEntries(ROWS.map((r) => [r[0], r[10]]));
