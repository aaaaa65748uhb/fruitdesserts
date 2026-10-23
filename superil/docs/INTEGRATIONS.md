# SUPERIL – Architecture & integration report

_Researched October 2026. The build container could reach only the npm registry, so the retailer and CHP
websites could not be opened directly from it; findings come from web search, the project brief and
public knowledge, and are flagged where unverified._

## 1. What exists in the repository

The repository root contains **FridgeTok**, an earlier Vite + React PWA (fridge inventory / recipes) with an
Android wrapper and a GitHub Pages workflow. It was left untouched. SUPERIL is a separate Next.js app in
`superil/`. The old app's product list has invented barcodes and prices, so none of it was reused as data.

## 2. Data sources – findings and decisions

| Source | Finding | What SUPERIL does |
|---|---|---|
| **CHP (chp.co.il)** | No public API found. Terms of use do not grant permission to reuse the database; the brief also forbids scraping it. | `ChpAdapter` exists but is **disabled**. It needs `CHP_AUTHORIZED=true` + API credentials from a signed agreement. Even then it does nothing until the agreed API contract is implemented. It never scrapes. |
| **Price-transparency files** (חוק קידום התחרות בענף המזון / תקנות שקיפות מחירים) | Large chains must publish full price files (`PriceFull`, `Price`, `Promo`, `Stores`) per branch. Price-comparison apps (e.g. Pricez) are built on them. Some portals are geo-blocked outside Israel. | **Implemented**: `price-feed-parser.ts` + `npm run import:feed`. The operator downloads files from the official portals. Offers are stored as **מחיר שמור** with the file's `PriceUpdateDate`, per branch. Prices older than 7 days are shown as **מחיר לא זמין**. |
| **Retailer online stores** (Shufersal, Rami Levy, Victory, Carrefour, Hazi Hinam, Yohananof, Osher Ad, Keshet Teamim, Tiv Taam) | No official public cart-transfer API, documented add-to-cart deep link, or affiliate program was found. Community tools for Rami Levy and Shufersal reuse session tokens or automate the browser – **not used**. | Checkout = **honest handoff**: matched and missing items, an interactive checklist, copy / download / WhatsApp, then the retailer's **official homepage** in a new tab. Retailer search-URL formats could not be verified, so none are invented. |
| **Product images** | No licensed image source was available in this build. | Generated placeholder packaging, clearly marked "איור". `Product.imageUrl/imageSource/imageLicense` are ready for licensed images. |

## 3. Data labelling rules (enforced in code)

- `live` (מחיר מעודכן) – only from an authorized live source. **None is connected today.** Downgraded to `cached` after 24 h.
- `cached` (מחיר שמור) – from an imported price file, with its timestamp.
- `sample` (נתון לדוגמה) – the built-in development offers (`SampleOfferSource`). Deterministic, about 1 in 9 pairs deliberately missing.
- `unavailable` (מחיר לא זמין) – no usable price.

Other rules:

- The basket comparison never calls a retailer "cheapest" unless its basket is complete.
- It never shows a final total unless the delivery fee is known; no delivery fees are verified, so none are shown.
- Promotions count only when `verified: true`.
- Client-supplied prices are never accepted. The compare and handoff endpoints take product ids and quantities only.

## 4. Architecture

```
src/
  app/                    Next.js App Router pages + API routes (Zod-validated, rate-limited)
  components/store3d/     React Three Fiber supermarket
    layout.ts             pure, tested layout: fixtures, shelf blocks, colliders, signs
    physics.ts            circle-vs-AABB collision with sub-stepping, ray picking
    textures.ts           canvas-generated label atlas, price-tag atlas, signs, floor
    Products.tsx          3 InstancedMeshes for all products (per-instance atlas UVs)
    Player.tsx            pointer lock, WASD, gravity, picking, pickup FX
    Hud.tsx               prompts, product panel, search, minimap, touch joystick
  client/                 Zustand stores (cart, settings, UI) + TanStack Query hooks
  lib/                    pure domain logic (search, units, compare, checkout, freshness)
  server/providers/       ProductProvider abstraction
    composite.ts          one product store + N offer sources, failures isolated
    local-store.ts        seed catalog (+ products found in imported feeds)
    sample-offers.ts      demo offers (labelled sample)
    feed-store.ts         imported price-transparency files
    prisma-store.ts       PostgreSQL catalog + offers (when DATABASE_URL is set)
    chp-adapter.ts        disabled until authorized
    http.ts               allow-listed, timeout-bound fetch for future external providers
prisma/schema.prisma      Product, Retailer, Branch, PriceOffer, Cart, CartLine
scripts/import-price-feed.ts
```

**Product matching.** Feed items match products by barcode only (confidence 1). The seed catalog has no
barcodes, because we don't invent GTINs. To attach real feed prices to a curated seed product, an operator
adds a reviewed mapping to `data/barcode-map.json`:

```json
{ "bamba-80": "<verified GTIN>" }
```

Feed items without a mapping become their own products (category "שונות"). Package sizes are never merged:
different sizes are different products, compared only by normalized unit price.

## 5. What is needed to complete the blocked integrations

1. **Real prices:** download `PriceFull` files from the chains' official portals (an Israeli IP may be
   required) and run `npm run import:feed`. A scheduled job can automate this; the open-source
   `il-supermarket-scraper` project documents the portal locations. Review each portal's terms first.
2. **Branches:** add a `Stores` XML parser (same portals) to fill `Branch` with city and address.
3. **CHP:** obtain written permission and an API specification, then implement `ChpAdapter.offersFor`.
4. **Direct cart transfer:** requires a partner agreement with each chain. Set `integration: "official_api"`
   only after a tested, authorized implementation exists.
5. **Product images:** connect a licensed image source (e.g. manufacturer or retailer agreements) and fill
   `imageUrl`, `imageSource` and `imageLicense`.
6. **Retailer URLs:** confirm the homepages marked `homepageVerified: false`.
