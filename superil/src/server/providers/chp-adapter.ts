import type { PriceOffer, ProviderStatus } from "@/lib/types";
import type { OfferSource } from "./types";

/**
 * CHP (chp.co.il) adapter — DISABLED.
 *
 * CHP's terms of use do not grant permission to scrape or reuse its database, and no public API is offered.
 * This adapter exists so an authorized integration can be plugged in later. It only activates when
 * CHP_AUTHORIZED=true AND an API base URL + key from a signed agreement are configured, and even then it
 * refuses to run until the agreed API contract is implemented in `fetchOffers` below.
 * It never scrapes HTML or calls undocumented endpoints.
 */
export class ChpAdapter implements OfferSource {
  readonly id = "chp";

  private get configured() {
    return process.env.CHP_AUTHORIZED === "true" && !!process.env.CHP_API_BASE_URL && !!process.env.CHP_API_KEY;
  }

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      name: "CHP – השוואת מחירים",
      kind: "prices",
      enabled: false,
      healthy: false,
      freshness: "unavailable",
      message: this.configured
        ? "הוגדרה הרשאה, אך חוזה ה-API המוסכם עדיין לא מומש. המתאם לא פעיל."
        : "לא פעיל: נדרשת הרשאה כתובה מ-CHP. איננו סורקים את האתר.",
    };
  }

  async offersFor(): Promise<PriceOffer[]> {
    return [];
  }
}
