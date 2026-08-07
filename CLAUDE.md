# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AIRec — Next.js frontend for an AI-receptionist product. Currently a UI skeleton (no backend, no auth, no real data — pages render static markup only). The actual app lives in `frontend/`; the repository root otherwise only holds git metadata.

## Commands

Run from `frontend/`:

- `npm install` — install dependencies
- `npm run dev` — start dev server (Next.js + Turbopack)
- `npm run build` — production build
- `npm start` — run the production build
- `npm run lint` — oxlint over `src/pages` and `src/components`

No test suite exists yet.

## Architecture

### Layout routing (`src/pages/_app.jsx`)
Layout is chosen per-route, not per-page. A `PUBLIC_ROUTES` set holds paths that render inside `PublicLayout` (marketing header, no sidebar) — currently `/`, `/login`, `/signup`. Every other route renders inside `DashboardLayout` (fixed icon `Sidebar` + `Header`), the authenticated app shell. When adding a new logged-out/marketing page, add its path to `PUBLIC_ROUTES`; everything else gets the dashboard chrome automatically.

- `/` — public landing page (`pages/index.jsx`).
- `/dashboard` — authenticated home (dashboard shell). Not `/` — that's the landing page.
- `/login` and `/signup` — built (`pages/login.jsx`, `pages/signup.jsx`), intentionally near-identical: no `<label>`s — inputs use `placeholder` only; password field has a show/hide toggle (local `showPassword` state flips the `input type` between `password`/`text`); a `<hr>` sits above the submit button; a bottom line cross-links to the other page (`Log In` / `Sign Up` in accent blue `#3248F2`). Keep them in sync when restyling one — they're meant to stay visual twins.

### Dashboard shell
- `Sidebar.jsx` — fixed 64px icon-only rail (`#171215` bg). Nav items are a hardcoded `navigation` array; active state matches `router.pathname`. The profile link is pinned to the bottom separately from the array.
- `Header.jsx` — sticky 68px top bar; page title comes from a `pageTitles` map keyed by route — update this map when adding a new dashboard route.

### Public shell
- `LandingHeader.jsx` — sticky **64px** header with the brand mark + "AIRec" wordmark on the left, Log In / Sign Up links on the right. Reused by every `PUBLIC_ROUTES` page via `PublicLayout.jsx`. Any page under `PublicLayout` must offset its root container to match this header's actual height (see `Home.module.css`) — it has drifted from the dashboard's 68px through iteration, so don't assume they're equal.
- Two logo assets exist: `BrandMark.jsx` renders `public/airec_logo.png`, a **white** mark on a transparent background — only visible on a dark surface (used in the dark `Sidebar`). `public/black_logo_icon.png` is the black variant, tightly cropped (no baked-in padding) for use directly on light backgrounds — used as-is (no wrapper badge) in `LandingHeader.jsx`. Pick whichever variant matches the surface color; don't badge-wrap one to force it onto the wrong background.

### Styling convention
- Tailwind v4, configured entirely via the `@theme` block in `src/styles/globals.css` — there is no `tailwind.config.js`.
- Brand tokens: `--color-brand-blue #3248f2` (accent/CTA), `--color-brand-black #171215` (text/dark surfaces), `--color-brand-gray #999999` (borders, typically at 20–45% opacity), `--color-brand-soft #f6f8fa` (page background), `--color-brand-white #ffffff`.
- Components overwhelmingly reference these as raw Tailwind arbitrary values (`bg-[#171215]`, `border-[#999999]/25`) rather than the semantic `bg-brand-*` classes. Match that existing convention instead of switching styles mid-codebase.
- Fonts: Poppins (`font-display`, headings) and Roboto Variable (`font-sans`, body), loaded via `@fontsource` imports in `_app.jsx`.
- Each page pairs with a CSS Module in `src/styles/` for its root container — the convention is `min-height: calc(100vh - Npx)` to offset that page's sticky header, plus a background color. `N` must match the actual current height of that layout's header component (`Header.jsx` or `LandingHeader.jsx`) — check the header's `h-*` class rather than assuming a fixed number, since header heights get tuned independently. All other styling is inline Tailwind utility classes.
- Icons: `@hugeicons/react` + `@hugeicons/core-free-icons` via the `HugeiconsIcon` component — not emoji, not another icon set.
- No UI component library (no shadcn/ui, MUI, Ant Design, etc.). Components are hand-built with Tailwind.

### UI language
Dashboard UI copy (nav labels, headings, page titles, aria-labels) is Russian. The public auth flow is the deliberate exception — `LandingHeader.jsx`, `login.jsx`, and `signup.jsx` are in English by explicit request. Follow whichever convention matches the shell (dashboard vs. public) when adding pages.

## Design workflow (required for all UI/UX work)

For any UI/UX task in this project — new pages, components, layout or styling changes:
1. Use the `ui-ux-pro-max` skill for design-system and UX guidance.
2. Use the 21st MCP tools (`mcp__21st__search`, `mcp__21st__generate`, etc.) for component/layout reference.

This project's brand colors and fonts (listed above) are already fixed — treat ui-ux-pro-max's own palette/font suggestions as informative reference, not a directive to replace them, unless the user explicitly asks for a rebrand.
