import { isUsableOffer, linePrice, sortOffers } from "./compare";
import { FRESHNESS_LABEL_HE } from "./freshness";
import { formatILS, roundMoney } from "./format";
import { formatPackage } from "./units";
import type { PriceOffer, Product, Retailer } from "./types";

export interface HandoffLine {
  productId: string;
  nameHe: string;
  brand: string;
  packageLabel: string;
  barcode?: string;
  quantity: number;
  offer?: PriceOffer;
  subtotal?: number;
}

export interface CheckoutHandoff {
  retailerId: string;
  retailerName: string;
  /** Official retailer destination. Only https URLs from the retailer directory are ever used. */
  destinationUrl: string;
  integration: Retailer["integration"];
  matched: HandoffLine[];
  missing: HandoffLine[];
  knownSubtotal: number;
  /** What the user must do on the retailer site, in plain Hebrew. */
  instructions: string[];
  checklistText: string;
  whatsappUrl: string;
}

export function safeExternalUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function buildCheckoutHandoff(
  retailer: Retailer,
  lines: { productId: string; quantity: number }[],
  products: Record<string, Product | undefined>,
  offersByProduct: Record<string, PriceOffer[]>,
): CheckoutHandoff {
  const matched: HandoffLine[] = [];
  const missing: HandoffLine[] = [];
  for (const line of lines) {
    const product = products[line.productId];
    if (!product || line.quantity <= 0) continue;
    const base: HandoffLine = {
      productId: product.id,
      nameHe: product.nameHe,
      brand: product.brand,
      packageLabel: formatPackage(product),
      barcode: product.barcode,
      quantity: line.quantity,
    };
    const offer = sortOffers(
      (offersByProduct[product.id] ?? []).filter((o) => o.retailerId === retailer.id && isUsableOffer(o)),
      "price",
    )[0];
    if (offer) matched.push({ ...base, offer, subtotal: linePrice(offer, line.quantity) });
    else missing.push(base);
  }
  const knownSubtotal = roundMoney(matched.reduce((s, l) => s + (l.subtotal ?? 0), 0));
  const destinationUrl = safeExternalUrl(retailer.homepageUrl) ?? "about:blank";

  const instructions =
    retailer.integration === "official_api"
      ? ["הסל יועבר ישירות לחשבונך באתר הרשת."]
      : [
          `ל${retailer.nameHe} אין כרגע ממשק רשמי להעברת סל קניות, ולכן יש להוסיף את המוצרים מחדש באתר הרשת.`,
          "השתמשו ברשימת הסימון: חפשו כל מוצר באתר הרשת, ודאו שהגודל והמותג זהים, וסמנו אותו כאן.",
          "התשלום, פרטי המשלוח ואישור ההזמנה מתבצעים באתר הרשמי של הרשת בלבד. SUPERIL לא אוסף סיסמאות או פרטי תשלום.",
          "המחירים כאן מבוססים על הנתונים שבידינו (מסומנים לפי מקורם). המחיר הקובע הוא המחיר באתר הרשת בעת ההזמנה, וייתכן שהוא שונה, במיוחד באתר האונליין לעומת סניף.",
        ];
  if (missing.length) instructions.push(`ל-${missing.length} מוצרים אין התאמה מאומתת ב${retailer.nameHe} – בדקו זמינות באתר הרשת.`);

  const rows = [...matched, ...missing].map((l) => {
    const price = l.offer ? ` – ${formatILS(l.subtotal!)} (${FRESHNESS_LABEL_HE[l.offer.freshness]})` : " – ללא מחיר מאומת";
    const code = l.barcode ? ` [ברקוד ${l.barcode}]` : "";
    return `☐ ${l.quantity} × ${l.nameHe} ${l.brand}, ${l.packageLabel}${code}${price}`;
  });
  const checklistText = [`רשימת קניות עבור ${retailer.nameHe} (נוצרה ב-SUPERIL)`, ...rows, "", `סכום ידוע למוצרים: ${formatILS(knownSubtotal)} (ללא משלוח)`].join("\n");

  return {
    retailerId: retailer.id,
    retailerName: retailer.nameHe,
    destinationUrl,
    integration: retailer.integration,
    matched,
    missing,
    knownSubtotal,
    instructions,
    checklistText,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(checklistText)}`,
  };
}
