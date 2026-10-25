import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Packshot } from "@/components/Packshot";
import { PHOTO_LICENSE, PRODUCT_PHOTOS } from "@/data/product-photos";
import { categoryName } from "@/lib/categories";
import { formatDateTimeHe } from "@/lib/format";
import { formatPackage } from "@/lib/units";
import { getProvider } from "@/server/providers";
import { ProductOffers } from "./ProductOffers";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await (await getProvider()).getProductById(id);
  return { title: p ? `${p.nameHe} ${p.brand}` : "מוצר" };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const provider = await getProvider();
  const product = await provider.getProductById(id);
  if (!product) notFound();
  const offers = await provider.getProductOffers(id);

  const photo = PRODUCT_PHOTOS[product.id];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="text-sm text-slate-500" aria-label="פירורי לחם">
        <Link href="/search" className="hover:underline">חיפוש</Link> /{" "}
        <Link href={`/search?category=${product.category}`} className="hover:underline">{categoryName(product.category)}</Link>
      </nav>
      <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="grid place-items-center rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 py-8">
            <Packshot product={product} size={260} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {photo ? (
              <>
                תמונה:{" "}
                <a href={`https://world.openfoodfacts.org/product/${photo.offCode}`} target="_blank" rel="noopener noreferrer" className="underline">
                  Open Food Facts
                </a>
                {photo.by ? ` · צילום: ${photo.by}` : ""} ·{" "}
                <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.he" target="_blank" rel="noopener noreferrer" className="underline">
                  {PHOTO_LICENSE}
                </a>
                {" "}· התמונה עובדה (חיתוך והסרת רקע). ייתכנו הבדלים בין האריזה בתמונה לאריזה הנמכרת כיום.
              </>
            ) : product.imageUrl ? (
              `מקור התמונה: ${product.imageSource ?? "לא צוין"}${product.imageLicense ? ` · רישיון: ${product.imageLicense}` : ""}`
            ) : (
              "איור אריזה להמחשה – אין לנו עדיין תמונה מורשית של המוצר."
            )}
          </p>
        </div>
        <div>
          <p className="text-slate-500">{product.brand}</p>
          <h1 className="text-3xl font-extrabold md:text-4xl">{product.nameHe}</h1>
          {product.nameEn && <p className="text-slate-500" dir="ltr">{product.nameEn}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Info label="גודל אריזה" value={formatPackage(product)} />
            <Info label="מחלקה" value={categoryName(product.category)} />
            <Info label="ברקוד" value={product.barcode ?? "לא זמין"} ltr={!!product.barcode} />
            {product.manufacturer && <Info label="יצרן" value={product.manufacturer} />}
            {product.dietaryTags?.length ? <Info label="תגיות" value={product.dietaryTags.join(", ")} /> : null}
            <Info label="עודכן" value={formatDateTimeHe(product.updatedAt)} />
          </dl>
          {product.productDescription && <p className="mt-4 text-slate-700">{product.productDescription}</p>}
          {product.provenance === "curated_demo" && (
            <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              מוצר קטלוג שנאסף ידנית: שם המוצר והמותג מוכרים, אך גודל האריזה לא אומת מול היצרן.{" "}
              {product.barcode ? "המחירים הרשמיים מקושרים אליו לפי ברקוד שנבדק, ורק לאריזה באותו גודל." : "אין לו ברקוד מאומת, ולכן לא מקושרים אליו מחירים רשמיים."}{" "}
              {offers.some((o) => o.freshness === "sample") && "המחירים המסומנים \"נתון לדוגמה\" אינם מחירים אמיתיים."}
            </p>
          )}
          {product.provenance === "price_feed" && (
            <p className="mt-4 rounded-2xl bg-sky-50 p-3 text-sm text-sky-900 ring-1 ring-sky-200">פרטי מוצר זה נלקחו מקובץ מחירים רשמי שפרסמה רשת לפי חוק שקיפות המחירים.{product.barcode ? " המחירים בין הרשתות מושווים לפי אותו ברקוד ואותו גודל אריזה." : " זהו קוד פנימי של הרשת – אין השוואה לרשתות אחרות."}</p>
          )}
          <ProductOffers product={product} initialOffers={offers} />
          <section className="mt-6 rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-100">
            <h2 className="font-bold text-ink">היסטוריית מחירים</h2>
            <p className="mt-1">אין עדיין נתוני היסטוריה אמיתיים למוצר זה. היסטוריה תוצג רק לאחר ייבוא קבצי מחירים לאורך זמן.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`font-bold ${ltr ? "num" : ""}`}>{value}</dd>
    </div>
  );
}
