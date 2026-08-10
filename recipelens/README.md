# RecipeLens

Turn cooking videos, links, screenshots and pasted text into structured recipes you can
actually cook from — scaled to your servings, with a shopping list and a step-by-step
cooking mode.

Mobile-first React client, TypeScript API, SQLite, and a server-side AI service with a
swappable provider.

---

## Architecture

```
Browser (React + Vite + Tailwind)
        │  cookie session, JSON only
        ▼
Express API (TypeScript)
        │
        ├── SQLite (better-sqlite3, migrations, per-user authorization)
        │
        └── RecipeAIService ──▶ AIProvider ──▶ configured model
                                (OpenAICompatibleProvider)
```

* **The browser never sees the AI key.** It only talks to `/api/*`; the key is read from
  the server environment and used inside `OpenAICompatibleProvider`.
* **The AI never decides what is valid.** Its answer goes through JSON recovery → Zod
  schema validation → normalisation before anything is stored.
* **Nothing is invented.** Missing values stay `null` and are listed in `missingInfo`;
  amounts the model inferred are stored with `estimated: true` and badged in the UI.
* **Scaling is real.** Quantities are stored normalised against the recipe's servings and
  recomputed by shared code (`shared/src/scale.ts`) that both the API and the UI import,
  so 2 → 4 → 1 servings round-trips exactly.

### Layout

| Path | What lives there |
| --- | --- |
| `shared/src` | Units, quantity parsing, scaling, shopping-list merging, recipe schemas. Imported by both sides. |
| `server/src` | Express app, routes, repositories, migrations, AI service, source extraction. |
| `web/src` | React client: pages, components, API client, auth state. |
| `e2e/` | Browser end-to-end run of the whole journey (Playwright). |
| `scripts/` | `mock-ai-provider.mjs` — a local OpenAI-compatible stand-in used **only** by the e2e run. |

---

## Requirements

* Node.js 20+ (developed on 22)
* npm 10+

## Setup

```bash
cd recipelens
npm install
cp .env.example .env      # then fill in the values below
```

### Environment variables

Names only — never commit real values. See `.env.example` for the annotated version.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | no (4000) | API port |
| `NODE_ENV` | no | `development` / `test` / `production` |
| `WEB_ORIGIN` | no | Allowed browser origin(s), comma separated |
| `SESSION_SECRET` | **yes in production** | Signs session cookies (≥32 chars) |
| `SESSION_TTL_SECONDS` | no (7 days) | Session lifetime |
| `DATABASE_URL` | no | `file:./data/recipelens.db` or `:memory:` |
| `AI_PROVIDER` | no | Provider implementation (`openai-compatible`) |
| `AI_API_KEY` | for AI import | Provider key — server-side only |
| `AI_API_BASE_URL` | for AI import | e.g. `https://api.openai.com/v1` |
| `AI_MODEL` | for AI import | e.g. `gpt-4o-mini` |
| `AI_TIMEOUT_MS` | no (45000) | Per-request timeout |
| `AI_MAX_RETRIES` | no (2) | Retries for an invalid/failed AI answer |
| `MAX_UPLOAD_BYTES` | no (10 MB) | Cap on request bodies and screenshots |

Missing `SESSION_SECRET` in production stops the server with a clear message.
Missing AI credentials do **not** stop the server: AI import answers `503 AI_NOT_CONFIGURED`
with the reason, while structured-data imports and manual recipes keep working.

---

## How to run

### Development (two processes, hot reload)

```bash
cd recipelens
npm run dev          # API on :4000, client on :5173 (proxies /api)
```

Open http://localhost:5173.

### Production (one process)

```bash
cd recipelens
npm run build        # builds the client into web/dist
NODE_ENV=production SESSION_SECRET=<48-random-chars> npm start
```

Open http://localhost:4000 — the API serves the built client and its own routes.

### Quality gates

```bash
npm run typecheck    # tsc --noEmit, server + web
npm run lint         # eslint, flat config
npm run test         # vitest: server (94) + web (16)
npm run build        # production client build
npm run verify       # all of the above, in order
npm run e2e          # Chromium journey against the real stack (needs `npm run build` first)
```

---

## What the import pipeline actually does

1. **Link** — fetches the page through an SSRF-guarded client (scheme, resolved IP and
   every redirect hop are checked; response is size-capped and time-boxed).
   * If the page publishes `schema.org/Recipe` JSON-LD, the recipe is parsed directly and
     **no AI call is made**.
   * Otherwise title/description/OpenGraph/oEmbed/visible text go to the AI.
2. **Pasted text** — used as-is.
3. **Screenshot** — validated data URLs (PNG/JPEG/WebP, size-capped) sent to a vision model.
4. **Video** — file metadata plus captions/transcript/frames. This server has no
   speech-to-text provider, so a video with no caption, transcript or frame is refused with
   `INSUFFICIENT_SOURCE_DATA` and fallback suggestions rather than a fabricated recipe.

Every analysis is recorded in `ai_analyses` (provider, model, attempts, duration, status).
Re-importing the identical source within 24 h reuses the stored analysis, and two
simultaneous identical imports share a single provider call.

---

## Testing

* `server/tests` — units and scaling, shopping-list merging, JSON recovery, the AI service
  (valid, malformed, schema-invalid, timeout, auth failure, de-duplication), the provider
  over a real HTTP round trip, auth and session handling, recipe CRUD and authorization,
  import (structured-data path, AI path, SSRF, unreachable/blocked sources, uploads),
  shopping list, cooking progress, and the full API journey.
* `web/src/test` — servings scaling in the UI, AI-estimate badges, cooking-mode resume,
  form validation, empty states.
* `e2e/journey.mjs` — Chromium against the real server and the real production build.

---

## Security notes

* Passwords: scrypt with a per-user salt; login answers identically for unknown accounts.
* Sessions: HMAC-signed token in an `HttpOnly`, `SameSite=Lax` cookie, `Secure` in
  production, with a per-user token version so "sign out everywhere" invalidates them.
* Authorization is enforced in SQL on every read and write — a recipe belonging to another
  account answers `403`, one that does not exist answers `404`.
* Optimistic concurrency: editing a recipe with a stale `version` answers `409` instead of
  overwriting somebody else's change.
* Cross-site state changes are rejected; the API sends `default-src 'none'` and the client
  a `self`-scoped CSP.
* Errors return a code and a human message — never a stack trace, never provider text.
