# SUPERIL – Operations guide

Day-to-day running of a public SUPERIL: keeping prices fresh, reviewing matches, backups, and handling
problems.

## Routine

| When | What | Where |
|---|---|---|
| Daily (or at least every few days) | Download the newest `PriceFull` (and `PromoFull`) for each branch you cover and import them. Prices older than 36 h show "מחיר שמור"; after 7 days they show "מחיר לא עדכני" and drop out of basket totals. | `/admin/prices` or `npm run prices -- import` |
| After each import | Check the summary table for blocked files and red error counts. Review new barcode suggestions. | `/admin/prices` → "בדיקת התאמות ברקוד" |
| Weekly | Check `/admin/status`: no stale branches, latest import recent, storage connected. Spot-check a few prices on the chain's site. | `/admin/status` |
| When a chain adds or closes branches | Import its newest `Stores` file. | `/admin/prices` |
| Daily (automatic) | Database backup (see below). | your host / cron |

Prices are **not** updated automatically. If you stop importing, the site will honestly mark prices as stale.
It will never pretend they are current.

## Import order

1. **Stores** (branch names and cities).
2. **PriceFull** for each branch.
3. **PromoFull** (optional; promotions are informational only).
4. **Price / Promo** update files, if you use them.

The admin page shows the next step for the selected chain and warns when files arrive out of order.
Re-importing the same file is safe. An older file never overwrites newer data.

## Matching review

- **Suggestions** (yellow dashed cards, "הצעה – טרם אושרה") are never applied until you approve them.
- Approve only when the product name, maker and package size match the real product. When in doubt, reject.
  Rejected suggestions are not shown again.
- **Approved links** (green "מאושר") show who approved them and when, and how many official prices each one
  receives. You can remove a link at any time.
- Decisions are stored in the database. `data/barcode-map.json` in git can hold links reviewed by the team.
  A decision made in the admin page overrides the file for the same pair. Changes to the file take effect
  after a restart.

## Backups

Everything that matters is in PostgreSQL:

- prices;
- branches;
- import history and issues;
- matching decisions;
- the original uploaded files (table `ImportFile`, gzip-compressed).

```bash
# Nightly backup (cron example; keep 14 days)
0 3 * * *  pg_dump -Fc "$DATABASE_URL" -f /backups/superil-$(date +\%F).dump && find /backups -name 'superil-*.dump' -mtime +14 -delete
```

Copy backups off the server (object storage, another machine). With Docker Compose:

```bash
docker compose exec -T db pg_dump -Fc -U superil superil > superil-$(date +%F).dump
```

**Restore:**

```bash
createdb superil_restored
pg_restore --no-owner -d "postgresql://USER:PASS@HOST:5432/superil_restored" superil-YYYY-MM-DD.dump
# point DATABASE_URL at superil_restored and restart the app
```

Docker Compose restore into the running database (this replaces its data):

```bash
docker compose stop app
docker compose exec -T db sh -c 'dropdb -U superil superil && createdb -U superil superil'
docker compose exec -T db pg_restore --no-owner -U superil -d superil < superil-YYYY-MM-DD.dump
docker compose start app
```

**Original files:** `npm run prices -- uploads` lists them, and
`npm run prices -- export-upload <sha256> <file>` extracts one. Both work against a restored database too.

**Without a database** (development only): back up `data/imported/` and `data/barcode-map.json` with `tar`,
and restore by extracting while the server is stopped.

## Incidents

| Situation | Action |
|---|---|
| Admin token may have leaked | Set a new `ADMIN_TOKEN` and restart. All sessions become invalid immediately. |
| A wrong file was imported for a branch | Import the correct, newer `PriceFull` for that branch; it replaces the branch's whole assortment. |
| A file was imported under the wrong chain | Restore the last backup taken before that import. The chain code is then remembered for the correct chain on the next import. |
| Wrong barcode link approved | `/admin/prices` → approved links → **הסרה** (remove), or `npm run prices -- unmap <productId> <identifier>`. |
| `/api/health` returns 503 | Storage is unreachable. Check the database and `DATABASE_URL`. The public site shows an error page instead of stale data. |
| A chain's file is rejected | Read the issue table in the preview. "XML לא תקין", or a missing chain/branch/publication time, usually means the wrong file or a broken download. Download it again. |

## Public commitments (keep them true)

The site tells visitors:

- which chains and branches have official prices (the coverage notice);
- that prices are imported manually and not in real time;
- that checkout continues on the chain's own site, where prices may differ.

Keep these statements accurate. Don't announce coverage of a chain until its files are imported and
spot-checked.
