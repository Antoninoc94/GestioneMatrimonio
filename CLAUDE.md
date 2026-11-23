# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GestioneMatrimonio — a self-hosted wedding planning app (Italian) for a couple to manage vendors, budget, guests, seating, timeline, gifts, travel, and a public RSVP/landing page for guests. Monorepo with an Express/SQLite server and a React/Vite client.

## Commands

Run from repo root unless noted.

```
npm run install:all   # installs server + client deps (no root deps beyond concurrently)
npm run dev            # runs server (port 3001) + client (Vite dev server) concurrently
npm run server          # server only: cd server && node index.js
npm run client          # client only: cd client && npm run dev
```

Client-only commands (`cd client`):
```
npm run dev       # Vite dev server, proxies /api and /uploads to http://localhost:3001
npm run build     # production build to client/dist
npm run preview   # preview the production build
npm run lint       # oxlint
```

Server-only (`cd server`):
```
npm start   # node index.js
npm run dev  # node --watch index.js
```

There is no test suite/framework configured in either package — do not assume Jest/Vitest exist.

Before first run, copy `.env.example` to `.env` and set `JWT_SECRET`. **Put it in `server/.env`, not the repo root** — `npm run server`/`npm run dev` run `cd server && node index.js`, and `dotenv.config()` in `server/index.js` resolves `.env` relative to the process CWD, which is `server/`. A root-level `.env` is silently ignored. `server/index.js` now refuses to boot without `JWT_SECRET` and prints where to set it; before that guard, the server started fine and every login failed with a misleading "credenziali non valide", masking a 500 from `jsonwebtoken` (`secretOrPrivateKey must have a value`). In Docker/production `JWT_SECRET` comes from `docker-compose.yml`'s `environment:` and dotenv doesn't override already-set env vars.

**Deployment env vars**, read by `docker-compose.yml` from the `.env` beside it: `APP_PORT` is the published host port (default 80; a deployment behind a reverse proxy sets 3001), `TRUST_PROXY` the number of proxies in front of the app (see the public-surface section). Both exist so a deployment never edits the tracked `docker-compose.yml` — local edits to it conflicted on every `git pull`.

## Architecture

**No ORM, no service layer.** `server/db.js` opens a single `better-sqlite3` database and each `server/routes/*.js` file runs prepared SQL statements directly inline in its Express handlers. One route file per resource (e.g. `fornitori.js`, `ospiti.js`, `tavoli.js`), mounted 1:1 in `server/index.js` under `/api/<resource>`. When adding a feature, follow this pattern rather than introducing new abstractions.

**Schema lives entirely in `server/db.js`**, not in a migrations tool: `CREATE TABLE IF NOT EXISTS` for the base schema, followed by manual `ALTER TABLE ... ADD COLUMN` guarded by `PRAGMA table_info` checks for every column added after initial release. Any new column must follow this same guarded-`ALTER TABLE` pattern so existing deployed SQLite files upgrade in place on next boot. This file also seeds default config, a default checklist, and two default users (`sposo`/`sposo1`, `sposa`/`sposa1`) on first run.

**Auth**: JWT via `server/middleware/auth.js` (verifies `Authorization: Bearer` header, sets `req.user`). Client keeps the token/user in `localStorage` (`client/src/AuthContext.jsx`); the shared axios instance (`client/src/api.js`) attaches the header on every request and force-redirects to `/login` on any 401.

**Public vs. private surface**: most routers require `auth`, but a few are intentionally unauthenticated because they're used by wedding guests, not the couple:
- `/api/conferma` — public RSVP flow (find/confirm a guest by name; gated additionally by the `conferma_abilitata` flag in `config`)
- `/api/landing` and `/wedding` — public wedding info page
- `/api/config/public` — subset of `config` exposed for branding (app name/emoji/title), fetched by `AppConfigContext.jsx` on every load to set `document.title` and a dynamic emoji favicon

Guest-facing pages (`Conferma.jsx`, `Landing.jsx`) are routed outside the `PrivateRoute`/`Layout` wrapper in `client/src/App.jsx`.

Because that surface is reachable by anyone, `server/index.js` rate-limits it with `express-rate-limit`: `/api/auth/login` (failed attempts only), all of `/api/conferma`, and more tightly `POST /api/conferma/rispondi`, which can insert rows into `ospiti`. Limits are keyed by IP, so **`TRUST_PROXY` must match the real number of proxies in front of the app**. Left unset behind nginx, every guest appears to come from the proxy and they all share one bucket — the RSVP page then locks out everyone at once. It is deliberately a hop count and never `true`: trusting any hop lets a client forge `X-Forwarded-For` and reset its own limit. Under-declaring is safe, over-declaring is not. When tuning a limit, remember it exists to stop scripts (thousands of requests), not to count people — carrier CGNAT legitimately puts many guests behind one address.

**Client pages mirror server routes 1:1** under `client/src/pages/*.jsx` (e.g. `Ospiti.jsx` ↔ `/api/ospiti`, `Tavoli.jsx` ↔ `/api/tavoli`). Italian labels/enums used across pages live in `client/src/labels.js`.

**Email**: SMTP settings are stored in the `email_config` DB table (configurable in-app), not just env vars. `server/index.js` runs an in-process reminder scheduler with `setInterval` (hourly check, not cron) that emails upcoming `scadenze` (deadlines) based on `email_config.reminder_*` settings — see `checkAutoReminder` in `server/index.js` and `server/email.js`.

**File uploads**: `multer`-based, written under `server/uploads/`. Only `/uploads/landing` is served statically — the landing photo is public by design. Everything else (contracts, quote PDFs) is private and is fetched through the authenticated `GET /api/documenti/download/:id` and `/api/preventivi/download/:id`, which is what the client already does (`Documenti.jsx` and `Preventivi.jsx` read them as blobs). Do not widen that static mount back to `/uploads`: it exposed every uploaded file to anyone who learned a filename.

**Transactions**: `db.transaction()` guards the multi-statement mutations where an interruption leaves data worse than not running at all. `conferma.js`'s `/rispondi` saves main guest, partner and children from the public form together (children are updated in place, matched by id or name — it used to delete and re-insert them, which dropped the table, surname and notes the public form doesn't carry); `ospiti.js`'s `DELETE` removes relatives and then the main guest; `POST /api/ospiti/famiglia` saves guest + partner + children from the Lista Ospiti form in one go; `/bulk/elimina` and `/bulk/aggiorna` apply a multi-selection all-or-nothing (Tavoli's seat assignment uses the latter too); `preventivi.js`'s `POST`/`PUT` save the quote together with its payment plan (`preventivi_rate`, sent as a JSON string in the multipart body and synced by id — the old single `anticipo` column was migrated into a first paid instalment and is no longer written); `location.js`'s `POST`/`PUT` likewise save a location with its children's age bands (`location_fasce`), which `GET /api/location/stime` applies to the guest list (`eta`, falling back to adult price for a child without one) to estimate the per-person cost of each location. Accepted quotes reach Budget & Costi as read-only rows computed client-side in `Budget.jsx`, never copied into `costi`. Supplier invoices are `documenti` rows with `categoria='Fattura'` (plus `numero_fattura`/`data_fattura`/`importo_fattura`), owned by the supplier; which instalments they cover is an optional many-to-many in `fatture_rate`, written together with the document by `documenti.js`'s `POST`/`PUT` — deliberately not one-invoice-per-instalment, since suppliers often invoice several instalments at once or none. `Preventivi.jsx` uploads an invoice straight from an instalment; `Documenti.jsx` edits the links afterwards. Plain CRUD elsewhere deliberately stays untransacted — wrapping everything would be noise.

`/famiglia` writes only the form's fields for existing relatives (`aggiornaFamiliare`), never a full-row `PUT`: the form doesn't carry a relative's table, email or notes, and the old per-person `PUT` blanked them, unseating the whole family on every edit of the main guest. Likewise invitation state (`invito_inviato`/`invito_canale`) is only ever set through `/bulk/aggiorna`. For a new multi-statement mutation, ask whether an interruption halfway leaves the data worse than not running at all; if so, wrap it. A `db.transaction()` callback must not send a response: validate and return errors *before* it, as `/rispondi` does.

**Error handling**: `server/index.js` ends with a global error handler mapping multer, SQLite and body-parser failures to sensible statuses and Italian messages, without leaking internals. It is only half the chain — a page that swallows the rejection still shows the user nothing, which is what `Documenti.jsx` and `Preventivi.jsx` did before they got a `catch` rendering `err.response?.data?.error`. New save/upload handlers should do the same.

Related gotcha: **better-sqlite3 binds `undefined` as `NULL` without complaining** (checked on 13.0.2). A column left out of a `SELECT` and then passed to an `UPDATE` is silently blanked instead of raising — this quietly cleared `preventivi.dimensione_file` on every edit until the `SELECT` was fixed. Whenever an update reads existing values and writes them back, verify the read lists every column the write binds.

**`ospiti.tipo` vs. `ospiti.relazione`**: these look redundant but encode different things and must not be conflated. `tipo` (`adulto`/`bambino`) is a pure age category, derived from `eta` against the configurable `config.soglia_eta_bambino` threshold (default 12) — used for catering/menu counts. `relazione` (`partner`/`figlio`/`NULL`) is family relationship to the `parent_id` guest, fixed regardless of age — used everywhere a UI needs to know "is this the partner or a child of the main guest" (icons, "figlio di X"/"partner di X" labels, PDF exports). A grown-up child is `relazione='figlio'` + `tipo='adulto'` simultaneously. `tipo` for a `figlio` row is recomputed from `eta` at every save (client: `tipoFiglio()` in `Ospiti.jsx`; server: inline in `conferma.js`'s `/rispondi` handler) — never hardcoded. When adding a new place that reads one of these fields, ask which question you're actually answering (age or kinship) before picking one.

**Adding a column to `ospiti`?** Check `server/routes/tavoli.js`'s `GET /` — unlike every other route, it does *not* `SELECT o.*`; it lists explicit columns for the nested `t.ospiti[]` payload. A new `ospiti` column silently won't reach `Tavoli.jsx`'s table cards unless it's added there too (this already bit `eta` and `relazione` once).

**Tavoli page** is split into tabs (`?vista=assegna|pianta|gestisci`), with the tab bodies in `client/src/pages/tavoli/` and `Tavoli.jsx` keeping the data, the actions and the PDF exports. `PUT /api/tavoli/:id` is a *partial* update: it merges the body over the stored row, because the floor plan sends only `rotazione`/`forma` and the Gestisci tab only the field being edited. Order (`ordine`, via `POST /ordine`) and floor-plan position (`pos_x`/`pos_y` in a 1200×800 space shared with `tavoli/util.js`, via `POST /posizioni`) have their own endpoints. A table's `tipo` (`normale`/`sposi`/`bambini`) feeds the warnings in `calcolaAvvisi`: a child seated away from their parents is flagged unless they sit at a `bambini` table.

**The couple are guests too**: `ospiti.sposo` (1/2, matching `config.nome_sposo1/2`) marks two rows that `server/sposi.js` creates, confirmed and seated, when a table *becomes* `tipo='sposi'` (POST, or a PUT that changes the type — never on a plain re-save, which would re-seat them after being moved on purpose). Being real rows, they count in seats, catering, place cards and PDFs with no special-casing. Their `nome` follows the settings (`config.js` PUT calls `aggiornaNomiSposi`). Exclude them wherever "guest" means "someone we invite": the public RSVP lookup and `/rispondi` (`sposo IS NULL`), and invitation tracking in `Ospiti.jsx`.

**PDF exports** — `exportPDF` in `Ospiti.jsx`/`Budget.jsx`/`Cronologia.jsx` and `exportSeatingPDF` in `Tavoli.jsx` share one visual convention: a rose (`[225,29,72]`) 28mm header bar with an 18pt bold title + 10pt subtitle, content via `jspdf-autotable` (which paginates and repeats the header row automatically — never hand-roll page-break math for tabular content, see the "senza tavolo" bug this fixed), and a footer loop over `doc.getNumberOfPages()` printing "Pagina X di Y" + a dated label at y=290. `Inviti.jsx` and `Tavoli.jsx`'s `exportSegnaposti` (place cards) intentionally break this convention — they're printable cards/graphics, not data reports. `Inviti.jsx` renders real HTML off-screen and rasterizes it via `html2canvas` because it needs arbitrary CSS (fonts, gradients); that's fine for a single fixed-size A5 page, but don't reach for that approach for anything that can span multiple pages of tabular data — a flat screenshot sliced at fixed mm intervals cuts content mid-row, which is exactly what Cronologia's export used to do before it was rewritten with autoTable.

**No test suite exists** — verification in practice means: seed edge-case rows directly via a `better-sqlite3` one-off `node -e`, drive the running app with a throwaway Playwright script (`chromium.launch()`, log in as `sposo`/`sposo1`, screenshot or read `.png` output), and/or inspect a downloaded PDF's actual text positions with `pdfjs-dist` (`page.getTextContent()`) rather than trusting the code by inspection alone — several bugs fixed in this codebase (the tavoli.js column list, the seating-chart page-break overlap) were only visible that way, not from reading the diff.

**Anything that runs inside the container must be tested with `docker compose exec`, not locally.** `backup.sh` passed every local check and then failed twice in production for reasons that exist only in the image: the script was not in the running image yet (it is invoked before the rebuild), and once staged in `/tmp` its `require('better-sqlite3')` could not resolve, because Node walks up from the script's own directory while the dependencies live in `/app/server/node_modules`. Paths, module resolution and `__dirname` all differ in there. Similarly, behaviour that depends on client IPs (rate limiting) cannot be judged from a local run: simulate it with an explicit `X-Forwarded-For` header and compare the `RateLimit` response header across two addresses.

**Production serving**: in production, `server/index.js` serves the built client (`client/dist`) as static files and falls back to `index.html` for client-side routing, so the Express server is the single deployed process (see `Dockerfile`, multi-stage: builds client, then copies `dist/` into the server image next to `server/`).

**Backups** — `backup.sh` + `server/backup-db.js`, daily cron installed by `install.sh`, snapshot taken by `update.sh` before every upgrade. Never copy `matrimonio.db` with `cp`/`tar` while the app runs: the database uses `journal_mode = WAL`, so recent transactions live in the sidecar `-wal` file and a raw copy of the `.db` alone loses them. `backup-db.js` uses `VACUUM INTO`, which writes one consolidated, compacted file and works even from a read-only connection, then re-opens the result and runs `PRAGMA integrity_check` before reporting success. `backup.sh` copies the script from the checkout into the container instead of invoking the image's own copy, so a fix applies immediately rather than after the next rebuild. Restoring requires deleting the stale `-wal`/`-shm` files next to the restored database — procedure in the README.

