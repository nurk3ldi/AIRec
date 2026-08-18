# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AIRec is an AI-receptionist product, split into two independent apps with no root `package.json` — always run commands from inside `frontend/` or `backend/`:

- `frontend/` — React + Vite + Tailwind SPA (**no Next.js**; migrated 2026-08-18). Auth and `/business` are built; `/appointments` is deliberately an empty page while a third design is drawn; `/dashboard`, `/inbox` and `/notifications` are still empty or placeholder screens.
- `backend/` — FastAPI service. Authentication and account profile, the business profile (services, working hours, logo) and bookings (`/appointments` CRUD, `/appointments/slots`, archive) are implemented and verified end-to-end against PostgreSQL 18. Not built: schedule overrides, a clients table, WhatsApp/assistant integration, and any test suite.

**Auth is wired end-to-end**, including refresh rotation. `login.jsx` and `signup.jsx` call `backend/`'s `/api/v1/auth/*` through `frontend/src/lib/api.js`; tokens land in `localStorage` via `frontend/src/lib/auth.js`. `DashboardLayout` calls `useRequireAuth()`, which calls `verifySession()` — a real server round trip: `GET /auth/me` with the stored access token, and on any failure (expired, invalid, backend momentarily unreachable) a fallback `POST /auth/refresh` with the stored refresh token before giving up. Only if both fail does it clear tokens and redirect to `/login`; it renders nothing while that check is in flight, so protected content never flashes on screen. `login.jsx`/`signup.jsx` run the same `verifySession()` via `useRedirectIfAuthed()` to bounce a visitor with a live session straight to `/dashboard`. `components/ProfileMenu.jsx` holds the only sign-out control, which calls `/auth/logout` best-effort then clears local tokens regardless.

Both apps must be running for auth to work: backend on `:8000` (`uvicorn app.main:app --reload`, Postgres started first) and frontend on `:3000` (`npm run dev`). `frontend/.env.local` (gitignored) holds `VITE_API_URL`, pointing at the backend's `/api/v1` — Vite only exposes keys prefixed `VITE_`, and reads them through `import.meta.env`, not `process.env`; `.env.local.example` is the template. CORS on the backend is locked to `CORS_ORIGINS` in `backend/.env` — add an origin there before calling the API from anywhere else.

## Commands

Run from `frontend/`:

- `npm install` — install dependencies
- `npm run dev` — Vite dev server on **port 3000, `strictPort`**. The port is pinned on purpose: the backend's `CORS_ORIGINS` names it, and Vite would otherwise slide to the next free port and leave the API refusing the browser with no obvious cause.
- `npm run preview` — serve the production build locally
- `npm run build` — production build
- `npm start` — run the production build
- `npm run lint` — oxlint over the whole of `src`, `src/archive/` included (`.oxlintrc.json` enables the `react` + `oxc` plugins; the only explicit rules are `rules-of-hooks` and `only-export-components`). It does not resolve imports, which is why an archived file whose relative paths no longer lead anywhere still passes.

Plain JSX, no TypeScript — there is no typecheck step, and no test suite exists.

Run from `backend/` (with `.venv` active, or via `.venv/Scripts/python.exe -m …`):

- `pip install -r requirements.txt` — install dependencies (versions are pinned)
- PostgreSQL 18 runs **natively, no Docker**, as the `postgresql-x64-18` Windows service the installer registers — port 5432, starts with the machine, nothing to launch by hand. The `airec` database is created once through pgAdmin; `alembic upgrade head` builds the schema.
- **Connection settings are separate `DB_*` values, not a `DATABASE_URL`** (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`). `Settings.database_url` is a computed property that assembles the asyncpg DSN and `quote_plus`-escapes the password — that escaping is the point, since a password with `@` or `/` would otherwise corrupt the DSN. Callers (`db/session.py`, `alembic/env.py`) still just read `settings.database_url`.
- An older setup put the data in a project-local `backend/.pgdata` started manually with `pg_ctl`. That directory may still exist as a leftover; it is **not** what the app uses.
- `alembic upgrade head` — apply migrations; `alembic check` fails on model/migration drift
- `uvicorn app.main:app --reload` — dev server; interactive docs at `/docs`
- `ruff check .` — lint (config lives in `pyproject.toml`, which is tooling-only — dependencies are in `requirements.txt`)

`backend/.env` is required and gitignored; copy `.env.example` and set a `SECRET_KEY` of 32+ chars or the app refuses to boot. No backend test suite yet either.

## Architecture

### Frontend stack — React + Vite, no framework

Entry chain: `index.html` → `src/main.jsx` (fonts, `globals.css`, `BrowserRouter`) → `src/App.jsx` (routes). Nothing renders on a server; the build is a static bundle in `dist/`.

Every Next.js primitive has one replacement, and mixing them back in is the thing to avoid:

| Was | Is |
| --- | --- |
| `next/link` `<Link href>` | `react-router-dom` `<Link to>` |
| `useRouter().push` / `.replace` | `useNavigate()(path)` / `(path, { replace: true })` |
| `useRouter().pathname` | `useLocation().pathname` |
| `useRouter().query` | `useSearchParams()` |
| `next/head` | `index.html` — see below |
| `_app.jsx` | `src/main.jsx` + `src/App.jsx` |
| `_document.jsx` | `index.html` |
| `getServerSideProps` | a client-side guard; there is no server |
| `process.env.NEXT_PUBLIC_*` | `import.meta.env.VITE_*` |

**The title lives in `index.html` and nowhere else.** All ten pages declared the same `<Head><title>AIRec</title></Head>`; in an SPA the title survives navigation, so those were ten copies of one string. A page that ever needs its own sets `document.title` in an effect — don't reintroduce a head-management library for it.

### Routing (`src/App.jsx`)
**There is no file-based routing.** `src/App.jsx` holds the whole route table, and every route sits inside one of two layout routes: `PublicLayout` (marketing header, no sidebar) for `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, and `DashboardLayout` (fixed icon `Sidebar` + `Header`) for everything authenticated. Both layouts render `<Outlet/>` where they used to take `children`.

This replaced `_app.jsx`'s `PUBLIC_ROUTES` set, and the change is worth keeping: **a new route cannot be added without choosing a shell for it**, because the shell is where you nest it rather than a list you might forget to update. Files still live under `src/pages/`, but the folder is a convention now — nothing routes from it.

`*` is caught by `pages/404.jsx` inside the public shell. Next served a built-in page for unmatched URLs; a router has to be told, so that page had to be written.

- `/` — public landing page (`pages/index.jsx`), the only public page with real content (hero + two CTAs).
- `/dashboard` — authenticated home. Not `/` — that's the landing page.
- `/inbox` — dashboard page, still an empty placeholder.
- `/appointments` — «Записи»: **an empty page on purpose.** Two designs have been built and both were taken down before a third — v1, a 24-hour scrolling time grid, removed 2026-08-17 and now only in commit `1e0c045`; v2, a month calendar with a day column, removed 2026-08-18 into `frontend/src/archive/appointments-v2/` (its README says what each file did and how to restore it). Each was taken down rather than edited in place so the next one is drawn without the previous layout deciding anything.

  Three things about that archive are worth knowing before touching this route. **The folder mirrors `src/`**, so restoring is a copy and the imports inside the files need no rewriting — which also means those imports dangle where they sit, harmlessly, since nothing there is bundled or import-resolved. **The data layer stayed in `src/lib`** (`api.js`'s booking endpoints, `appointments.js`, `dates.js`): a screen is what keeps being redrawn, and the rules underneath it are what v3 starts from — they are currently imported by nothing and tree-shaken out of the build. And **the route itself stays registered**, rendering a bare page ground: the sidebar has a «Записи» item, and an empty page is an honest answer where a 404 is not.

  The backend is untouched by any of this and is the finished part — see **Bookings** below.
- `/business` — "Бизнес": the owner-facing configuration route. **One page, no tabs** — it had an «О бизнесе» / «ИИ-ассистент» strip and the second was a placeholder, so the strip cost a row of chrome on every visit to offer a choice that did not exist; assistant settings will arrive as another card here, or as their own route if they outgrow the page. It's a real route rather than a profile-dialog section on purpose — a service list, a schedule and a staff roster don't fit a 520px dialog, and this is day-to-day work rather than account admin. The profile overlay is strictly "мен": account, security, subscription, app settings.
**There is no `/profile` route** — the whole profile area is an overlay, not a page. See "Profile overlay" below.
- `/login` and `/signup` — built, intentionally near-identical: no `<label>`s (inputs use `placeholder` only); password field has a show/hide toggle (local `showPassword` state flips the `input type` between `password`/`text`); a `<hr>` sits below the submit button, followed by "Continue with Google" / "Continue with Apple" buttons (`public/google_logo.svg`, `public/apple_logo.svg`) — **UI only, not wired to real OAuth**; a bottom line cross-links to the other page (`Log In` / `Sign Up` in accent blue `#3248F2`). `login.jsx` also has a row the signup page has no counterpart for — a «Запомнить меня» checkbox on the left and the "Forgot password?" link on the right, paired onto one line because the link already sat alone there and the checkbox carries the same weight. It's a **native `<input type="checkbox">` with `appearance-none`**, not a Radix one: space-to-toggle, form semantics and focus are already right, and Radix is for behaviour that is hard, never for looks. Both controls carry `py-2.5 -my-2.5`, which grows the tap target to 38px while the negative margin keeps the row 18px in the layout. `login.jsx` also shows a green success banner when `?reset=success` is in the URL. Keep the two pages in sync when restyling one — they're meant to stay visual twins. Both submit to the backend (see the auth-wiring note above) and show inline errors — `login.jsx` a single message above the `<hr>`, `signup.jsx` per-field messages (from 422 `fields`) plus the same general-error line for 409s/network failures. Every text input across `login.jsx`/`signup.jsx`/`forgot-password.jsx`/`reset-password.jsx` blocks whitespace client-side (a `/\s/.test(value)` check turns the border red with a "No spaces allowed." message) — the backend also rejects it, this is just an earlier signal. All four forms set `noValidate` on the `<form>` so the browser's native validation bubble (e.g. Chrome's built-in "must contain @" tooltip on `type="email"`) never appears — every message shown is ours.
- `/forgot-password` — email-only form; posts to `/auth/forgot-password` then pushes to `/reset-password?email=<email>` regardless of whether the address is registered (the backend response is deliberately identical either way).
- `/reset-password` — the six-digit code screen. Reads `?email=` with `useSearchParams` and returns `<Navigate to="/forgot-password" replace/>` when it is missing. **This used to be `getServerSideProps`**, and the reason was specific to Next: for a page with no data fetching it deferred `router.query` until after hydration, so reading the address on the client rendered a blank frame on every hard load. A router that only runs in the browser has the search string on the first render, so the guard is an early return — and the page no longer needs a server to render at all. The code itself is entered via `components/OtpInput.jsx` — six boxes with auto-advance, backspace-to-previous-box, and paste-fill, shared with the profile's email-change step. A wrong code clears the boxes and shows a red message; "Resend code" re-calls `/auth/forgot-password` with a 30s client-side cooldown. On success it redirects to `/login?reset=success`.

Every page supplies its own `<Head><title>AIRec</title></Head>` — there's no shared default title, so new pages need their own.

### API client (`src/lib/`)
- `lib/api.js` — the only place that calls the backend. One `request()` helper does the `fetch`, reads `import.meta.env.VITE_API_URL`, and throws `ApiError` (`.code`, `.message`, `.fields`, `.status`) on any non-2xx or network failure, parsed straight from the backend's `{error: {...}}` envelope. Add new endpoints as small named exports here (`register`, `login`, `refresh`, `logout`, `me`, `checkUsernameAvailability`, `forgotPassword`, `resetPassword`, `updateProfile`, `requestEmailChange`, `confirmEmailChange`, `cancelEmailChange`, `getPendingEmailChange`, `requestPasswordChange`, `confirmPasswordChange`, `listSessions`, `revokeSession`, `revokeOtherSessions`, `deleteAccount`, `restoreAccount`, `getBusiness`, `updateBusiness`, `uploadBusinessLogo`, `deleteBusinessLogo`, `getServices`, `saveServices`, `getWorkingHours`, `saveWorkingHours`, `uploadAvatar`, `deleteAvatar`) rather than calling `fetch` from a page. Two details worth knowing: `request()` takes `formData` instead of `body` for uploads and deliberately omits `Content-Type` in that case — the browser must set its own multipart boundary. And `mediaUrl()` exists because uploaded files are served from the backend *root* (`/media/...`), not under the `/api/v1` prefix that `VITE_API_URL` points at, so `user.avatar_url` has to be resolved through it before use in an `<img src>`.
- `lib/auth.js` — token storage across **both** `localStorage` and `sessionStorage` (`saveTokens`, `getAccessToken`, `getRefreshToken`, `clearTokens`, `isAuthenticated`) — see «Запомнить меня» below, `verifySession()` (the real check: `me()`, falling back to `refresh()` and re-saving tokens on success, clearing them and returning `null` if both fail), and two hooks built on it: `useRequireAuth()` (used by `DashboardLayout`, redirects to `/login` and returns `null` until a session is confirmed — callers must not render children until it returns a user; it returns the **user object**, not a boolean, so the shell can render their avatar without a second `/auth/me` call) and `useRedirectIfAuthed()` (used by `login.jsx`/`signup.jsx`, bounces a visitor with a live session to `/dashboard`). `isAuthenticated()` is a cheap presence-only check — reach for `verifySession()` instead anywhere the answer actually needs to be correct.

### Dashboard shell
- `Sidebar.jsx` — fixed 64px icon-only rail (`#171215` bg). Nav items are a hardcoded `navigation` array; active state matches `router.pathname`; each item shows a hover tooltip. Pinned at the bottom, separate from that array, is the profile avatar — a **toggle button, not a link**: it opens `ProfileMenu`. `DashboardLayout` passes the whole `user` down (plus an `onUserChange` setter) so the rail avatar, the popup, and the settings dialog all share one fetched user.

### Profile overlay — no routes involved
The profile area is **entirely overlay-based**; there are no `/profile/*` pages, and `Header.jsx`'s `pageTitles` has no entry for it, so the page underneath keeps its own title. Three pieces, all owned by `Sidebar`:

- `ProfileMenu.jsx` — the popup anchored beside the sidebar's avatar button: identity header, the section list, then **Sign out** at the bottom (the app's only sign-out control — it calls `/auth/logout` best-effort, then clears local tokens regardless). Section entries are **buttons that open the dialog**, not links. It owns its own dismissal (outside click, Escape); the `data-profile-menu-toggle` attribute on the sidebar button is what stops an outside-click handler from closing and instantly reopening it on the same press.
- `ProfileDialog.jsx` — the modal the sections open into. There's no navigation inside it: switching sections means going back to the popup. `account` (`components/profile/AccountSettings.jsx`) and `security` (`components/profile/SessionsSettings.jsx` — the active-sessions list plus the red "Удаление аккаунта" zone at the bottom) have real content; the rest render `ComingSoon`. **Panel size is per-section**: every section shares one fixed `728×580` box so the window doesn't jump between openings, except `account`, which is a narrow `520px` column that grows downward with its content (a wide box left it stranded in the middle).
- `components/profile/sections.js` — the single `PROFILE_SECTIONS` array both of the above read. **Add a section here and it appears in both**; there's no page to create. `label` is the menu entry; an optional `dialogLabel` overrides the dialog heading when it should read differently (the menu says "Профиль", the heading says "Редактировать профиль").

Two layering details that are easy to break: the avatar cropper is a modal *inside* a modal, so it sits at `z-[70]` above the dialog's `z-[60]`, and it tags itself `data-nested-overlay` — `ProfileDialog` checks for that in `onEscapeKeyDown` and calls `preventDefault()`, otherwise one Escape press closes both. (Outside-clicks need no such guard: the cropper renders inside the dialog's own subtree, so Radix never counts a click on it as outside.) And `AccountSettings` calls `onUserChange` after every save so `DashboardLayout` can refresh the avatar in the sidebar without another `/auth/me` round trip. **Photo changes are staged, not applied immediately** — a crop is held as `{blob, url}` (the object URL being the preview the avatar circle shows) and a removal as an `avatarRemoved` flag; both count toward `isDirty` and only reach `POST`/`DELETE /auth/me/avatar` when Save runs, ahead of the profile PATCH. The staging effect revokes the previous object URL when the crop is replaced.

**Email and password are not inline fields** — each is an `ActionRow` (read-only value + "Изменить") that opens its own step, because neither can be changed by simply saving the form. The email step has two phases (`emailStep`: `'address'` → `'code'`); the password step has two proofs (`pwMode`: `'password'` | `'code'`). Only first/last name and username are part of `FORM_ID` and `isDirty`.
- `Header.jsx` — sticky 68px top bar; page title comes from a `pageTitles` map keyed by route — update this map when adding a new dashboard route. On the right sits the notifications bell, a link to `/notifications` that highlights when you're on it. It lives here rather than in the sidebar rail because notifications are about *right now*, not about somewhere to navigate to; it carries no unread badge yet, since there's no backend to count.
- `/notifications` — reachable only from that bell. Renders a real empty state ("Пока нет уведомлений") rather than a `ComingSoon` placeholder: a new account genuinely has nothing there, so this is what the finished page looks like too.
- Leftovers from the AIReca → AIRec rename still sit in `Sidebar.jsx` (link `aria-label`) and `Header.jsx` (fallback title). Use "AIRec" in anything new, and fix those strings if you touch the surrounding code.

### Public shell
- `LandingHeader.jsx` — sticky **64px** header: the black logo image alone on the left (no wordmark), Log In / Sign Up buttons on the right. Reused by every `PUBLIC_ROUTES` page via `PublicLayout.jsx`. Any page under `PublicLayout` must offset its root container to match this header's actual height (see `Home.module.css`) — it has drifted from the dashboard's 68px through iteration, so don't assume they're equal.
- Logo assets: `BrandMark.jsx` renders `public/airec_logo.png`, a **white** mark on a transparent background — only visible on a dark surface (used in the dark `Sidebar`). `public/black_logo_icon.png` is the black variant, tightly cropped (no baked-in padding) for use directly on light backgrounds — used as-is (no wrapper badge) in `LandingHeader.jsx`. Pick whichever variant matches the surface color; don't badge-wrap one to force it onto the wrong background.
- Images are plain `<img src="/…">` from `public/`, not `next/image`, and some carry a `?v=N` cache-buster — bump `N` when replacing an asset in place. `src/assets/` is tracked but imported by nothing: it's a stash of source/design images, not a runtime asset dir.

### Styling convention
- Tailwind v4, configured entirely via the `@theme` block in `src/styles/globals.css` — there is no `tailwind.config.js`. It runs through **`@tailwindcss/vite`**, the first-party bundler plugin: there is no `postcss.config.mjs` and no `postcss` dependency, because the plugin replaces that whole chain.
- **Any plain (non-`@layer`) CSS rule in `globals.css` beats every Tailwind utility, regardless of specificity or source order** — `@import 'tailwindcss'` expands to named layers (`theme, base, components, utilities`), and per the cascade-layers spec, unlayered styles always outrank layered ones. `globals.css` learned this the hard way: a bare `button, input, textarea, select { font: inherit }` silently ate every `font-*`/`text-[…]` utility ever applied to a form control, project-wide, until it was moved inside `@layer base`. Any new global reset in this file must go in `@layer base` (or another named layer) or it will do the same thing again.
- Brand tokens: `--color-brand-blue #3248f2` (accent/CTA), `--color-brand-black #171215` (text/dark surfaces), `--color-brand-gray #999999` (borders, typically at 20–45% opacity), `--color-brand-soft #f6f8fa` (page background), `--color-brand-white #ffffff`.
- Components overwhelmingly reference these as raw Tailwind arbitrary values (`bg-[#171215]`, `border-[#999999]/25`) rather than the semantic `bg-brand-*` classes. Match that existing convention instead of switching styles mid-codebase.
- Fonts: Poppins (`font-display`, headings) and Roboto Variable (`font-sans`, body), loaded via `@fontsource` imports in `src/main.jsx`.
- Each page pairs with a CSS Module in `src/styles/` for its root container — the convention is `min-height: calc(100vh - Npx)` plus a background color, and nothing else. `N` must match the actual current height of that layout's header component (`Header.jsx` or `LandingHeader.jsx`) — check the header's `h-*` class rather than assuming a fixed number, since header heights get tuned independently. All other styling is inline Tailwind utility classes.
- Icons: `@hugeicons/react` + `@hugeicons/core-free-icons` via the `HugeiconsIcon` component — not emoji, not another icon set.
- No UI component library (no shadcn/ui, MUI, Ant Design, etc.). Components are hand-built with Tailwind. **Radix primitives are the one exception, and only for behaviour** — `@radix-ui/react-dialog` backs `ProfileDialog`; the business city picker is `@radix-ui/react-popover` + `cmdk` (`CitySelect.jsx`). It is *not* `@radix-ui/react-select`, which was tried first and removed: a select's keyboard handling is jump-to-letter rather than filtering, it owns every keypress, and there is nowhere inside it for a search box to live. For a filterable list of eighty-odd options, a combobox is the primitive, and cmdk is the piece that supplies the filtering and arrow-key/ARIA wiring. Reach for one when a widget's *behaviour* is hard to get right (focus trapping, keyboard navigation, ARIA wiring: dialog, popover, select, dropdown, tabs), never for its looks. shadcn/ui was considered and deliberately not adopted: it is Radix plus a default Tailwind skin built on `--background`/`--foreground` CSS variables, and this project's design language is fixed and unusual enough that the skin would be discarded — leaving a second token system, a path alias and a TS-first codegen to maintain for nothing. Take a single shadcn source file (its `Calendar`, say) if it saves real work; don't adopt the system.

### Palette — five brand colours, open to more

`src/assets/color_font.webp` is the brand, and `@theme` in `globals.css` matches
it. These five are the **base** every screen is built out of:

| Token | Hex | What it is for |
| --- | --- | --- |
| accent | `#3248F2` | the colour that means *this one* |
| ink | `#171215` | text, dark surfaces, tooltips |
| muted | `#999999` | borders (at 15–30%), secondary text |
| ground | `#F6F8FA` | the page behind the cards |
| surface | `#FFFFFF` | the cards themselves |

**They are not a ceiling.** Colour may be added wherever it carries meaning the
five cannot: category badges, statuses, and per-item identity such as
`BOOKING_COLORS` in `lib/appointments.js`, which gives each of a day's bookings
its own hue so one can be told from another at a glance. Two things keep an open
palette from turning into noise:

- **A new hue should say something.** Decoration is what makes a screen loud;
  a hue that distinguishes one row from another is doing work.
- **Match the family.** New colours sit in the same saturation and lightness
  band as `#3248F2` so they read as one set rather than as stickers.

`#16A34A` and `#DC2626` keep their meaning — up/down, ok/error — so avoid them
as decorative choices where a reader could take the signal literally.

**Tints are the colour at low alpha** (`bg-[#16A34A]/8`, `bg-[#3248F2]/[0.06]`)
rather than a separate pastel hex, so a tint always tracks the colour it came
from. Filled buttons darken on hover — `#2839C9` and `#B91C1C` — because
lowering alpha would lighten them against white, the wrong direction.

**Typefaces are `Poppins` (`font-display`) and `Roboto` (`font-sans`).** The
reference sets every heading *and every number* in Poppins; that is most of what
gives it its look, so a metric in the body face is off-style even when the size
is right.

### Type scale — measured off the reference

| Role | Size | Weight | Family |
| --- | --- | --- | --- |
| Page title | 28 | 600 | display |
| Metric value | 32 | 700 | display |
| Secondary value (funnel, donut centre) | 24 | 700 | display |
| Card title | 15 | 600 | display |
| Body, table cell | 14 | 400 | sans |
| Secondary text, delta line | 13 | 400 | sans |
| Axis label, table head | 11 | 500 | sans (heads `uppercase tracking-wide`) |

Two rules the reference keeps and a screen fails without: **one thing per screen
is at 32**, and **never place two adjacent steps side by side** — 15 next to 14
reads as a mistake, 32 next to 13 reads as a hierarchy.

Spacing is `4 / 8 / 12 / 16 / 24 / 32 / 48`. Card padding 24, gap between cards
24. Radius: cards `rounded-2xl`, controls and pills `rounded-lg`–`rounded-xl`,
icon badges `rounded-lg`, avatars and bar ends fully round.

**Tooltip** — `bg-[#171215] text-white rounded-lg px-3 py-1.5 text-[13px]` with a
shadow. It is one of the few things allowed to float.

### Dashboard visual language
**This is the design direction for the product**, taken from `src/assets/main_page.webp` — every dashboard screen still to be built (Главная, Диалоги, Записи, Бизнес, Уведомления) starts from it, and existing screens are brought in line as they're touched rather than in a separate pass.

The numbers below are **defaults, not prohibitions**. They exist so that a screen built without a decision still comes out consistent; deviate where the screen is better for it, and where you do, say why in a comment so the next reader knows it was chosen rather than missed.

**Cards.** Page content lives in cards on the `#F6F8FA` page ground:

```
bg-white  rounded-2xl  p-6  →  gap-6 between siblings
```

**Elevation is allowed, in three steps.** White on the grey ground already separates a card, so a shadow is there to give the surface weight, not to hold it up — which is why every step below is wide, soft and low-opacity rather than a dark edge under the box:

```
resting card   shadow-[0_1px_2px_rgba(23,18,21,0.04),0_8px_24px_-12px_rgba(23,18,21,0.10)]
interactive    hover:shadow-[0_2px_4px_rgba(23,18,21,0.05),0_12px_32px_-12px_rgba(23,18,21,0.16)]
floating       shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)]   dialogs, menus, tooltips
```

Keep the gap between *floating* and the other two: it is the cue that separates "a layer over the page" from "a block on it". A hairline (`ring-1 ring-[#171215]/6`) may accompany a shadow where the card sits on white rather than on the grey ground.

**Prefer a divider to a second card.** Internal grouping reads best as a `1px` line (`border-[#999999]/15`) plus a small muted label; four related KPIs as **one card split by hairlines into a 2×2** is the single most characteristic move of this style, and four separate cards say they are four subjects. Nest a card only when the inner thing really is its own object.

**Card header.** Title at `text-[15px] font-semibold`, optional control on the far right: either a small pill (`rounded-lg border border-[#999999]/25 px-3 py-1.5 text-[13px] text-[#999999]`, e.g. «За неделю ⌄») or a `•••` menu button. Nothing else competes at the top of a card.

**Numbers are the loudest thing on screen.** A metric is three stacked lines: label `text-[14px] text-[#999999]`, value `text-[32px] font-bold tracking-[-0.02em] text-[#171215]`, then a delta line — coloured percentage (`#16A34A` up / `#DC2626` down) followed by muted context («+12% за 28 дней»). Nothing between those lines but tight spacing.

**Charts carry little chrome.** No gridlines, no axis lines, no borders, no legends boxed off. Axis labels are `text-[11px] text-[#999999]`. Sparklines are a bare 2px stroke, green or red, no fill, no dots. Bars are fully rounded pills (radius = half the bar width), `#3248F2` for the one bar being highlighted and `#3248F2` at ~12% for all the rest. An area chart is a soft accent-tinted gradient that bleeds to the card's bottom edge, clipped by the card radius.

**Tables carry no frame.** Column headers are `text-[11px] uppercase tracking-wide text-[#999999]`; rows are separated by air and, at most, a `#999999/15` line — never vertical dividers, never zebra striping, never an outer border. Status is a tinted pill: `bg-[#16A34A]/10 text-[#16A34A]` / `bg-[#DC2626]/10 text-[#DC2626]`, `rounded-md px-2.5 py-1 text-[12px] font-medium`. Amounts right-align.

**Spend the accent sparingly.** In the reference `#3248F2` appears about four times — the active nav item, one highlighted bar, one donut segment, one icon badge — and everything that is data-but-not-the-point wears the lavender tint instead. The count is not a quota; the point is that the accent means *look here*, and a screen where every series is blue has nothing left to point with.

**Icon badges**, where a metric needs one, are `h-7 w-7 rounded-lg` with a solid fill and a white glyph. A hue other than the accent belongs here readily — the badge labels a distinct category, which is exactly the work a colour should be doing.

**Where the app still diverges from the reference**, listed so it is a decision
rather than a drift:

- **The shell is flush; the reference floats.** There, the whole app is a
  rounded container inset on the grey page, with the dark rail rounded on its
  left corners. Ours is a 64px rail hard against the window edge and a 68px
  header. Adopting the frame is structural, so it is not assumed.
- **The header shows a 15px breadcrumb; the reference shows a 28px page title**
  beside a search pill (`bg-[#F6F8FA]`, magnifier left, `⌘K` right in muted).
- **Cards mostly carry no shadow yet.** They were written under a no-elevation
  rule; the three steps above are the target as screens are touched.

### UI language — Russian, everywhere
**Every user-facing string is Russian**: the public flow, the dashboard chrome, the profile overlay, all `aria-label`s and `placeholder`s, and — this part is easy to forget — **every message the backend can return**. `index.html` sets `<html lang="ru">`. Write new copy in Russian; don't reintroduce English strings, and translate the backend side of any new endpoint at the same time as its UI.

Making the backend fully Russian took two non-obvious pieces, both in play for any new field you add:

- **Pydantic's own validation messages are English and can't be localised in place.** Where the text matters, the constraint is enforced by a `field_validator` raising a Russian `ValueError` instead of by `Field(min_length=...)` — that's why `Password` is a plain `str` with `validate_password_length` / `validate_new_password` attached, rather than an annotated constrained type. For the few built-ins a client can still trigger, `app/main.py` keeps a `_PYDANTIC_MESSAGES_RU` map keyed by Pydantic's error `type`.
- **`EmailStr` reports through `value_error`, the same type our own validators use**, so it can't be told apart by type — `_field_message` matches it on the message text prefix instead and swaps in "Некорректный email."

Ruff's `RUF001`-`RUF003` ("ambiguous unicode character") are disabled in `pyproject.toml` for this reason: Cyrillic that resembles Latin is the whole point here, not a typo.

## Backend architecture (`backend/`)

FastAPI + SQLAlchemy 2.0 async + asyncpg + PostgreSQL 18, migrated with Alembic. See `backend/README.md` for the endpoint table and setup steps.

### Layering — keep the direction of dependency
`app/api` (HTTP) → `app/services` (rules) → `app/repositories` (queries) → `app/models`. Services raise `AppError` subclasses from `app/core/errors.py` and must never import FastAPI or raise `HTTPException`; `app/main.py` owns the mapping from error to response. Repositories own all query construction — don't write `select()` inside a service or route.

Every failure leaves the API in one envelope, `{"error": {"code", "message"}}` (422 adds a `fields` array), so the frontend needs only one parser. Preserve that shape when adding endpoints.

### Auth model — the non-obvious parts
- **Argon2id runs on a worker thread** (`anyio.to_thread` in `app/core/security.py`). Hashing inline in an `async def` would stall the event loop for every concurrent request — keep any new password work on that path.
- **Login always performs a verification, even with no matching user**, against a module-level dummy hash. That's deliberate: it stops response timing from revealing which accounts exist. Don't "optimise" the early return away.
- **«Запомнить меня» is two halves, and neither works alone.** `POST /auth/login` (and `/auth/restore`, the same schema) takes `remember`, which picks the refresh token's lifetime — `refresh_token_ttl_days` (30) against `refresh_token_session_ttl_hours` (12) — while the client picks the store it keeps the token in: `localStorage` when remembered, `sessionStorage` when not. Doing only the client half leaves a credential live on the server for a month that nobody holds, showing up in «Активные сессии» as a device that has not existed since Tuesday; doing only the server half leaves the token on a shared machine's disk. The flag lives on `refresh_tokens.remember` and is **carried across rotation exactly like `family_id`** — otherwise it would last one refresh, and a session the user asked not to remember would promote itself to thirty days the first time its 15-minute access token expired. `change_password` reads it off the caller's live token *before* revoking everything, for the same reason. `_issue_tokens` takes it as a **keyword with no default**, so each of the five places that mint a pair states its own answer rather than inheriting one silently — registration says `True` (an account is made on its owner's own machine), a password change inherits, a refresh carries.

  Two defaults that deliberately disagree: the **schema** defaults `remember` to `False`, so a client that forgets the field fails safe toward a session that ends too early; the **login form** ticks the box, because AIRec is a panel its owner opens every morning and defaulting to off would sign them out every night and read as a bug. `signup.jsx` has no checkbox at all — the one case where it would matter, registering on a borrowed computer, is answered by signing out. And `sessionStorage` is per-tab, so an unremembered session asks for the password again in a second tab; that is what the choice describes, and the other reason the box starts ticked.
- **Access token is a stateless 15-min JWT; the refresh token is opaque and stored only as a SHA-256 digest.** The digest is what makes logout/revocation real. Refresh tokens rotate on every use, and replaying an already-rotated token is treated as theft — it revokes every session for that user.
- **Sessions are token families, not rows.** Because rotation revokes the token it replaces, a signed-in device has exactly one live `refresh_tokens` row at any moment — which is why `GET /auth/me/sessions` is a plain `revoked_at IS NULL AND expires_at > now()` query rather than a grouping. What survives rotation is `family_id`, carried onto every replacement together with `user_agent`, `ip_address` and `first_seen_at`; `created_at` therefore means "last refresh" and is what the UI shows as last activity. The access token carries the family as a `sid` claim, which is how the listing marks the caller's own row without a client ever sending its refresh token to a read endpoint (`sid` is optional when decoding — tokens minted before this existed simply lose the marker). `app/core/useragent.py` turns the stored header into a label like "Chrome, Windows"; it is a handful of substring checks on purpose, since the only job is helping someone recognise their own device. Device details are read in the route and handed to the service as a plain `ClientInfo` dataclass, keeping FastAPI out of the service layer.
- **Identity casing:** emails are normalised to lowercase in the schema layer and get a plain unique index; usernames keep their typed casing but are unique case-insensitively through a `lower(username)` unique index, which also backs the login lookup. `AuthService._conflict_for` matches on the constraint names `uq_users_email` / `uq_users_username_lower` — rename either index and that mapping breaks silently.
- **Live username check:** `GET /auth/username-availability?username=` (public, no auth) backs the signup form's real-time green-tick/red-warning UI. `AuthService.check_username_available` treats a malformed username as unavailable without hitting the database — it never has to distinguish "invalid" from "taken" for the caller, both just render as "not available" (see `signup.jsx`).
- Registration pre-checks duplicates for a precise message, but the unique indexes are the actual guarantee; a race surfaces as `IntegrityError` and is mapped back to the same 409.
- **Password policy is charset + length, checked on registration only.** `Password` (shared by register/login) enforces 8–128 chars; `RegisterRequest` additionally runs `_validate_password_charset` against `PASSWORD_CHARSET_PATTERN` in `app/schemas/auth.py` — Latin letters, digits, and a fixed symbol set, no whitespace or other scripts. Login doesn't re-check the charset since a stored password was, by construction, already valid at registration time. `app/main.py`'s `_field_message` strips the "Value error, " prefix Pydantic v2 glues onto `raise ValueError(...)` messages from field validators — write new validator messages assuming that prefix is gone. `signup.jsx` mirrors the rule as a static hint under the password field, swapped for the live `422` message on failure; `login.jsx` doesn't need either since it's just entering an existing password.

### Account deletion is a grace period, not a delete
`POST /auth/me/delete` sets `users.deleted_at` and revokes every refresh token; **nothing is removed** until `account_deletion_grace_days` (default 30) has passed. `deleted_at` is deliberately separate from `is_active` — one is the user's own reversible decision and carries a deadline in its message (`AccountDeleted`, with the date), the other is an administrator switching an account off. Authentication, refresh, *and* `get_current_user` all reject a deleted account, the last of those because the access token that performed the deletion stays cryptographically valid for its remaining minutes.

**The proof is the current password plus typing the username — no emailed-code alternative.** Reusing `password_reset_codes` here would mean a code issued to change a password could also delete the account, which is not a trade worth making. The confirmation string is compared case-insensitively.

`POST /auth/restore` {identifier, password} clears `deleted_at` and signs the user back in; `login.jsx` offers it automatically when a sign-in fails with code `account_deleted`, since the credentials were already accepted. Restoring an account that isn't deleted just signs in normally.

**The purge is what actually deletes**, and it runs from `app/main.py`'s lifespan at startup — this project has no scheduler, so that is what makes the 30 days real. It only removes rows whose `deleted_at` is past the cutoff, cascades to tokens and codes, and deletes avatar files **after** the commit (a restored account should come back with its picture). Point a cron at `AuthService.purge_deleted_accounts` when there's somewhere to run one. Note the consequence of soft deletion: **the email and username stay taken for the whole grace period**, which the deletion UI says out loud.

### Password reset flow
`POST /auth/forgot-password` {email} → **deliberately the one enumeration-unsafe endpoint in this API**: unlike login, it raises `EmailNotRegistered` (404) when the address isn't registered instead of pretending to succeed — a conscious trade of that leak for a clearer frontend error message. If the user exists, it invalidates any prior unused code (`PasswordResetRepository.invalidate_all_for_user`) and issues a new one via `generate_reset_code()` — a `secrets.randbelow`-sourced 6-digit string, stored only as a SHA-256 digest on `PasswordResetCode`, expiring after `password_reset_code_ttl_minutes` (default 10).

`POST /auth/reset-password` {email, code, new_password} verifies against the user's *latest* unused code — scoped by `user_id` before comparing hashes, deliberately, because a 6-digit code only has ~1M possibilities and a global (cross-user) hash lookup risks a coincidental collision. A wrong code increments `PasswordResetCode.attempts`; at `password_reset_max_attempts` (default 5) the code is dead even if the *correct* one is subsequently tried — this attempt counter, not the hash, is what actually protects a code this short-entropy from brute force, since there's no rate-limiting middleware in this project to lean on instead. On success it revokes every refresh token for that user (`RefreshTokenRepository.revoke_all_for_user`), the same "something was wrong, kill all sessions" move as replayed-refresh-token theft-response.

**Email delivery has a dev-mode fallback by design.** `app/core/email.py` sends via `smtplib` (blocking, so it runs through `anyio.to_thread` like Argon2 and refresh-token hashing) only when `settings.smtp_host` is set. With no SMTP configured — the default in `.env.example` — it logs the code as a `WARNING` to the server console instead and returns; this is what makes the flow testable locally without a mail account. Fill in `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`/etc. in `.env` to actually send mail.

**Changing a password from inside a session takes either of two proofs, never both.** `POST /auth/me/password-change/confirm` accepts `{new_password, current_password}` *or* `{new_password, code}` — a `model_validator` on `ChangePasswordRequest` rejects sending neither or both, so the service never has to guess which branch it's in. Neither proof dominates: the password path survives losing the mailbox, the code path survives the password having leaked, and both require more than a live session. The UI defaults to the password path (no email round trip) with a "Не помните пароль?" link that calls `POST /auth/me/password-change` (auth required, no body) to mail a code and switch modes. Both go through `password_reset_codes` rather than a third near-identical table, because both flows authorise exactly the same thing — "set a new password for this user" — so the latest code winning across both is the behaviour you want. `AuthService._consume_reset_code` is the shared validator (expiry, attempt ceiling, digest compare, attempt increment); `reset_password` and `change_password` differ only in what they do afterwards. The confirm endpoint **revokes every refresh token including the caller's own and returns a fresh `TokenPair`** — that's what logs out other devices without logging out the device doing the change, and `AccountSettings` must `saveTokens()` the response or the next request 401s.

`ResetPasswordRequest.new_password` reuses `validate_password_charset` (the standalone function `RegisterRequest` also uses) rather than duplicating the charset check — if the password policy changes, both call sites move together.

### Profile and avatars
`PATCH /auth/me` is a true partial update: `UpdateProfileRequest` has every field optional and the service reads it with `model_dump(exclude_unset=True)`, which is what separates *"field omitted → leave it alone"* from *"field sent as null → clear it"*. Changing `username` to a different casing of the same name must not 409 against the user's own row — `AuthService.update_profile` compares lower-cased before running the uniqueness check.

**Changing the email is a separate, verified flow — `PATCH /auth/me` has no `email` field at all.** Accepting it there would let a client set an address it doesn't own. Instead `POST /auth/me/email-change` {new_email} emails a 6-digit code **to the new address** (receiving it is the proof of ownership) and stores a pending `EmailChangeCode` row — `users.email` is untouched until `POST /auth/me/email-change/confirm` {code} succeeds. The code table mirrors `PasswordResetCode` (SHA-256 digest, TTL, `attempts` counter as the real brute-force defence, latest-unused-per-user lookup scoped by `user_id`), and confirmation **re-checks that the address is still free** — it may have been registered by someone else while the code sat unused. `app/core/email.py`'s `_code_email_html` is shared by both flows; only the heading and lead line differ. `GET /auth/me/email-change` reports the address still awaiting confirmation (null once it expired or ran out of attempts, so the UI never offers a "confirm" that cannot succeed) — that's what lets `AccountSettings` show a persistent **Не подтверждён** banner with a Подтвердить button after the dialog is closed and reopened. `DELETE /auth/me/email-change` abandons it (idempotent, and the abandoned code stops working immediately) — without that the banner would sit there until the code expired, with no way to take back a mistyped address.

**`users.email_verified_at` is what "confirmed" actually means** — set only by `confirm_email_change`, exposed as the computed `User.email_verified` in `UserPublic`. **Registration never verifies**, so every account starts unverified and migration `0007` deliberately backfills nothing. That's also why `request_email_change` accepts the account's *own current* address when it is still unverified (and only then raises `SameEmail`): sending a code to the address you already have is how an existing account proves it. `confirm_email_change` skips the "already registered" re-check in that case, since `email_exists` would match the user's own row. The status strip under the Email field reads from this: pending change → red with the new address, unverified → red with a Подтвердить that sends the code, otherwise green **Подтверждён**.

**Names are stored split** — `User.first_name` / `User.last_name` (50 chars each). `full_name` is a **computed property** joining the two, not a column, so there's no stale joined copy to keep in sync; it's still in `UserPublic` for callers that just want a display name. Migration `0005` split the old `full_name` column (first word → `first_name`, remainder → `last_name`). `AccountSettings.jsx` edits the two parts and reads `user.full_name` only for the identity strip.

Uploaded images live on local disk (`backend/uploads/`, gitignored) and are served by `StaticFiles` mounts. `app/core/images.py` owns all of it: an `ImageStore` is just a directory plus a URL prefix, and there are two — `AVATAR_STORE` and `LOGO_STORE`. **They're kept apart deliberately**: an avatar dies with its user and a logo with its business, so mixing them would make a cleanup pass over either one dangerous. The DB column holds the **filename only**; `User.avatar_url` and `Business.logo_url` are computed properties that prepend the prefix, so storage can move without a data migration. Every upload is re-decoded and re-encoded through Pillow rather than stored as sent — that's what rejects non-images and strips EXIF or any payload hidden in a valid-looking file, and it runs on a worker thread for the same reason Argon2 does. Old files are deleted only *after* the new row commits, so a failed write never orphans the existing image.

### The business behind an account
`Business` (`app/models/business.py`) is where everything the assistant sells hangs off — services, hours and bookings will belong to it, not to `users`, because a business will eventually have more than one person attached. One per account for now: `owner_id` is **unique**, and `BusinessRepository` deliberately exposes no `get_by_id` — every read is scoped by owner, so no endpoint is one refactor away from serving one account's data to another.

**The price list and the week are saved whole, not row by row.** `PUT /business/services` takes the entire list: an item with an `id` is updated in place, one without is created, and anything the list omits is deleted — all in one transaction. That matches how the card is edited (fix three prices, rename one service, then press Save once) and means the list can never be left half-applied. Matching on id rather than rebuilding the table is what keeps a service's identity — and, later, its bookings — across an edit; an id belonging to another account simply doesn't match, since the lookup is scoped to this business, so it is created as new instead of touching a foreign row. The frontend tags locally-added rows with a `new-…` id, which `serviceToApi` converts to `null`.

`working_hours` is always **seven rows** — a missing row and a closed day have to read differently, so `GET` creates the week on first access (Mon–Sat 10:00–20:00, Sunday closed; a guess meant to be corrected, but a better starting point than an assistant that can never book). `weekday` is `0 = Monday`, matching Python's `datetime.weekday()` and the frontend's `WEEKDAYS` array, so no translation table exists to get out of step. Times are `time` columns, not text, and are serialised back as `"HH:MM"`. A break sent on a closed day is dropped rather than stored, or it would reappear the moment the day was reopened.

**Round the clock is `is_24h`, a boolean — not `00:00–00:00` and not `00:00–23:59`.** Both encodings are guesses a reader has to decode, and the second silently loses a minute a day that a slot generator would then have to forgive. The flag leaves `opens_at`/`closes_at` **null**, and `replace_working_hours` clears them (and the break — nothing can interrupt a day that never closes) whenever it is set, so the two can never be read disagreeing with each other. `WorkingHours.is_open` returns true for such a day. It is marked **per day**, from a «24 ч» chip sitting between the day name and its opening time — a whole-week pill in the card header was tried and removed; the per-day mark is the primitive, and "24/7" is just all seven of them set. The chip stays visible while off (muted, 12px) rather than appearing on hover: it's the only place in the product that offers a round-the-clock day, so a hover-only affordance would leave the feature undiscoverable.

**A day must be readable as opening hours before it can be saved.** `WorkingHoursInput`'s `_coherent_day` model validator refuses a closing time at or before the opening one, an opening without a closing (or vice versa), a half-specified break, and a break that falls outside the working day. It sits on the schema rather than in the service because every rule compares two fields of the same row. **A close before an open is rejected, not read as running past midnight** — the two columns can't express "the next day", so interpreting it would turn a typo into a twenty-two-hour day; an all-night business sets `is_24h` instead. That is a real limitation for a bar open 18:00–02:00, and the fix is an explicit overnight flag, not a silent wrap. `frontend/src/lib/schedule.js`'s `dayProblem` mirrors the same rules — not out of distrust, but because a 422 arriving after Save names a weekday *number*, and the owner is looking at a row. It's imported by both `WorkingHours.jsx` (prints the message under the offending row) and `BusinessProfile.jsx` (disables Save), so there's one rule rather than two that agree until one is edited.

**Every time in this product sits on a 15-minute grid**, enforced in `app/schemas/service.py` (`SLOT_MINUTES`) on all four working-hours times *and* on `duration_minutes`. Booking is fitting durations into gaps between hours, and that arithmetic only stays exact while both sides share one unit — a 40-minute service against a 10:05 opening leaves offcuts nothing else can fill. The validator is on the schema, not trusted to the pickers, since the pickers aren't the only possible client; it drops seconds rather than rejecting them (`"10:00:00"` plainly means ten o'clock). `WorkingHours.jsx`'s `TIME_OPTIONS` is 96 entries and `BusinessProfile.jsx`'s `DURATION_OPTIONS` steps by 15 to match. Ninety-six options is why the time fields pass `searchable` and why `OptionPicker` seeds cmdk's highlighted value on open — otherwise the menu opens at 00:00 with the current value far below the fold.

**It's created lazily, on first `GET /business`, not at registration.** Signing up shouldn't decide anything about the company, and this way an account that never opens the page carries no half-filled row — while every other endpoint can still assume a business exists instead of carrying a "not set up yet" branch. `timezone` is the one column with a default (`Asia/Almaty`) and the one `PATCH` refuses to null: a time stored without knowing its zone can't be repaired afterwards, and that has to be true *before* the first booking exists.

### Bookings
`Appointment` (`app/models/appointment.py`) is what the whole product produces. Five statuses (`pending` → the assistant's own output, then `confirmed` / `completed` / `cancelled` / `no_show`), and **only `cancelled` gives the time back** — `BLOCKING_STATUSES`. A no-show still happened *to that slot*; treating it as free would let the past be double-booked the moment anyone looked at it.

**Archiving is a third thing again, and it is a *view* flag.** `PATCH {"archived": true}` stamps `appointments.archived_at`; listings by date drop archived rows, but the search (`?query=` alone) keeps them, since a booking put out of the way is exactly the kind you go looking for by name. Crucially `list_blocking` passes `include_archived=True`: archiving must never hand an occupied hour back out, or availability would depend on housekeeping. A timestamp rather than a boolean because "when was this put away" is free and `NULL` is the only value that can mean "never was".

**Cancelling and deleting are different acts.** Cancelling is a status (`PATCH {"status": "cancelled"}`) and keeps the row — it is what the owner looks back on to see how often bookings fall through, and the assistant needs to know it already spoke to this client about this time. `DELETE /appointments/{id}` removes the row outright, for one that should never have existed (a typo, a duplicate, a test): nothing fell through, so there is nothing to look back on, and leaving it as a cancellation would put a client in the history who was never booked. **`DELETE` used to cancel**, which made the verb say one thing and do another; the frontend helper was renamed `cancelAppointment` → `deleteAppointment` at the same time, so an old caller fails to build rather than quietly deleting what it meant to cancel.

**The service is both a foreign key and a copy.** `service_id` is `ON DELETE SET NULL`, and `service_name` / `duration_minutes` / `price` are snapshotted at booking time and never refreshed *by an edit to the price list*. The price list is edited constantly; without the snapshot, correcting one price would silently rewrite what every past booking cost. The key links a booking to a living service, the copy is what the booking *was*. `PATCH /appointments/{id}` may send a new `service_id` — a client asking for something different on arrival has changed the same booking, not made another one — and that path re-snapshots all three fields together, since a `service_id` sitting beside yesterday's name and price is a row disagreeing with itself. Because it can change the booking's length it counts as a move: `ends_at` is recomputed and opening hours and capacity are re-checked exactly as for a new `starts_at`. `ends_at` is likewise derived but stored, because every availability check is a range overlap and computing the end in SQL would rule out an index — `AppointmentService` is the only writer, so the two can't drift.

**All booking arithmetic happens in `app/services/appointment.py`, in absolute time, via `Window` tuples.** Opening times are wall-clock and can't express either half of the two things that actually matter: a break splits a day into two stretches, and midnight joins two days into one. `_windows_around` therefore builds the day *before*, the day, and the day *after*, then `_merge` joins any that touch — which is what lets a 23:45 booking run into a round-the-clock following day instead of being refused because the calendar changed date halfway through it. `available_slots` applies hours, breaks, existing bookings, `capacity`, `min_lead_minutes` and `booking_horizon_days` in one place; a caller that re-derived any of them would be a second implementation of the rules.

**`tzdata` is a hard requirement, not a nicety.** Windows ships no IANA database, so `zoneinfo` has nothing to read and every slot calculation raises `ZoneInfoNotFoundError`. It's pinned in `requirements.txt` for that reason, and `UpdateBusinessRequest` now validates `timezone` by constructing a `ZoneInfo` — an unknown name would otherwise only surface deep inside slot generation, reading as a broken calendar rather than a bad setting.

**Booking is read-then-write, so it takes a row lock.** `BusinessRepository.lock` does `SELECT … FOR UPDATE` on the business row before counting what occupies a time; without it two requests for the last place would both read "room for one" and both insert. Serialising per business costs nothing while bookings arrive seconds apart.

Where a booking sits is re-checked only when it has been *chosen* again (create, or a `starts_at` that actually moved) — marking a two-week-old booking as `completed` must not fail because its time is long past `min_lead_minutes`. Capacity, separately, is re-checked whenever the booking starts occupying something it wasn't: a new time, or a cancellation being taken back.

**`min_lead_minutes` defaults to `0` — there is no advance-notice rule unless a business asks for one.** "Can I come now?" is an ordinary question for a barbershop, and a client who walks in without ever opening WhatsApp still has to be written down. The column stays (migration `0015` only changed the default and zeroed the rows that carried the old hour), so notice can be switched back on per business without a migration.

**Notice and horizon constrain clients, not the business** — `_ensure_within_rules` *and* `available_slots` both take an `enforce_notice` flag, and `source` is what decides it. **The two must agree**: `GET /appointments/slots?source=` defaults to `manual` exactly as `POST /appointments` does, because a picker that hides times the create call would accept is a picker that lies — that mismatch is what made the panel refuse to offer 12:00 at 11:33 while the endpoint behind it would have taken it. With the flag off the whole day is offered, this morning included. A `manual` booking (the owner, from the panel) skips `min_lead_minutes` and `booking_horizon_days`: writing down someone who walked in twenty minutes ago is recording something that already happened, and refusing it would be refusing reality. A `whatsapp` booking gets both. Rescheduling always skips them, because every PATCH currently comes from the panel — when the assistant gets its own way in, it will have to say so. **Opening hours are deliberately outside that flag**: they catch a mistyped date just as well for the owner, and there is no version of "book me while you're closed" that is the right thing to record.

`GET /appointments?query=` searches client name **and phone, ignoring punctuation** — `_matches_client` strips non-digits from both the stored number and the query, so "7701", "701 555" and "+77015553322" all find a client saved as "+7 701 555 33 22". A query with no digits never touches the phone column. A search with no `from`/`to` drops the date range entirely rather than defaulting to the next thirty days: looking for a client means looking for every visit they ever made.

### Config and migrations
`app/core/config.py` is the only place that reads the environment — import `settings` rather than touching `os.environ`. It rejects a `SECRET_KEY` under 32 chars at startup, by design. `alembic/env.py` takes its URL from those same settings, so there is no second copy in `alembic.ini`. `Base.metadata` uses an explicit naming convention (`app/db/base.py`) — new models inherit it, which is what keeps autogenerated migrations stable. Add every new model to `app/models/__init__.py` or autogenerate won't see it.

PostgreSQL is a native install (`C:\Program Files\PostgreSQL\18`) running as the machine-wide `postgresql-x64-18` service on its own data directory. The app connects as the `postgres` superuser to a database named `airec`; there is no separate application role.

## Design workflow (required for all UI/UX work)

For any UI/UX task in this project — new pages, components, layout or styling changes:
1. Use the `ui-ux-pro-max` skill for design-system and UX guidance.
2. Use the 21st MCP tools (`mcp__21st__search`, `mcp__21st__generate`, etc.) for component/layout reference.

This project's brand colors and fonts (listed above) are already fixed — treat ui-ux-pro-max's own palette/font suggestions as informative reference, not a directive to replace them, unless the user explicitly asks for a rebrand.
