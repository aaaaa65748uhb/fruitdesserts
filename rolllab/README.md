# ROLL LAB — 3D cinnamon roll builder

An interactive ordering website where customers build their own cinnamon roll on a
photoreal 3D bakery counter: pick the dough, pour sauces from squeeze bottles,
sprinkle toppings from steel trays, add a filling, box it, and order.

Everything on the counter is real-time 3D (React Three Fiber / Three.js). There are
no product photos and no pre-rendered video — the roll, sauces, toppings, bottles,
trays and box are all generated in code, so there are no image files to license.

---

## Quick start (no coding needed)

You need [Node.js](https://nodejs.org) 20 or newer installed once.

```bash
cd rolllab
npm install      # first time only — downloads the libraries
npm run dev      # starts the site at http://localhost:5173
```

Open the address it prints in Chrome, Safari, Edge or Firefox.

Other commands:

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `npm run build`     | Makes the finished website in the `dist/` folder                 |
| `npm run preview`   | Serves the finished `dist/` site locally to double-check it      |
| `npm test`          | Runs the automatic checks (prices, validation, 3D geometry)      |
| `npm run typecheck` | Checks the code for type errors                                  |

### Put it online

Run `npm run build`, then upload the **`dist/`** folder to any static host:

- **Netlify Drop** — drag the `dist` folder onto <https://app.netlify.com/drop>. Done.
- **Vercel / Cloudflare Pages / GitHub Pages** — point them at this folder with build
  command `npm run build` and output folder `dist`.

The build uses relative paths, so it also works from a sub-folder.

---

## How customers use it

1. **Intro** — "BUILD YOUR DREAM ROLL" → **Start creating**. The box lid opens and a roll drops in.
2. **Counter** (main screen)
   - **Dough**: pick one of five bases in the bottom bar (price shown on each).
   - **Sauces**: click (or drag) a squeeze bottle to pick it up, move it over the roll,
     then **press and hold** to pour. Choose a pattern — *Drizzle* (follow your
     finger/mouse), *Zigzag*, *Swirl* (follows the dough spiral) or *Glaze* (a pool that
     spreads and runs over the edge) — and a flow (*Thin / Medium / Thick*). Holding still
     makes the sauce pool and thicken; sauce near the edge drips down the side.
   - **Toppings**: click a tray to take a scoop, then press and hold over the roll to
     sprinkle real 3D pieces. *Pinch / Handful* controls how much falls per shake,
     *Scatter evenly* covers the whole roll, *Less* removes some.
   - **Fillings**: click a ramekin (or drag the piping bag onto the roll) — the swirl
     between the layers changes colour.
   - **Extras**: click the objects at the front right (served warm → steam, birthday
     candle, extra sauce cup, gift ribbon & sticker).
   - Drag the roll to spin it; the **orbit** button (top right) lets you inspect it in 3D.
   - **Undo**, **Reset**, the live **total** and a tap-to-open **receipt** with the full
     price breakdown (and −/+/× controls) are in the bottom bar.
   - Press **Esc**, right-click, or **Put back** to return what you're holding.
3. **Review** — see the finished roll turning, name it, check every line and price,
   then **Box it**: the lid closes, a "MADE BY YOU" seal (and ribbon, if chosen) is
   applied, the box slides into the cart and a fresh box arrives.
4. **Cart** — multiple rolls, quantities, edit (re-opens the roll on the counter), remove.
5. **Checkout** — name, phone, pickup or delivery (address required for delivery),
   pickup time, notes, all validated.

Sounds are synthesized in the browser (no audio files) and can be muted with the
speaker button. The cart and the roll in progress survive a page refresh.

---

## Changing products and prices

Everything the shop sells is in **`src/config/catalog.ts`**. Edit a number, save, and
the 3D labels, receipt, cart and checkout all update — nothing else is hard-coded.

```ts
{ id: 'classic', name: 'Classic Cinnamon', price: 18, ... }   // dough
{ id: 'lotus', name: 'Lotus Biscoff', price: 4, extraCharge: 2, ... }  // sauce
```

In the same file:

- `limits` — max sauces (4), toppings (5), fillings (1) and extras per roll.
- `pricing.sauceExtraThreshold` / `toppingExtraThreshold` — after how many portions an
  item's `extraCharge` is added (shown as a separate "Extra …" line).
- each topping's `portion` (pieces in a regular portion) and `maxPieces`.
- `fulfillment` — delivery fee (₪15), free-delivery threshold (₪120), pickup address
  and pickup time slots.
- colours of each dough, sauce, topping and filling (used to paint the 3D models).

Brand name, palette and the optional WhatsApp order number are in **`src/config/brand.ts`**.

---

## Payments — what's connected and how to connect a real provider

**No payment provider is connected**, and the site never pretends otherwise. When a
customer presses *Continue* at checkout they see a clearly labelled
**"Checkout integration placeholder"** screen stating that *the order has not been
placed and no payment was taken*, with buttons to copy or download the order details.

Optional stop-gap: set `VITE_ORDER_WHATSAPP=972501234567` (your number, digits only)
when building, and a **Send via WhatsApp** button appears that sends the full order
text to the bakery.

### Connecting a real provider

Card payments need a small server, because secret API keys must never be in the
website. The site already speaks to such a server through one endpoint:

1. Deploy a function that accepts `POST` with the order JSON and returns
   `{ "url": "<hosted payment page>" }`. A ready example for **Stripe Checkout** is in
   [`server-examples/stripe-checkout.mjs`](server-examples/stripe-checkout.mjs).
   The same shape works for Israeli providers (PayPlus, Tranzila, Grow/Meshulam,
   Cardcom) — they all offer a "create payment page" API that returns a URL.
2. Build the site with `VITE_CHECKOUT_ENDPOINT=https://your-domain/api/checkout`.

The checkout button then reads **Pay ₪…** and redirects to the provider. Each order
line includes the full roll design, so the server **re-calculates the price with the
same pricing engine** instead of trusting the browser (the example does this).

---

## How it's built (for developers)

React 19 · TypeScript · Vite · React Three Fiber 9 · Drei · Three.js · Zustand ·
three-mesh-bvh · @react-three/postprocessing (ambient occlusion + ACES tone mapping).

```
src/
  config/catalog.ts        product + price catalog (single source of truth)
  config/brand.ts          brand + order channel settings
  types.ts                 all TypeScript types
  engine/
    pricing.ts             PricingEngine: computeQuote, computeCartTotals (+ tests)
    customization.ts       CustomizationEngine: limits, amounts, summaries
  store/
    builderStore.ts        current roll + undo history (persisted)
    cartStore.ts           cart + checkout form (persisted)
    uiStore.ts             screens, lid, pack choreography, toasts, mute
    toolStore.ts           what's in the customer's hand, patterns, flow
  three/
    MainWorkspace.tsx      canvas, lighting, environment, post-processing, quality tiers
    layout.ts              counter layouts (wide desktop / tall phone)
    CameraRig.tsx          auto-fits the counter to any screen; intro/review/inspect poses
    Countertop.tsx         oak butcher-block counter, tiled wall, lights
    rollGeometry.ts        procedural cinnamon roll (spiral-swept dough sheet)
    CinnamonRoll3D.tsx     the roll mesh + animated dough/filling colours
    surface.ts             height map of the roll + sauce build-up layer (BVH raycasts)
    sauceGeometry.ts       drizzle tubes, glaze pools, drips
    SauceLayer.tsx         committed + live sauce strokes
    SauceBottle3D.tsx      squeeze bottles + caddies
    IngredientTray.tsx     steel trays heaped with instanced pieces
    toppingGeometries.ts   10 procedural topping shapes
    Topping3D.tsx          instanced toppings on the roll (with falling animation)
    FillingRamekin.tsx     filling ramekins + extras station
    Packaging3D.tsx        tuck-top box, liner, seal sticker, ribbon, pack/ship motion
    RollAssembly.tsx       roll group: spin, drop-in, candle, steam, sauce cup
    HeldTool.tsx           bottle / scoop / piping bag in hand + the sauce stream
    interaction.ts         InteractionEngine: pick up, pour, sprinkle, spin, put back
    InteractionController.tsx  pointer/keyboard wiring + tooltip tracking
    textures.ts            all canvas-painted textures and printed labels
  ui/                      intro, dock & tool controls, receipt, review, cart, checkout
  checkout/                order payload + payment provider integration point
  lib/                     audio (Web Audio), noise, formatting, validation (+ tests)
server-examples/           Stripe Checkout serverless example
```

**Quality tiers.** Desktops get ambient occlusion, 2K soft shadows and MSAA; phones,
tablets and low-core devices get a lighter path. A performance monitor drops to the
lighter path automatically if the frame rate falls. Force a tier with `?quality=low`
or `?quality=high`.

### Honest notes / limitations

- Sauce is a convincing real-time approximation (surface-hugging glossy tubes,
  pooling, glaze pools and drips that run down the side), not a fluid simulation.
- The ambient-occlusion pass runs at full resolution: its half-resolution mode is not
  compatible with the current Three.js release.
- The reference screenshot mentioned in the brief wasn't available to us, so the counter
  composition follows the written description (angled top-down counter, central open box,
  trays left/right, bottles at the back, controls at the bottom).
- Automated checks: `npm test` covers pricing, cart totals, checkout validation and the
  3D geometry (roll shape, surface orientation, sauce mesh orientation in every pour
  direction). The full flow (pour, zigzag, sprinkle, filling, extras, dough swap, undo,
  reset, receipt, review, box it, cart quantities, checkout validation, payment
  placeholder, touch on phones) was driven end-to-end in headless Chromium.
