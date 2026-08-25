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

Before first run, copy `.env.example` to `.env` and set `JWT_SECRET`. **Put it in `server/.env`, not the repo root** — `npm run server`/`npm run dev` run `cd server && node index.js`, and `dotenv.config()` in `server/index.js` resolves `.env` relative to the process CWD, which is `server/`. A root-level `.env` is silently ignored, and login fails with a misleading "credenziali non valide" (masking a 500 from `jsonwebtoken` — `secretOrPrivateKey must have a value`). This only matters for local dev; in Docker/production, `JWT_SECRET` comes from `docker-compose.yml`'s `environment:` and dotenv doesn't override already-set env vars.

## Architecture

**No ORM, no service layer.** `server/db.js` opens a single `better-sqlite3` database and each `server/routes/*.js` file runs prepared SQL statements directly inline in its Express handlers. One route file per resource (e.g. `fornitori.js`, `ospiti.js`, `tavoli.js`), mounted 1:1 in `server/index.js` under `/api/<resource>`. When adding a feature, follow this pattern rather than introducing new abstractions.

**Schema lives entirely in `server/db.js`**, not in a migrations tool: `CREATE TABLE IF NOT EXISTS` for the base schema, followed by manual `ALTER TABLE ... ADD COLUMN` guarded by `PRAGMA table_info` checks for every column added after initial release. Any new column must follow this same guarded-`ALTER TABLE` pattern so existing deployed SQLite files upgrade in place on next boot. This file also seeds default config, a default checklist, and two default users (`sposo`/`sposo1`, `sposa`/`sposa1`) on first run.

**Auth**: JWT via `server/middleware/auth.js` (verifies `Authorization: Bearer` header, sets `req.user`). Client keeps the token/user in `localStorage` (`client/src/AuthContext.jsx`); the shared axios instance (`client/src/api.js`) attaches the header on every request and force-redirects to `/login` on any 401.

**Public vs. private surface**: most routers require `auth`, but a few are intentionally unauthenticated because they're used by wedding guests, not the couple:
- `/api/conferma` — public RSVP flow (find/confirm a guest by name; gated additionally by the `conferma_abilitata` flag in `config`)
- `/api/landing` and `/wedding` — public wedding info page
- `/api/config/public` — subset of `config` exposed for branding (app name/emoji/title), fetched by `AppConfigContext.jsx` on every load to set `document.title` and a dynamic emoji favicon

Guest-facing pages (`Conferma.jsx`, `Landing.jsx`) are routed outside the `PrivateRoute`/`Layout` wrapper in `client/src/App.jsx`.

**Client pages mirror server routes 1:1** under `client/src/pages/*.jsx` (e.g. `Ospiti.jsx` ↔ `/api/ospiti`, `Tavoli.jsx` ↔ `/api/tavoli`). Italian labels/enums used across pages live in `client/src/labels.js`.

**Email**: SMTP settings are stored in the `email_config` DB table (configurable in-app), not just env vars. `server/index.js` runs an in-process reminder scheduler with `setInterval` (hourly check, not cron) that emails upcoming `scadenze` (deadlines) based on `email_config.reminder_*` settings — see `checkAutoReminder` in `server/index.js` and `server/email.js`.

**File uploads**: `multer`-based, written under `server/uploads/`, served statically at `/uploads`.

**`ospiti.tipo` vs. `ospiti.relazione`**: these look redundant but encode different things and must not be conflated. `tipo` (`adulto`/`bambino`) is a pure age category, derived from `eta` against the configurable `config.soglia_eta_bambino` threshold (default 12) — used for catering/menu counts. `relazione` (`partner`/`figlio`/`NULL`) is family relationship to the `parent_id` guest, fixed regardless of age — used everywhere a UI needs to know "is this the partner or a child of the main guest" (icons, "figlio di X"/"partner di X" labels, PDF exports). A grown-up child is `relazione='figlio'` + `tipo='adulto'` simultaneously. `tipo` for a `figlio` row is recomputed from `eta` at every save (client: `tipoFiglio()` in `Ospiti.jsx`; server: inline in `conferma.js`'s `/rispondi` handler) — never hardcoded. When adding a new place that reads one of these fields, ask which question you're actually answering (age or kinship) before picking one.

**Production serving**: in production, `server/index.js` serves the built client (`client/dist`) as static files and falls back to `index.html` for client-side routing, so the Express server is the single deployed process (see `Dockerfile`, multi-stage: builds client, then copies `dist/` into the server image next to `server/`).

