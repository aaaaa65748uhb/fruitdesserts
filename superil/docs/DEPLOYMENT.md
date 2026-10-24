# SUPERIL – Deployment guide

**Production rule:** imported prices, matching decisions and original uploads must live in **PostgreSQL**.
Most hosting platforms wipe the local disk on every redeploy. In production without `DATABASE_URL` (and
without an explicit `PRICE_DATA_DIR`), SUPERIL refuses imports instead of silently losing data. The readiness
page `/admin/status` shows whether storage is persistent.

## What was verified (October 2026)

| Check | Result |
|---|---|
| Clean clone → `npm ci` → `prisma migrate deploy` on an **empty** database → `npm run build` → `next start` | ✅ health, home, 3D store and product pages return 200; admin pages show a login; admin API returns 401 |
| Docker image build (`Dockerfile`) | ✅ builds (2.05 GB, full Debian Node 22 base). In the sandbox the build needed an extra proxy CA certificate, which is not part of the committed Dockerfile; a normal machine doesn't need it |
| `docker compose up` (app + PostgreSQL container, named volume) | ✅ migrations applied; import through the admin API; `docker compose down` + `up` → imported prices still served. Run with the image built above and `POSTGRES_IMAGE=mirror.gcr.io/library/postgres:16` because Docker Hub rate-limited the sandbox |
| Container start runs migrations on an empty database | ✅ |
| Import via the admin API, then **destroy and recreate the container** | ✅ prices, branch names, approved mapping and both archived originals still served from PostgreSQL |
| Production container **without** a database tries to import | ✅ refused (HTTP 503), startup log explains why |
| `pg_dump` → `pg_restore` into a new database | ✅ all prices, decisions, archived files and migration history restored; archived file byte-identical |
| Admin token in client JavaScript bundle / server logs | ✅ not present |

Not verified here (no access from the build sandbox): `docker compose up --build` building the image from
scratch on a normal machine, deploying to a specific cloud provider, and HTTPS certificates. Those steps are documented below but must be checked when you do them.

---

## Option A – Docker Compose on a VPS (recommended, tested)

Works on any Linux server with Docker (Hetzner, DigitalOcean, AWS Lightsail, a home server…).

```bash
git clone <repository URL> && cd fruitdesserts/superil
cp .env.example .env
# Edit .env and set at least:
#   ADMIN_TOKEN=<64 random hex chars>    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#   POSTGRES_PASSWORD=<another long random value>
docker compose up -d --build
docker compose logs -f app        # wait for "All migrations have been successfully applied" and "Ready"
curl http://localhost:3000/api/health
```

- PostgreSQL data lives in the named volume `pgdata`. It survives `docker compose down`, rebuilds and
  upgrades. **Never** run `docker compose down -v` in production; `-v` deletes the volume.
- If Docker Hub rate-limits you, add to `.env`: `NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm` and
  `POSTGRES_IMAGE=mirror.gcr.io/library/postgres:16`.
- **HTTPS:** put a reverse proxy in front. With [Caddy](https://caddyserver.com), the whole config is:

  ```
  superil.example.co.il {
      reverse_proxy localhost:3000
  }
  ```

  Caddy obtains certificates automatically. The admin session cookie is marked `Secure` in production, so
  admin login works only over HTTPS (or `localhost`).
- **Updating:** `git pull && docker compose up -d --build`. Migrations run automatically on start.

## Option B – Node.js platform + managed PostgreSQL

For Render, Railway, Fly.io, Heroku-style hosts, or a VPS with systemd.

| Setting | Value |
|---|---|
| Root directory | `superil` |
| Node version | 22 (`.nvmrc`; `engines` in package.json) |
| Build command | `npm ci && npm run build` |
| Start command | `npm run start:prod` (runs `prisma migrate deploy`, then `next start`) |
| Health check path | `/api/health` |
| Environment | `DATABASE_URL`, `ADMIN_TOKEN`, `NODE_ENV=production` (usually set by the platform) |

Create the managed PostgreSQL database first and paste its connection string into `DATABASE_URL`. If the
platform runs several instances, run `npm run db:migrate` once as a release/pre-deploy command instead of in
the start command.

### Vercel and other serverless hosts

The site works with `DATABASE_URL` set, but two limits apply:

- the filesystem is ephemeral, so the database is mandatory;
- request bodies are limited, about 4.5 MB on Vercel, while real `PriceFull` files are often larger.

On serverless hosts, **import from your own computer with the CLI against the production database**:

```bash
DATABASE_URL="<production connection string>" npm run prices -- import PriceFull….gz --retailer shufersal
```

The site picks up new data on the next request; no redeploy is needed.

---

## Option C – Static demo (Netlify Drop or any static host)

```bash
npm run build:static
```

This creates `netlify-drop/`, a plain folder you can drag onto <https://app.netlify.com/drop>. It contains the
3D store, catalog, search, product pages, cart, comparison and checkout handoff, all running in the visitor's
browser with **sample prices only** ("נתון לדוגמה").

The static demo has **no** admin area, price imports, official prices or database. Nothing secret is in it:
`.env` files and `data/imported/` are never copied. For real prices, use option A or B.

---

## Security checklist before going public

- [ ] `NODE_ENV=production`, served over **HTTPS**.
- [ ] `ADMIN_TOKEN` is ≥ 24 random characters (64 hex recommended), stored only in the host's secret settings.
- [ ] `DATABASE_URL` points to PostgreSQL with a strong password, not exposed to the internet beyond your host
      (or TLS enforced).
- [ ] `/admin/status` shows every configuration line green except "manual price check".
- [ ] Automated backups enabled (provider snapshots or a `pg_dump` schedule, see OPERATIONS.md).
- [ ] Admin pages are not linked anywhere public. They send `X-Robots-Tag: noindex` and `Cache-Control:
      no-store`, and `robots.txt` disallows them.
- [ ] Reviewed the public texts: the coverage notice names only the chains you actually imported.

Built-in protections:

- **Admin login:** the token is sent once in a POST body and never in URLs. It is rate-limited, compared in
  constant time and never logged.
- **Session:** an httpOnly, SameSite=Strict, HMAC-signed session cookie that lasts 8 hours.
- **Admin API:** requires the session plus a same-origin check.
- **Uploads:** size-limited, decompression capped at 512 MB, ZIP entry count limited.
- **Public API:** inputs are validated with Zod and rate-limited.

## After deploying – verification

1. `https://<your-domain>/api/health` → `{"status":"ok"}`.
2. Home page shows the yellow "sample data" banner (until you import).
3. `/store` loads the 3D store; walk, pick up a product; the cart updates; works on a phone.
4. `/admin/status` → log in → storage "PostgreSQL", connected.
5. Import Stores → PriceFull for one branch (SETUP.md step 8). The banner disappears, the coverage notice names
   that chain and branch, and product pages show "מחיר מאומת" with the branch and publication time.
6. Manually compare 3–5 prices with the chain's website.

## Known dependency advisories (checked October 2026)

`npm audit --omit=dev` reports advisories that need **major** upgrades. They are not applied in this
release:

| Package | Advisory | Exposure in SUPERIL | Fix |
|---|---|---|---|
| `postcss` (via `next`) | XSS in CSS stringify output; file read via `sourceMappingURL` | Only our own CSS is processed, at build time; no user-supplied CSS | Next.js 16 (major upgrade) |
| `deepmerge-ts` (via `prisma` / `@prisma/config`) | Stack exhaustion on recursive objects | Only the Prisma CLI's own config loading; no visitor input | Prisma 7 (major upgrade) |

The Zod advisory (memory exhaustion on oversized collections) was fixed by upgrading to Zod 4.6.7. Request
bodies are also capped at 100 KB before validation. Re-run `npm audit --omit=dev` before each release, and
plan the Next 16 / Prisma 7 upgrades as a separate, tested change.
