# SUPERIL – Setup guide (beginner friendly)

This guide takes you from an empty computer to a running SUPERIL with real prices. Each step says what to
type and what you should see. Commands go in a terminal: **Terminal** on Mac, **PowerShell** on Windows.

Related guides: [DEPLOYMENT.md](DEPLOYMENT.md) (putting it online) · [OPERATIONS.md](OPERATIONS.md) (daily use,
backups) · [INTEGRATIONS.md](INTEGRATIONS.md) (price-file details).

---

## 1. Install Node.js (version 22)

SUPERIL needs **Node.js 20.9 or newer; version 22 is recommended** (it is what the project is tested with).

- **Easiest:** download the "LTS" installer from <https://nodejs.org> and run it.
- **Or with nvm** (Mac/Linux): `nvm install 22 && nvm use 22`. The project contains a `.nvmrc` file, so
  `nvm use` inside the folder picks the right version.

Check it worked:

```bash
node -v     # should print v22.x.x (anything from v20.9 is OK)
npm -v
```

## 2. Get the code and install dependencies

```bash
git clone <your repository URL>
cd fruitdesserts/superil
npm ci
```

`npm ci` installs the exact versions in `package-lock.json`. It takes 1–2 minutes and ends without "ERR"
lines. Messages about `npm audit` are informational.

## 3. Run it on your computer (development mode)

```bash
npm run dev
```

Open <http://localhost:3000>. You should see the home page. **"כניסה לסופר"** opens the 3D store. A yellow
banner says the prices are sample data. That is correct until you import official files. Stop the server
with `Ctrl+C`.

Without any configuration, SUPERIL stores imported data as files in `data/imported/`. That is fine on your
own computer. For a public server, use PostgreSQL (step 6).

## 4. Configure environment variables

Settings live in a file called **`.env`** in the `superil` folder. The web server, the database tool (Prisma)
and the `npm run prices` command all read it. Git ignores it, so secrets are never committed. Create it from
the template:

```bash
cp .env.example .env        # Windows PowerShell: copy .env.example .env
```

Open `.env` in any text editor. The important values:

| Variable | Needed? | What it does |
|---|---|---|
| `ADMIN_TOKEN` | **Yes**, to import prices | Password for the admin pages. See step 5. |
| `DATABASE_URL` | **Yes for a public server** | PostgreSQL connection. Leave empty on your own computer to use files. |
| `SAMPLE_PRICES` | No (default `auto`) | Sample prices are shown only until the first official import. |
| `PRICE_VERIFIED_MAX_AGE_HOURS` / `PRICE_STALE_AFTER_DAYS` | No (36 / 7) | When prices count as "verified" and when they become "stale". |
| `PRICE_DATA_DIR` | Only without a database | Folder for file storage. In production it must be on a permanent disk. |
| `ADMIN_MAX_UPLOAD_MB` | No (100) | Maximum upload size in the admin page. |

Restart the server after changing `.env`.

## 5. Set a strong `ADMIN_TOKEN`

The admin pages (`/admin/status`, `/admin/prices`) are **switched off** until `ADMIN_TOKEN` is set to at
least 24 characters. Generate a random one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the 64-character output into `.env`:

```
ADMIN_TOKEN="paste-the-64-characters-here"
```

Rules:

- Keep it secret, like a password. Store it in a password manager.
- Never put it in a URL, a screenshot, a chat or a git commit.
- The site never shows it. You type it once on the login page, and it is exchanged for a session cookie that
  lasts 8 hours.
- To log everyone out (for example if the token leaked), change it and restart the server.

Test it: `npm run dev`, open <http://localhost:3000/admin/status>, and log in with the token.

## 6. PostgreSQL (needed for a public server)

PostgreSQL keeps imported prices, matching decisions and the original uploaded files safe across restarts and
redeploys. Choose one option:

- **Managed database (easiest for production):** create a PostgreSQL 14+ database at your hosting provider
  (Render, Railway, Neon, Supabase, DigitalOcean…) and copy its connection string.
- **Docker on your computer:**

  ```bash
  docker run -d --name superil-db -e POSTGRES_PASSWORD=change-me -e POSTGRES_DB=superil -p 5432:5432 -v superil-pg:/var/lib/postgresql/data postgres:16
  ```

- **Installed locally:** install PostgreSQL from <https://www.postgresql.org/download/> and create a database
  named `superil`.

Put the connection string in `.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/superil"
```

Create the tables (safe to run again; it applies only new migrations):

```bash
npm run db:migrate
```

You should see **"All migrations have been successfully applied."** No seeding is required: the product
catalog is built into the app.

## 7. Start the production server

```bash
npm run build          # takes about a minute; ends with a list of pages
npm run start:prod     # applies database migrations, then starts on port 3000
```

Use `npm start` instead of `start:prod` if you are not using a database. Check that it's healthy:

```bash
curl http://localhost:3000/api/health        # {"status":"ok"}
```

Then open `/admin/status`. The readiness page lists what is still missing before launch.

## 8. Import official price and branch files

Prices come from files the chains publish under Israel's price-transparency law. SUPERIL does **not**
download them automatically. You download them and upload them.

1. Open the list of chains and their publication pages:
   <https://www.gov.il/he/departments/legalInfo/cpfta_prices_regulations>. Pick a chain and open **its
   official** price page. Read its terms. Some pages work only from an Israeli internet connection; don't try
   to get around restrictions.
2. Download, keeping the original file names (they contain the date and branch):
   1. the newest **`Stores…`** file (the list of branches);
   2. the newest **`PriceFull…`** file for the branch you want;
   3. optionally the matching **`PromoFull…`** file.
3. Open `/admin/prices` and log in. The **"סדר הייבוא המומלץ"** box shows which step is next.
4. Choose the **Stores** file and the chain → **תצוגה מקדימה** (preview). Check the summary table:
   - the chain;
   - the publication time;
   - the record count;
   - "מוכן לייבוא" (ready to import).

   Then press **ייבוא** (import).
5. Repeat for **PriceFull**, then **PromoFull**.
6. Open the **בדיקת התאמות ברקוד** tab (barcode matching). Approve only suggestions where the name, maker and
   package size match the real product. Reject the rest.
7. Open `/admin/status`. It should now show:
   - verified prices;
   - your chain and branch;
   - a latest import time.

   Then compare 3–5 prices by hand against the chain's website before telling anyone the prices are real.

The same steps work from the command line: `npm run prices -- preview <file> --retailer shufersal`, then
`import`. Full details are in [INTEGRATIONS.md](INTEGRATIONS.md) section 6.

## 9. Back up and restore

**With PostgreSQL**, everything important is in the database:

- prices;
- branches;
- import history;
- matching decisions;
- original uploaded files.

```bash
# Back up (creates one file; keep copies somewhere else, e.g. cloud storage)
pg_dump -Fc "$DATABASE_URL" -f superil-$(date +%F).dump

# Restore into an empty database
createdb superil_restored
pg_restore --no-owner -d "postgresql://USER:PASSWORD@HOST:5432/superil_restored" superil-2026-10-24.dump
```

Then point `DATABASE_URL` at the restored database and restart. **Without a database**, back up the files:

```bash
tar czf superil-data-$(date +%F).tgz data/imported data/barcode-map.json
tar xzf superil-data-2026-10-24.tgz          # restore (stop the server first)
```

Original uploads can be listed and extracted any time: `npm run prices -- uploads` and
`npm run prices -- export-upload <sha256> <file>`. See [OPERATIONS.md](OPERATIONS.md) for a backup schedule.

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `/admin/...` shows "page not found" | `ADMIN_TOKEN` is missing or shorter than 24 characters. Restart after setting it. |
| Import says "אחסון לא קבוע" | Production server without `DATABASE_URL`. Configure PostgreSQL (step 6). |
| "Can't reach database server" | Check `DATABASE_URL`, that the database is running, and firewall rules. |
| Prices still say "נתון לדוגמה" | No official price file imported yet. See `/admin/status`. |
| Prices say "מחיר לא עדכני" | The last imported file is older than 7 days. Import a newer one. |
| Port 3000 is busy | `PORT=3001 npm start` |
