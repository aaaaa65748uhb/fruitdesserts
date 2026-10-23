import type { CategoryId } from "./types";

export interface CategoryInfo {
  id: CategoryId;
  nameHe: string;
  nameEn: string;
  /** Where the category lives in the 3D store. */
  zone: string;
  color: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: "snacks", nameHe: "חטיפים וממתקים", nameEn: "Snacks & Sweets", zone: "מעבר 1", color: "#f97316" },
  { id: "drinks", nameHe: "משקאות", nameEn: "Drinks", zone: "מעבר 2 + מקררי שתייה", color: "#0ea5e9" },
  { id: "pasta-rice", nameHe: "פסטה, אורז וקטניות", nameEn: "Pasta, Rice & Legumes", zone: "מעבר 3", color: "#eab308" },
  { id: "canned-sauces", nameHe: "שימורים, רטבים ותבלינים", nameEn: "Canned, Sauces & Spices", zone: "מעבר 4", color: "#dc2626" },
  { id: "breakfast-baking", nameHe: "בוקר, קפה ואפייה", nameEn: "Breakfast, Coffee & Baking", zone: "מעבר 5", color: "#a16207" },
  { id: "cleaning-care", nameHe: "ניקיון וטיפוח", nameEn: "Cleaning & Personal Care", zone: "מעברים 6–7", color: "#7c3aed" },
  { id: "home", nameHe: "מוצרים לבית", nameEn: "Home Goods", zone: "מעבר 8", color: "#0d9488" },
  { id: "dairy", nameHe: "חלב, גבינות וביצים", nameEn: "Milk, Cheese & Eggs", zone: "מקררים – קיר אחורי", color: "#2563eb" },
  { id: "dairy-alt", nameHe: "מוצרי חלב ותחליפים", nameEn: "Dairy Desserts & Alternatives", zone: "מקררים – קיר אחורי", color: "#db2777" },
  { id: "bakery", nameHe: "מאפים ולחמים", nameEn: "Bakery & Bread", zone: "מאפייה – קיר מערבי", color: "#b45309" },
  { id: "produce", nameHe: "פירות וירקות", nameEn: "Fruit & Vegetables", zone: "אזור ירקות – ליד הכניסה", color: "#16a34a" },
  { id: "other", nameHe: "שונות", nameEn: "Other", zone: "לא משויך למדף", color: "#64748b" },
];

export const CATEGORY_BY_ID: Record<CategoryId, CategoryInfo> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryInfo>;

export function categoryName(id: CategoryId): string {
  return CATEGORY_BY_ID[id]?.nameHe ?? id;
}
