# SUPERIL – Price data, integrations & import guide

_Last updated October 2026._

> **Status:** The official price-file import pipeline is implemented and tested against fixtures built from the
> published file structures. **No real retailer file has been imported in this repository yet**, so the app
> still shows sample prices (labelled "נתון לדוגמה") until an operator imports a real file as described below.
> Do not describe the site as showing real prices until that has been done and checked (section 6).
>
> Setup, deployment and operations: see [SETUP.md](SETUP.md), [DEPLOYMENT.md](DEPLOYMENT.md) and
> [OPERATIONS.md](OPERATIONS.md). Admin pages: `/admin/status` (launch readiness) and `/admin/prices`
> (import + matching review).

## 1. Data sources: findings and decisions

| Source | Finding | What SUPERIL does |
|---|---|---|
| **Official price-transparency files** (חוק קידום התחרות בענף המזון, תשע"ד-2014; תקנות קידום התחרות בענף המזון (שקיפות מחירים), תשע"ה-2014) | Large chains must publish, per branch, full price files (`PriceFull`), price updates (`Price`), full promotion files (`PromoFull`), promotion updates (`Promo`) and a branch list (`Stores`). The files are XML, usually gzip-compressed. Schemas and encodings vary between chains. Some publication portals block access from outside Israel. | **Implemented**: validated import (CLI + admin web UI), matching, freshness and promotions. Files are obtained **manually** by the operator from the official portals (section 4). SUPERIL never downloads them itself. |
| **CHP (chp.co.il)** | No public API; its terms do not permit reusing its database. | `ChpAdapter` stays **disabled** until written authorization exists. It never scrapes. |
| **Retailer online stores** | No official cart-transfer API, documented deep links or affiliate program was found. | Checkout is an honest handoff: a checklist plus the official site, where the retailer handles payment. |
| **Product images** | Open Food Facts, a collaborative open database, licensed CC BY-SA 3.0. Photos come from its public AWS data exports. | 105 products show their real front photo, with credit on each product page and in `public/products/CREDITS.txt`. Loose produce is drawn as 3D models. Household goods have no licensed source, so they show a generated illustration marked "איור". See `scripts/product-photos/README.md`. |

## 2. Supported formats

| What | Supported |
|---|---|
| Containers | plain `.xml`; `.gz` (gzip); `.zip` archives, including `.gz` files inside a ZIP. Non-XML archive entries are reported, not ignored. |
| Encodings | UTF-8 (with or without BOM), UTF-16 LE/BE, windows-1255 / ISO-8859-8 (detected from the XML prolog). |
| File types | `PriceFull`, `Price`, `PromoFull`, `Promo`, `Stores` (also detected from content when the file name is non-standard). |
| Schema variants | `Root/Items/Item`, `root/…`, `Prices/Products/Product`, `ItemName` / `ItemNm`, SAP `asx:abap/…/STORES/STORE` (upper case), namespaces, any letter case. Records are located by their fields, not by a fixed path. |
| Fields read: prices | `ChainId`, `SubChainId`, `StoreId` (header), `ItemCode`, `ItemType`, `ItemName`/`ItemNm`, `ManufacturerName`, `Quantity`, `UnitQty`/`UnitOfMeasure`, `bIsWeighted`, `ItemPrice`, `UnitOfMeasurePrice`, `PriceUpdateDate`. |
| Fields read: promotions | `PromotionId`, `PromotionDescription`, `PromotionUpdateDate`, `PromotionStartDate/Hour`, `PromotionEndDate/Hour`, `MinQty`, `MaxQty`, `DiscountedPrice`, `DiscountedPricePerMida`, `ClubId` (anywhere inside the promotion), `AdditionalIsCoupon`, and items (`ItemCode`, `ItemType`, `IsGiftItem`). |
| Fields read: stores | `StoreId`, `SubChainId`, `ChainId`, `StoreName`, `Address`, `City`, `ZipCode`, `StoreType`, `LastUpdateDate/Time`. |
| File names | `<Type><13-digit chain code>-[subchain-]<store>-<YYYYMMDDHHmm>` and the variant with a separate `YYYYMMDD-HHmmss` timestamp. The publication time is read in Israel local time. |

## 3. Validation, identifiers and matching rules

**Validation.** Each problem is reported with the record number, the item code and a reason. Nothing is
dropped silently.

- **Rejected records (errors):** missing `ItemCode`, missing name, missing or non-numeric price, price ≤ 0,
  price above ₪20,000, and missing or unrecognised package size (no unit price is possible).
- **Duplicates in one file:** if both rows have the same price, one is kept (warning). If the prices differ,
  it is a conflict and neither row is imported (error).
- **Warnings (record kept):** invalid barcode check digit (the code is treated as a retailer-internal code),
  invalid `PriceUpdateDate`, a publication time inferred from the records, and a stale file.
- **Blockers (the whole file entry is refused):**
  - invalid XML;
  - an unknown file type;
  - no branch (`StoreId`);
  - a retailer that cannot be established;
  - a chain code that contradicts the file name or a previously confirmed chain;
  - no publication time;
  - a publication time in the future.
- **Missing values are never invented.** A missing manufacturer stays empty, and "לא ידוע" is treated as empty.

**Identifiers.**

- A valid GTIN-8/12/13/14 is normalised to a canonical form, so the UPC-A `012345678905` and the EAN-13
  `0012345678905` are the same product.
- `ItemType=0` and codes with an invalid check digit are **retailer-internal codes**, keyed as
  `i:<retailer>:<code>`. They are never matched across chains.
- Store ids are compared without leading zeros (`001` = `1`).

**Matching.**

1. The same canonical GTIN from different chains or branches is the same product.
2. A curated catalog product (the 156 products on the 3D shelves) is linked to file records **only** through
   a reviewed identifier. The identifier is a GTIN, or `i:<retailer>:<code>` for internal codes such as
   produce. Approvals and rejections made in the admin page or CLI are stored in the repository (the database
   in production). `data/barcode-map.json` can additionally hold links reviewed in git; a stored decision
   overrides the file for the same pair.
3. Package sizes must be equal: same measurement basis, and the same total amount within 0.5%. Records with a
   different size are never attached to a product, and are listed as **size conflicts**. Mapping a catalog
   product to a barcode whose observed size differs is refused.
4. Name similarity only produces **suggestions** for review. They are never applied automatically.
5. Unmatched records stay available as their own products (search, product pages, cart, comparison) and are
   listed in the matching report.

## 4. Freshness, provenance and promotions

**Provenance.** Every imported entry records:

- the source file name and SHA-256 hash;
- the retailer and chain code;
- the branch;
- the publication time and how it was established (`file_name`, `latest_record_timestamp` or `operator`);
- the import time and who imported it (CLI or admin web);
- provenance `official-price-transparency-file`.

Each stored price additionally keeps its `PriceUpdateDate`, shown as "המחיר שונה לאחרונה".

**Freshness** is based on when the **file** was published, not on `PriceUpdateDate`, which can be months old
for a price that hasn't changed:

| Label | Rule (configurable) | In basket totals |
|---|---|---|
| מחיר מאומת | file published ≤ `PRICE_VERIFIED_MAX_AGE_HOURS` (36) ago and validated | yes |
| מחיר שמור | ≤ `PRICE_STALE_AFTER_DAYS` (7) | yes |
| מחיר לא עדכני | older | **no** – shown with its date only |
| נתון לדוגמה | built-in demo data | sample-only comparisons; never ranked against real prices |
| מחיר לא זמין | no price | no |

With `SAMPLE_PRICES=auto` (the default), **sample prices are switched off automatically** once any official
price file has been imported. A banner on every page says when the site is showing sample or mixed data.

**Promotions** are shown on product pages with their status: "בתוקף לפי קובץ המבצעים" only when the start and
end dates parse and now is between them; otherwise "טרם התחיל", "הסתיים" or "תאריכים לא אומתו". Club or coupon
restrictions are shown. The files don't state unambiguously whether `DiscountedPrice` is per unit or per
bundle, so **promotions are never applied to totals**.

**Branches.** Prices are per branch. A basket is priced at a single branch per retailer (the best-covered,
then the cheapest one), and branches are never mixed. Branch names and cities appear only after a `Stores`
file has been imported. Otherwise the UI shows "סניף N (פרטי הסניף לא יובאו)". Numeric city codes are not
shown as city names.

**Repeated imports are safe.**

- The same file (hash + entry name) is detected as already imported.
- `--force` re-applies the file idempotently.
- A `PriceFull` older than (or as old as) the stored full file is skipped.
- `Price` update files change only the records they contain, and only when they are newer.
- A newer `PriceFull` removes items that are no longer listed, but keeps update records published after it.

## 5. Setup

```bash
cd superil
npm install
cp .env.example .env.local    # then edit the values below
```

| Variable | Purpose |
|---|---|
| `ADMIN_TOKEN` | Enables `/admin/prices`. At least 24 random characters (`openssl rand -hex 32`). Unset = admin disabled (404). |
| `DATABASE_URL` | PostgreSQL; **required in production**. Run `npm run db:migrate` (or `npm run start:prod`, which migrates on start). Unset = JSON store (development). |
| `PRICE_DATA_DIR` | JSON store folder (default `data/imported`, git-ignored). |
| `BARCODE_MAP_FILE` | Reviewed catalog ↔ barcode links (default `data/barcode-map.json`; commit it). |
| `PRICE_VERIFIED_MAX_AGE_HOURS`, `PRICE_STALE_AFTER_DAYS` | Freshness windows (36 h / 7 days). |
| `SAMPLE_PRICES` | `auto` / `on` / `off`. |
| `ADMIN_MAX_UPLOAD_MB` | Upload limit for the admin UI (default 100). |

**Admin security.**

- Login exchanges the token for a signed, httpOnly, `SameSite=Strict` session cookie (8 h).
- Admin APIs require that session and a same-origin request.
- Login is rate-limited.
- Admin pages are `noindex` and are not linked from the public site.
- Run behind HTTPS in production (the cookie is `Secure` when `NODE_ENV=production`).

## 6. Step by step: importing a real retailer price file

1. **Find the chain's official publication portal.** The Consumer Protection and Fair Trade Authority lists
   the chains and their price-publication pages at
   <https://www.gov.il/he/departments/legalInfo/cpfta_prices_regulations>. Use only the links given there or on
   the retailer's own site. Read the portal's terms before downloading. Some portals require their published
   public login, and some are reachable only from Israeli IP addresses. **Do not bypass access restrictions,
   and do not use unofficial endpoints.**
2. **Download manually** (browser), for the branch you want:
   - the latest `Stores…` file (branch names);
   - the latest `PriceFull…` file;
   - optionally `PromoFull…`;
   - later, hourly `Price…` / `Promo…` updates.

   Keep the original file names, because they carry the publication time. Store them in
   `data/price-feeds/` (git-ignored).
3. **Preview** (writes nothing):

   ```bash
   npm run prices -- preview data/price-feeds/Stores<chain>-<date>.xml --retailer shufersal
   npm run prices -- preview data/price-feeds/PriceFull<chain>-<store>-<date>.gz --retailer shufersal
   ```

   Check:
   - the detected chain code, branch and publication time;
   - the record and error counts;
   - the listed issues;
   - the matching summary.

   Or use `/admin/prices`: log in → choose the file and retailer → **תצוגה מקדימה**.
4. **Import:** run the same command with `import` (or press **ייבוא** in the admin UI). Import the Stores file
   first, then PriceFull, then PromoFull. A ZIP containing all three is fine. The first confirmed import
   remembers the chain code, so later files of that chain don't need `--retailer`.
5. **Review matching:**
   - `npm run prices -- report` (or the **דוח התאמות** tab).
   - Check each suggestion against the real package before linking it:
     `npm run prices -- map bamba-80 <verified GTIN>`. Size mismatches are refused.
   - Commit `data/barcode-map.json`.
6. **Verify in the site.** Open a product page and check:
   - the "מחיר מאומת" badge;
   - the branch name;
   - "קובץ המחירים פורסם …";
   - "המחיר שונה לאחרונה …".

   Compare 3–5 prices by hand with the retailer's site or shelf. Only then describe the site as showing real
   prices, and only for the imported branches.
7. **Keep it fresh:** import new `Price`/`PriceFull` files regularly. After 36 h prices show "מחיר שמור", and
   after 7 days "מחיר לא עדכני" (excluded from totals).

**CLI reference**

```bash
npm run prices -- preview <file> [--retailer <id>] [--published-at <ISO time>] [--json]
npm run prices -- import  <file...> [--retailer <id>] [--published-at <ISO time>] [--force] [--json]
npm run prices -- imports                  # history
npm run prices -- report [--json]          # matched / unmatched / duplicates / conflicts / suggestions
npm run prices -- map    <productId> <GTIN | i:<retailer>:<code>>   # approve a link
npm run prices -- reject <productId> <identifier>                   # dismiss a suggestion
npm run prices -- unmap  <productId> [<identifier>]
npm run prices -- uploads                                           # archived original files
npm run prices -- export-upload <sha256> <out-file>
```

Retailer ids: `shufersal`, `rami-levy`, `victory`, `carrefour`, `hazi-hinam`, `yohananof`, `osher-ad`,
`keshet-teamim`, `tiv-taam`. The exit code is 2 when an entry is blocked (useful in scripts). `--published-at`
is used only when neither the file name nor the records give a time.

## 7. Architecture

```
src/server/ingest/      decode.ts (gz/zip/encodings) · filename.ts · records.ts (extraction + validation) · analyze.ts
src/server/prices/      service.ts (preview/commit/report/mapping) · merge.ts (idempotent snapshots) · matching.ts
                        json-repo.ts / prisma-repo.ts (same PriceRepository interface) · config.ts
src/server/providers/   official-source.ts (offers, products, branches for the app) · index.ts (sample gating)
src/server/admin-auth.ts, src/app/api/admin/*, src/app/admin/prices
scripts/prices.ts       CLI
prisma/schema.prisma    ImportBatch, OfficialPrice, BranchPriceState, OfficialPromotion, FeedProduct, ChainMapping, Branch
```

Test fixtures in `tests/fixtures/official/` follow the published structures, with **synthetic** values.

## 8. Known limitations

- Not yet validated against a real downloaded file. Schema variants seen in the wild may need parser tweaks.
  The preview report will show any problems.
- Original uploads are archived (database table `ImportFile`, or `data/imported/uploads/` without a database).
- No automated downloading by design. Scheduled imports can be added by running the CLI on files the operator
  fetches through permitted means.
- Promotions are informational only (see section 4).
- Products learned from files appear in search, product pages, cart and comparison. Only curated products
  (linked by barcode) are placed on the 3D shelves.
- Feed product names are taken from the first file that contained the barcode.
- The JSON store keeps every branch snapshot in memory. For many branches, use PostgreSQL.
- Price history isn't modelled yet (only the current snapshot and the price-change date).
- Retailer homepages marked `homepageVerified: false` still need confirmation.
