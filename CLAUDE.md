# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AIRec is an AI-receptionist product, split into two independent apps with no root `package.json` — always run commands from inside `frontend/` or `backend/`:

- `frontend/` — Next.js UI. Still a skeleton beyond auth: every dashboard page renders an empty styled `<div>`.
- `backend/` — FastAPI service. Authentication (register / login / refresh / logout / me) is implemented and verified end-to-end against PostgreSQL 18; nothing else is.

**Auth is wired end-to-end**, including refresh rotation. `login.jsx` and `signup.jsx` call `backend/`'s `/api/v1/auth/*` through `frontend/src/lib/api.js`; tokens land in `localStorage` via `frontend/src/lib/auth.js`. `DashboardLayout` calls `useRequireAuth()`, which calls `verifySession()` — a real server round trip: `GET /auth/me` with the stored access token, and on any failure (expired, invalid, backend momentarily unreachable) a fallback `POST /auth/refresh` with the stored refresh token before giving up. Only if both fail does it clear tokens and redirect to `/login`; it renders nothing while that check is in flight, so protected content never flashes on screen. `login.jsx`/`signup.jsx` run the same `verifySession()` via `useRedirectIfAuthed()` to bounce a visitor with a live session straight to `/dashboard`. `profile.jsx` has the only sign-out control, which calls `/auth/logout` best-effort then clears local tokens regardless.

Both apps must be running for auth to work: backend on `:8000` (`uvicorn app.main:app --reload`, Postgres started first) and frontend on `:3000` (`npm run dev`). `frontend/.env.local` (gitignored) holds `NEXT_PUBLIC_API_URL`, pointing at the backend's `/api/v1`; `.env.local.example` is the template. CORS on the backend is locked to `CORS_ORIGINS` in `backend/.env` — add an origin there before calling the API from anywhere else.

## Commands

Run from `frontend/`:

- `npm install` — install dependencies
- `npm run dev` — start dev server (Next.js 16 + React 19; Turbopack is the default dev bundler)
- `npm run build` — production build
- `npm start` — run the production build
- `npm run lint` — oxlint over `src/pages` and `src/components` only (`.oxlintrc.json` enables the `react` + `oxc` plugins; the only explicit rules are `rules-of-hooks` and `only-export-components`)

Plain JSX, no TypeScript — there is no typecheck step, and no test suite exists.

Run from `backend/` (with `.venv` active, or via `.venv/Scripts/python.exe -m …`):

- `pip install -r requirements.txt` — install dependencies (versions are pinned)
- PostgreSQL 18 runs **natively, no Docker** — a project-local data dir at `backend/.pgdata`. Start it with `pg_ctl -D .pgdata -l .pglog start` (full setup in `backend/README.md`); it's not a Windows service, so it needs starting again after every reboot.
- `alembic upgrade head` — apply migrations; `alembic check` fails on model/migration drift
- `uvicorn app.main:app --reload` — dev server; interactive docs at `/docs`
- `ruff check .` — lint (config lives in `pyproject.toml`, which is tooling-only — dependencies are in `requirements.txt`)

`backend/.env` is required and gitignored; copy `.env.example` and set a `SECRET_KEY` of 32+ chars or the app refuses to boot. No backend test suite yet either.

## Architecture

### Layout routing (`src/pages/_app.jsx`)
Layout is chosen per-route, not per-page. A `PUBLIC_ROUTES` set holds paths that render inside `PublicLayout` (marketing header, no sidebar) — currently `/`, `/login`, `/signup`. Every other route renders inside `DashboardLayout` (fixed icon `Sidebar` + `Header`), the authenticated app shell. When adding a new logged-out/marketing page, add its path to `PUBLIC_ROUTES`; everything else gets the dashboard chrome automatically.

- `/` — public landing page (`pages/index.jsx`), the only public page with real content (hero + two CTAs).
- `/dashboard` — authenticated home. Not `/` — that's the landing page.
- `/inbox`, `/appointments`, `/analytics` — dashboard pages, still empty placeholders.
- `/profile` — account settings UI (avatar, name/email/phone, password-change form) and the one place with a working **sign out** button. The settings forms themselves don't call the backend yet — only logout does.
- `/clients` — exists as a page but is **orphaned**: it's absent from `Sidebar`'s `navigation` array *and* from `Header`'s `pageTitles`, so nothing links to it and its header title falls through to the default. Wire up both if you build it out.
- `/login` and `/signup` — built, intentionally near-identical: no `<label>`s (inputs use `placeholder` only); password field has a show/hide toggle (local `showPassword` state flips the `input type` between `password`/`text`); a `<hr>` sits above the submit button; a bottom line cross-links to the other page (`Log In` / `Sign Up` in accent blue `#3248F2`). Keep them in sync when restyling one — they're meant to stay visual twins. Both now submit to the backend (see the auth-wiring note above) and show inline errors — `login.jsx` a single message above the `<hr>`, `signup.jsx` per-field messages (from 422 `fields`) plus the same general-error line for 409s/network failures.

Every page supplies its own `<Head><title>AIRec</title></Head>` — there's no shared default title, so new pages need their own.

### API client (`src/lib/`)
- `lib/api.js` — the only place that calls the backend. One `request()` helper does the `fetch`, reads `NEXT_PUBLIC_API_URL`, and throws `ApiError` (`.code`, `.message`, `.fields`, `.status`) on any non-2xx or network failure, parsed straight from the backend's `{error: {...}}` envelope. Add new endpoints as small named exports here (`register`, `login`, `refresh`, `logout`, `me`, `checkUsernameAvailability`) rather than calling `fetch` from a page.
- `lib/auth.js` — `localStorage`-backed token storage (`saveTokens`, `getAccessToken`, `getRefreshToken`, `clearTokens`, `isAuthenticated`), `verifySession()` (the real check: `me()`, falling back to `refresh()` and re-saving tokens on success, clearing them and returning `null` if both fail), and two hooks built on it: `useRequireAuth()` (used by `DashboardLayout`, redirects to `/login` and returns `false` until a session is confirmed — callers must not render children before it returns `true`) and `useRedirectIfAuthed()` (used by `login.jsx`/`signup.jsx`, bounces a visitor with a live session to `/dashboard`). `isAuthenticated()` is a cheap presence-only check — reach for `verifySession()` instead anywhere the answer actually needs to be correct.

### Dashboard shell
- `Sidebar.jsx` — fixed 64px icon-only rail (`#171215` bg). Nav items are a hardcoded `navigation` array; active state matches `router.pathname`; each item shows a hover tooltip. The profile link is pinned to the bottom separately from the array.
- `Header.jsx` — sticky 68px top bar; page title comes from a `pageTitles` map keyed by route — update this map when adding a new dashboard route.
- Leftovers from the AIReca → AIRec rename still sit in `Sidebar.jsx` (link `aria-label`) and `Header.jsx` (fallback title). Use "AIRec" in anything new, and fix those strings if you touch the surrounding code.

### Public shell
- `LandingHeader.jsx` — sticky **64px** header: the black logo image alone on the left (no wordmark), Log In / Sign Up buttons on the right. Reused by every `PUBLIC_ROUTES` page via `PublicLayout.jsx`. Any page under `PublicLayout` must offset its root container to match this header's actual height (see `Home.module.css`) — it has drifted from the dashboard's 68px through iteration, so don't assume they're equal.
- Logo assets: `BrandMark.jsx` renders `public/airec_logo.png`, a **white** mark on a transparent background — only visible on a dark surface (used in the dark `Sidebar`). `public/black_logo_icon.png` is the black variant, tightly cropped (no baked-in padding) for use directly on light backgrounds — used as-is (no wrapper badge) in `LandingHeader.jsx`. Pick whichever variant matches the surface color; don't badge-wrap one to force it onto the wrong background.
- Images are plain `<img src="/…">` from `public/`, not `next/image`, and some carry a `?v=N` cache-buster — bump `N` when replacing an asset in place. `src/assets/` is tracked but imported by nothing: it's a stash of source/design images, not a runtime asset dir.

### Styling convention
- Tailwind v4, configured entirely via the `@theme` block in `src/styles/globals.css` — there is no `tailwind.config.js`. PostCSS config is `postcss.config.mjs`.
- Brand tokens: `--color-brand-blue #3248f2` (accent/CTA), `--color-brand-black #171215` (text/dark surfaces), `--color-brand-gray #999999` (borders, typically at 20–45% opacity), `--color-brand-soft #f6f8fa` (page background), `--color-brand-white #ffffff`.
- Components overwhelmingly reference these as raw Tailwind arbitrary values (`bg-[#171215]`, `border-[#999999]/25`) rather than the semantic `bg-brand-*` classes. Match that existing convention instead of switching styles mid-codebase.
- Fonts: Poppins (`font-display`, headings) and Roboto Variable (`font-sans`, body), loaded via `@fontsource` imports in `_app.jsx`.
- Each page pairs with a CSS Module in `src/styles/` for its root container — the convention is `min-height: calc(100vh - Npx)` plus a background color, and nothing else. `N` must match the actual current height of that layout's header component (`Header.jsx` or `LandingHeader.jsx`) — check the header's `h-*` class rather than assuming a fixed number, since header heights get tuned independently. All other styling is inline Tailwind utility classes.
- Icons: `@hugeicons/react` + `@hugeicons/core-free-icons` via the `HugeiconsIcon` component — not emoji, not another icon set.
- No UI component library (no shadcn/ui, MUI, Ant Design, etc.). Components are hand-built with Tailwind.

### UI language
Dashboard UI copy (nav labels, headings, page titles, tooltips) is Russian; `_document.jsx` sets `<Html lang="ru">`. The public flow is the deliberate exception — visible copy in `LandingHeader.jsx`, `index.jsx`, `login.jsx`, and `signup.jsx` is English by explicit request, while their non-visible `aria-label`s are still Russian/Kazakh. Follow whichever convention matches the shell (dashboard vs. public) when adding pages.

## Backend architecture (`backend/`)

FastAPI + SQLAlchemy 2.0 async + asyncpg + PostgreSQL 18, migrated with Alembic. See `backend/README.md` for the endpoint table and setup steps.

### Layering — keep the direction of dependency
`app/api` (HTTP) → `app/services` (rules) → `app/repositories` (queries) → `app/models`. Services raise `AppError` subclasses from `app/core/errors.py` and must never import FastAPI or raise `HTTPException`; `app/main.py` owns the mapping from error to response. Repositories own all query construction — don't write `select()` inside a service or route.

Every failure leaves the API in one envelope, `{"error": {"code", "message"}}` (422 adds a `fields` array), so the frontend needs only one parser. Preserve that shape when adding endpoints.

### Auth model — the non-obvious parts
- **Argon2id runs on a worker thread** (`anyio.to_thread` in `app/core/security.py`). Hashing inline in an `async def` would stall the event loop for every concurrent request — keep any new password work on that path.
- **Login always performs a verification, even with no matching user**, against a module-level dummy hash. That's deliberate: it stops response timing from revealing which accounts exist. Don't "optimise" the early return away.
- **Access token is a stateless 15-min JWT; the refresh token is opaque and stored only as a SHA-256 digest.** The digest is what makes logout/revocation real. Refresh tokens rotate on every use, and replaying an already-rotated token is treated as theft — it revokes every session for that user.
- **Identity casing:** emails are normalised to lowercase in the schema layer and get a plain unique index; usernames keep their typed casing but are unique case-insensitively through a `lower(username)` unique index, which also backs the login lookup. `AuthService._conflict_for` matches on the constraint names `uq_users_email` / `uq_users_username_lower` — rename either index and that mapping breaks silently.
- **Live username check:** `GET /auth/username-availability?username=` (public, no auth) backs the signup form's real-time green-tick/red-warning UI. `AuthService.check_username_available` treats a malformed username as unavailable without hitting the database — it never has to distinguish "invalid" from "taken" for the caller, both just render as "not available" (see `signup.jsx`).
- Registration pre-checks duplicates for a precise message, but the unique indexes are the actual guarantee; a race surfaces as `IntegrityError` and is mapped back to the same 409.
- **Password policy is charset + length, checked on registration only.** `Password` (shared by register/login) enforces 8–128 chars; `RegisterRequest` additionally runs `_validate_password_charset` against `PASSWORD_CHARSET_PATTERN` in `app/schemas/auth.py` — Latin letters, digits, and a fixed symbol set, no whitespace or other scripts. Login doesn't re-check the charset since a stored password was, by construction, already valid at registration time. `app/main.py`'s `_field_message` strips the "Value error, " prefix Pydantic v2 glues onto `raise ValueError(...)` messages from field validators — write new validator messages assuming that prefix is gone. `signup.jsx` mirrors the rule as a static hint under the password field, swapped for the live `422` message on failure; `login.jsx` doesn't need either since it's just entering an existing password.

### Config and migrations
`app/core/config.py` is the only place that reads the environment — import `settings` rather than touching `os.environ`. It rejects a non-asyncpg `DATABASE_URL` and a `SECRET_KEY` under 32 chars at startup, by design. `alembic/env.py` takes its URL from those same settings, so there is no second copy in `alembic.ini`. `Base.metadata` uses an explicit naming convention (`app/db/base.py`) — new models inherit it, which is what keeps autogenerated migrations stable. Add every new model to `app/models/__init__.py` or autogenerate won't see it.

PostgreSQL is a native install (`C:\Program Files\PostgreSQL\18`), with its data directory at `backend/.pgdata` (gitignored) rather than the default install location — kept local to the project instead of a machine-wide service. Role/database are both named `airec`, matching `DATABASE_URL` in `.env.example`.

## Design workflow (required for all UI/UX work)

For any UI/UX task in this project — new pages, components, layout or styling changes:
1. Use the `ui-ux-pro-max` skill for design-system and UX guidance.
2. Use the 21st MCP tools (`mcp__21st__search`, `mcp__21st__generate`, etc.) for component/layout reference.

This project's brand colors and fonts (listed above) are already fixed — treat ui-ux-pro-max's own palette/font suggestions as informative reference, not a directive to replace them, unless the user explicitly asks for a rebrand.
