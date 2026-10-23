import type { PackageUnit, Product } from "./types";

export type MeasureBasis = "100g" | "100ml" | "unit";

/** Total measurable quantity of a package in base units (g, ml or units), multipacks included. */
export function totalBaseQuantity(p: Pick<Product, "packageSize" | "packageUnit" | "multipack">): {
  amount: number;
  basis: MeasureBasis;
} {
  const multi = p.multipack && p.multipack > 1 ? p.multipack : 1;
  switch (p.packageUnit) {
    case "g":
      return { amount: p.packageSize * multi, basis: "100g" };
    case "kg":
      return { amount: p.packageSize * 1000 * multi, basis: "100g" };
    case "ml":
      return { amount: p.packageSize * multi, basis: "100ml" };
    case "l":
      return { amount: p.packageSize * 1000 * multi, basis: "100ml" };
    case "unit":
      return { amount: p.packageSize * multi, basis: "unit" };
  }
}

/** Price per 100g / 100ml / unit. Returns undefined when the package quantity is unknown or zero. */
export function computeUnitPrice(
  price: number,
  p: Pick<Product, "packageSize" | "packageUnit" | "multipack">,
): { unitPrice: number; basis: MeasureBasis } | undefined {
  if (!(price >= 0) || !(p.packageSize > 0)) return undefined;
  const { amount, basis } = totalBaseQuantity(p);
  if (amount <= 0) return undefined;
  const per = basis === "unit" ? price / amount : (price / amount) * 100;
  return { unitPrice: Math.round(per * 1000) / 1000, basis };
}

export const BASIS_LABEL_HE: Record<MeasureBasis, string> = {
  "100g": "ל-100 גרם",
  "100ml": "ל-100 מ\"ל",
  unit: "ליחידה",
};

const UNIT_LABEL_HE: Record<PackageUnit, string> = {
  g: "גרם",
  kg: "ק\"ג",
  ml: "מ\"ל",
  l: "ליטר",
  unit: "יח'",
};

export function formatPackage(p: Pick<Product, "packageSize" | "packageUnit" | "multipack">): string {
  const size = `${formatNumber(p.packageSize)} ${UNIT_LABEL_HE[p.packageUnit]}`;
  return p.multipack && p.multipack > 1 ? `${p.multipack} × ${size}` : size;
}

/** Two products are size-comparable only if they share the same measurement basis. */
export function sameBasis(
  a: Pick<Product, "packageSize" | "packageUnit" | "multipack">,
  b: Pick<Product, "packageSize" | "packageUnit" | "multipack">,
): boolean {
  return totalBaseQuantity(a).basis === totalBaseQuantity(b).basis;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 }).format(n);
}
