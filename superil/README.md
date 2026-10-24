# SUPERIL – הסופרמרקט הישראלי בתלת־ממד

Walk through a 3D Israeli supermarket in the browser, pick products off the shelves, compare prices
between chains, and continue to the chain's official website to buy.

## Run it (no coding needed)

You need [Node.js 20+](https://nodejs.org). In a terminal, inside this `superil` folder:

```bash
npm install
npm run build
npm start
```

Open http://localhost:3000. For development with live reload, use `npm run dev`.

## What works today

- **3D supermarket**: 8 aisles, end caps, dairy and cold-drink fridges, bakery, produce, checkouts, and a cart corral.
- **Controls**: WASD, mouse look and collision on desktop; joystick and drag-to-look on phones.
- **Picking products**: **E** or a click adds an item to the cart; **Q** opens price details; **F** opens search.
- **Product catalog**: 156 well-known Israeli products. They are marked as a demo catalog, have no invented barcodes, and use illustrated packaging.
- **Shared cart**: the same cart in 3D and in the regular pages. It is saved in the browser and kept in sync across tabs.
- **Search**: handles Hebrew spelling variations, brands, categories and barcodes.
- **Price comparison**: compare one product or the whole basket, including a split basket across chains. Every price shows its data status.
- **Checkout handoff**: an interactive checklist, copy / download / WhatsApp, and a button to the chain's official site.
- **Data sources page**: `/data-sources` shows which data sources are connected and their status.

## Prices: sample data until official files are imported

Until an official price file is imported, every price is labelled **נתון לדוגמה** (sample data), and a banner
on each page says so. Real prices come from the files that chains publish under Israel's price-transparency
law. You download them manually and import them with a preview step first:

```bash
npm run prices -- preview data/price-feeds/<PriceFull file> --retailer shufersal
npm run prices -- import  data/price-feeds/<PriceFull file> --retailer shufersal
```

Or set `ADMIN_TOKEN` and use the admin page at `/admin/prices` (upload → preview → import → matching report).
After the first import, sample prices switch off automatically. See `docs/INTEGRATIONS.md` for the full guide.

## Optional: PostgreSQL

```bash
cp .env.example .env        # set DATABASE_URL
npm run db:push && npm run db:seed
```

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Branding is configurable with `NEXT_PUBLIC_BRAND_NAME`.
