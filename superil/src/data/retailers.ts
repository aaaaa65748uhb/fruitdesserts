import type { Retailer } from "@/lib/types";

/**
 * Retailer directory.
 *
 * Integration status (researched October 2026, see docs/INTEGRATIONS.md):
 * - No retailer publishes an official public cart-transfer API, documented add-to-cart deep link, or
 *   affiliate program that we could verify. All retailers therefore use `homepage_handoff`: the user gets a
 *   checklist of their basket and continues on the retailer's official site, where the retailer handles
 *   payment and delivery.
 * - `homepageVerified: true` means the URL was given in the project brief. Others are the commonly known
 *   addresses and should be confirmed by the project owner.
 * - Delivery fees / minimum orders are intentionally left undefined: we have not verified current values.
 */
export const RETAILERS: Retailer[] = [
  {
    id: "shufersal",
    nameHe: "שופרסל",
    nameEn: "Shufersal",
    color: "#e30613",
    textColor: "#ffffff",
    homepageUrl: "https://www.shufersal.co.il/",
    homepageVerified: true,
    onlineShopping: true,
    integration: "homepage_handoff",
  },
  {
    id: "rami-levy",
    nameHe: "רמי לוי",
    nameEn: "Rami Levy",
    color: "#003da5",
    textColor: "#ffffff",
    homepageUrl: "https://www.rami-levy.co.il/",
    homepageVerified: true,
    onlineShopping: true,
    integration: "homepage_handoff",
  },
  {
    id: "victory",
    nameHe: "ויקטורי",
    nameEn: "Victory",
    color: "#f7a600",
    textColor: "#1f2937",
    homepageUrl: "https://www.victoryonline.co.il/",
    homepageVerified: true,
    onlineShopping: true,
    integration: "homepage_handoff",
  },
  {
    id: "carrefour",
    nameHe: "קרפור",
    nameEn: "Carrefour",
    color: "#1e4fa0",
    textColor: "#ffffff",
    homepageUrl: "https://www.carrefour.co.il/",
    homepageVerified: true,
    onlineShopping: true,
    integration: "homepage_handoff",
  },
  {
    id: "hazi-hinam",
    nameHe: "חצי חינם",
    nameEn: "Hazi Hinam",
    color: "#e2001a",
    textColor: "#ffffff",
    homepageUrl: "https://shop.hazi-hinam.co.il/",
    homepageVerified: true,
    onlineShopping: true,
    integration: "homepage_handoff",
  },
  {
    id: "yohananof",
    nameHe: "יוחננוף",
    nameEn: "Yohananof",
    color: "#00843d",
    textColor: "#ffffff",
    homepageUrl: "https://yochananof.co.il/",
    homepageVerified: false,
    onlineShopping: true,
    integration: "homepage_handoff",
  },
  {
    id: "osher-ad",
    nameHe: "אושר עד",
    nameEn: "Osher Ad",
    color: "#f15a22",
    textColor: "#ffffff",
    homepageUrl: "https://osherad.co.il/",
    homepageVerified: false,
    onlineShopping: true,
    integration: "homepage_handoff",
  },
  {
    id: "keshet-teamim",
    nameHe: "קשת טעמים",
    nameEn: "Keshet Teamim",
    color: "#8e24aa",
    textColor: "#ffffff",
    homepageUrl: "https://www.keshet-teamim.co.il/",
    homepageVerified: false,
    onlineShopping: true,
    integration: "homepage_handoff",
  },
  {
    id: "tiv-taam",
    nameHe: "טיב טעם",
    nameEn: "Tiv Taam",
    color: "#c8102e",
    textColor: "#ffffff",
    homepageUrl: "https://www.tivtaam.co.il/",
    homepageVerified: false,
    onlineShopping: true,
    integration: "homepage_handoff",
  },
];

export const RETAILER_BY_ID: Record<string, Retailer> = Object.fromEntries(RETAILERS.map((r) => [r.id, r]));
