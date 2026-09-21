# IEEE ITB Events — Event Management Platform

A lightweight event management platform built for the IEEE ITB Fullstack
Developer probation task. Public visitors can browse and search events;
authenticated admins can create, edit, and delete them from a dashboard.

Built with **zero runtime dependencies** — clone it and run `node
server/server.js`. No `npm install`, no bundler, no build step.

---

## 1. Project overview

- **Public site** (`/`): searchable, filterable list of events, each linking
  to a detail page with full information.
- **Admin dashboard** (`/admin`): login-gated. Lets an admin add, edit, and
  delete events through a table with modals, with validation and delete
  confirmation.
- **REST API** (`/api/*`): backs both of the above; documented in [section
  5](#5-api-reference).

## 2. Completed features

**Frontend**
- [x] Public event list with search, status filter tabs, and pagination
- [x] Public event detail page
- [x] Admin login page
- [x] Admin dashboard as the main event-management interface
- [x] Add / edit event via a modal form with client-side validation
- [x] Delete event with a confirmation modal
- [x] Responsive layout (tested at desktop and 375–390px mobile widths)
- [x] Loading (skeleton), empty, and error states on every data view
- [x] Toast notifications for create/update/delete outcomes

**Backend**
- [x] Cookie-based admin authentication (signed, expiring tokens)
- [x] REST endpoints for events: list (with search/filter/pagination), get
      one, create, update, delete
- [x] Server-side validation on every write, independent of the frontend
- [x] Consistent JSON error format with proper HTTP status codes
      (400/401/404/405/413/500)
- [x] SQLite persistence — no mock/hardcoded data
- [x] Server-side route protection for the dashboard HTML page itself, not
      just the API (an unauthenticated request never receives the page)

**Should-have extras included**
- [x] Search (title/location) and status filtering
- [x] Pagination
- [x] A shared frontend "service layer" (`public/js/api.js`) instead of
      scattered `fetch()` calls
- [x] An optional Playwright end-to-end test suite (see [section
      7](#7-testing-optional))

See [section 8](#8-known-limitations) for what's intentionally out of scope.

## 3. Architecture summary

```
┌──────────────────┐        ┌──────────────────────────┐        ┌────────────┐
│   Browser (SPA-   │  HTTP  │   Node.js (http core)     │  SQL   │   SQLite   │
│  free, vanilla JS)│ ─────► │   server/server.js router │ ─────► │  app.db    │
│  public/*.html    │ ◄───── │   → routes/*.routes.js    │ ◄───── │            │
└──────────────────┘  JSON   └──────────────────────────┘        └────────────┘
```

One Node process does two jobs:

1. **Serves the API** under `/api/*` — a small hand-rolled router
   (`server/utils/router.js`) matches method + path (with `:params`), each
   route module (`server/routes/`) handles one resource.
2. **Serves the frontend** as static files from `public/`, and additionally
   guards `/admin/dashboard.html` server-side: an unauthenticated request is
   302-redirected to the login page before the HTML is ever sent.

Request flow for a write (e.g. creating an event):

```
Dashboard form submit
  → public/js/api.js (fetch wrapper, adds JSON headers, parses errors)
  → POST /api/events (cookie sent automatically by the browser)
  → server/routes/events.routes.js
      → auth.js: verify JWT cookie → 401 if missing/invalid/expired
      → validators/event.validator.js: validate body → 400 with field errors if invalid
      → db.js: INSERT via node:sqlite, prepared statement
  → JSON { success, data } or { success: false, error }
  → UI updates table / shows field errors / shows toast
```

Layers are kept separate on purpose: `validators/` doesn't know about HTTP,
`db.js` doesn't know about validation, `routes/` only wires the two
together. That keeps each file testable and easy to change independently
(e.g. swapping SQLite for another engine only touches `db.js`).

## 4. Tech stack & rationale

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js ≥ 22.5 | Node 22 stabilized `node:sqlite`, a built-in SQLite driver — real persistence with **no third-party package**. |
| Backend framework | None (built-in `http`) | The app is small enough that a ~60-line router (`utils/router.js`) covers routing, params, and 404/405 handling without pulling in Express. This also means the project has **zero install step** and no risk of dependency drift between the evaluator's machine and this one. |
| Database | SQLite via `node:sqlite` | File-based, zero configuration, transactional, and explicitly listed as an acceptable option in the brief. Good fit for a "lightweight platform." |
| Auth | Custom HMAC-SHA256 JWT + httpOnly cookie | `jsonwebtoken`/`bcrypt` are one-liners around Node's own `crypto` module (`scrypt` for hashing, `createHmac` for signing) — implementing them directly avoids a dependency for something this small, and demonstrates the mechanics rather than hiding them. Tokens are short-lived (2h default, configurable) and delivered via an `HttpOnly`, `SameSite=Lax` cookie rather than `localStorage`, to reduce XSS token-theft risk. |
| Frontend | Vanilla HTML/CSS/JS (ES modules-free, plain `<script>`) | No React/Vite build step to configure or explain; every file runs directly in the browser. A small reusable layer (`api.js` for network calls, `components.js` for render helpers) keeps this from turning into copy-pasted spaghetti across pages. |
| Styling | Hand-written CSS with design tokens (`public/css/styles.css`) | One shared stylesheet, CSS custom properties for color/spacing/type, so the whole app stays visually consistent without a CSS framework. |

**Trade-off, stated plainly:** a framework-free stack means a few things
(routing, JWT, the "component" pattern) are hand-rolled instead of imported.
For a project this size that's a reasonable trade for zero setup friction;
it would not be the right call at a larger scale, where Express/Fastify and
a proper ORM would pay for themselves.

## 5. API reference

All responses are JSON: `{ "success": true, "data": ... }` or
`{ "success": false, "error": { "message": "...", "fields": {...}? } }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/events` | Public | List events. Query params: `search`, `status` (`upcoming/ongoing/completed/cancelled`), `page`, `limit` (max 50). |
| GET | `/api/events/:id` | Public | Get one event. 404 if not found. |
| POST | `/api/events` | Admin | Create an event. Body validated server-side. |
| PUT | `/api/events/:id` | Admin | Partially update an event. |
| DELETE | `/api/events/:id` | Admin | Delete an event. |
| POST | `/api/auth/login` | Public | `{ username, password }` → sets auth cookie. |
| POST | `/api/auth/logout` | — | Clears the auth cookie. |
| GET | `/api/auth/me` | Admin | Returns the signed-in admin, or 401. |

## 6. Local setup

**Requirements:** Node.js 22.5 or newer (for `node:sqlite`). Check with
`node --version`.

```bash
git clone <your-repo-url>
cd <repo-folder>
cp .env.example .env      # optional — sensible defaults are built in
node server/server.js
```

Then open:
- Public site: http://localhost:3000
- Admin login: http://localhost:3000/admin/login.html

That's it — no `npm install` is required to run the app. The SQLite
database is created automatically at `data/app.db` on first run, along with
a default admin account and a few sample events (see credentials below).

### Environment variables

See [`.env.example`](./.env.example) for the full list with comments. None
of the example values are real secrets.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `./data/app.db` | SQLite file location |
| `JWT_SECRET` | *(dev placeholder)* | Signs admin session tokens — change for any real deployment |
| `TOKEN_TTL_SECONDS` | `7200` | Admin session lifetime |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | `admin` / `admin12345` | Used only the very first time the app runs against an empty database |
| `NODE_ENV` | `development` | Set to `production` to add the `Secure` cookie flag (requires HTTPS) |

### Database setup

No separate step needed — `server/db.js` creates the schema and seeds data
automatically on first boot. To start over with a clean database, stop the
server and delete the `data/app.db*` files, then start it again.

### Demo / evaluator credentials

| Username | Password |
|---|---|
| `admin` | `admin12345` |

(Change `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD` in `.env` **before** the
first run if you want different seeded credentials — they only take effect
against an empty `admins` table.)

## 7. Testing (optional)

An end-to-end Playwright suite drives the real UI in a headless browser
against a throwaway database (it spawns its own server instance on a
separate port and cleans up after itself):

```bash
npm install --save-dev playwright   # one-time; not needed to run the app
npm run test:e2e
```

This is separate from the app's own dependency-free runtime — it's a dev
tool, not something the deployed app needs.

## 8. Known limitations

- **No password-change UI.** The seeded admin password can only be changed
  by editing `.env` before the first run, or directly in the database.
- **Single admin role.** There's no multi-admin management UI (though the
  `admins` table supports multiple rows).
- **Image field is a URL, not a file upload.** `image_url` is a plain text
  field validated as a URL; there's no file-upload/storage pipeline.
- **JWT has no refresh flow.** A session simply expires after
  `TOKEN_TTL_SECONDS` and the admin logs in again — acceptable for this
  scope, but a production app would likely add refresh tokens.
- **SQLite's Node driver is still experimental** (`node:sqlite`, stable
  candidate as of Node 22/24). It prints an `ExperimentalWarning` on
  startup; this is expected and harmless for this project's scope.

## 9. AI usage

This project was built with Claude, Gemini AI, ChatGPT, and Copilot as a pair-programming
assistant, used throughout the full stack:

- **Planning:** discussing framework/database trade-offs before writing
  code, given the constraint of a fully offline-buildable, zero-dependency
  runtime.
- **Implementation:** generating the backend (router, auth, validators,
  routes), the SQLite schema, and the frontend (HTML/CSS/JS across public
  and admin pages).
- **Testing:** writing and running a curl-based API test pass and a
  Playwright headless-browser end-to-end suite against the real running
  app, iterating on real failures (e.g. a state-leak bug between two tests
  was caught this way and fixed).
- **Design:** the visual direction (color palette, type pairing, the
  engineering "title block" motif on the event detail page) was proposed
  and implemented by the assistant, then reviewed against rendered
  screenshots.

All generated code was reviewed, run, and tested end-to-end before being
included here; the author of this submission is responsible for it in the
interview discussion.
