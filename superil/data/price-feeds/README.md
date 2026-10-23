# Price-transparency files

Put the `PriceFull*.xml` / `.gz` files you downloaded from a chain's official price-publication portal here
(this folder's contents are git-ignored), then run:

```bash
npm run import:feed -- --retailer shufersal --file data/price-feeds/<file name>
```

Retailer ids: shufersal, rami-levy, victory, carrefour, hazi-hinam, yohananof, osher-ad, keshet-teamim, tiv-taam.
