# web/CLAUDE.md

React 19 + Vite + Tailwind v4 SPA, plain JSX, no TypeScript, no tests.

## Commands

- `npm install`, `npm run dev` (port 3000, `strictPort`, `host: true`), `npm run build`, `npm run preview`
- `npm run lint` — oxlint over `src` (`react` + `oxc` plugins; `rules-of-hooks`, `only-export-components`, `no-undef`). The `env` block (`browser` + `es2024`) is required, or every `window`/`Intl`/`ResizeObserver` is "undefined". It does not resolve imports — a dangling path will not be caught.
- Locale key check (three dictionaries have no schema; run after touching copy):
  ```
  node --input-type=module -e "import ru from './src/lib/locales/ru.js';import kk from './src/lib/locales/kk.js';import en from './src/lib/locales/en.js';const r=Object.keys(ru);console.log(r.filter(k=>!(k in kk)),r.filter(k=>!(k in en)))"
  ```

## Stack — no Next.js

Entry: `index.html` → `src/main.jsx` (fonts, `globals.css`, `BrowserRouter`) → `src/App.jsx` (route table). Never reintroduce Next primitives:

| Not | Use |
| --- | --- |
| `next/link` | `react-router-dom` `<Link to>` |
| `useRouter().push/.replace/.pathname/.query` | `useNavigate()`, `useLocation()`, `useSearchParams()` |
| `next/head` / per-page titles | the `<title>` in `index.html` (a page that needs its own sets `document.title` in an effect) |
| `process.env.NEXT_PUBLIC_*` | `import.meta.env.VITE_*` |

## Routing

`App.jsx` holds every route, each nested in one of two layouts — that is how a route gets its shell:
- `PublicLayout` (`LandingHeader`, 64px): `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `*` (404).
- `DashboardLayout` (rail `Sidebar` 64px + `Header` 68px on desktop, `BottomNav` 50px on phones): `/dashboard`, `/inbox`, `/appointments`, `/assistant`, `/notes`, `/notifications`, `/profile`.

`pages/` is a convention only. When adding a dashboard route, also add it to `components/navigation.js` (if it's a destination — rail and bottom bar both read it) and to `Header`'s `PAGE_TITLE_KEYS`.

**`PageTransition` + `mode="wait"` trap:** the leaving page stays mounted while `useLocation`/`useSearchParams` already report the next route. A page that reads a param at render and redirects on its absence will fire that redirect on its way out — capture such params once in a `useState` initialiser (see `reset-password.jsx`).

## Data access (`src/lib/`)

- **`lib/api.js` is the only place that calls the backend.** One `request()`; add endpoints as small named exports. It throws `ApiError` (`code`, `message`, `fields`, `status`) parsed from the backend envelope. Every request has a 10s `AbortSignal.timeout` (an unreachable port otherwise hangs for a minute). Uploads pass `formData` and omit `Content-Type` (browser sets the boundary). Uploaded files live at the backend root `/media/...`, not under `/api/v1` — resolve through `mediaUrl()`. Sends `Accept-Language` read at call time.
- **Every data request goes through `authed(call)`** from `lib/auth.js`; never call `getAccessToken()` outside `auth.js`. On `not_authenticated` it renews via `verifySession()` and retries. It must go through `verifySession()` (single-flight) — parallel `refresh()` calls would replay the refresh token, which the server treats as theft.
- `verifySession()` is the real session check (`/auth/me`, fallback `/auth/refresh`, re-reads storage before giving up because another tab may have rotated). `useRequireAuth()` returns the user object and renders nothing until confirmed; `useRedirectIfAuthed()` bounces signed-in visitors from auth pages. A token being present ≠ a live session.
- Tokens: `localStorage` when «Запомнить меня», else `sessionStorage` (server picks refresh lifetime from the same flag — both halves are needed).
- `lib/viewState.js` `useRemembered(key, initial)` — view state that survives navigation (pages unmount on every route change) but not reload. Module-level `Map`, keys `screen.thing`. `clearTokens()` calls `forgetView()` so the next user on a shared machine doesn't inherit it. Don't remember searches.
- **There is no push (no SSE/WebSocket).** "Live" = polling, only while `document.visibilityState === 'visible'`, with a read on `visibilitychange`. Lists poll every 15s, an open thread every 5s.
- Keep business rules in `lib/` (`appointments.js`, `dates.js`, `schedule.js`, `conversations.js`, `motion.js`, `haptics.js`), not in components — two screens copying arithmetic drift apart.

## Layout rules

- **`min-height` is not `height`.** A flex container with only `min-height` has an indefinite cross size, so `flex-1` children size to content and nothing scrolls internally. Pages that must fit the viewport (`/appointments`, `/notes`) set a definite `h-[calc(...)]` + `overflow-hidden`; every scrolling child chain needs `min-h-0`.
- Each page pairs with a CSS module in `src/styles/` holding only `min-height`/`height: calc(100vh - Npx)` + background. `N` must match the real header height (`Header` 68, `LandingHeader` 64; phone: +50 for the bottom bar plus `env(safe-area-inset-bottom)`). The bottom bar's height is paid in three places that must move together: `<main>`'s bottom padding, page modules' phone height, the profile sheet's offset. `/profile` and `/appointments` hide the header on phones, so they subtract only 50.
- On phones `/`, `/login`, `/signup` hide `LandingHeader`; centre content with `m-auto`, not `justify-center` (which clips tall content).

## Styling

- **Tailwind v4 via `@tailwindcss/vite`**, configured only in `src/styles/globals.css` (no `tailwind.config.js`, no PostCSS).
- **Any unlayered rule in `globals.css` beats every utility** (cascade layers). Global resets go in `@layer base`.
- **Use semantic tokens**, never raw hexes: `bg-ground`, `bg-surface`, `bg-surface-raised`, `bg-surface-chip`, `bg-surface-card`, `text-ink`, `text-muted`, `border-line`, `border-line-strong`, `bg-accent`, `text-danger`, `text-ok`, `bg-now`, `bg-placeholder`, `bg-rail`. They map through `@theme inline` — `inline` is what lets them switch at runtime.
- **Monochrome, no brand hue.** `accent` is black on light, white on dark. Text on a solid accent or `bg-ink` takes `text-surface`, never `text-white`. `danger` (#dc2626) and `ok` (#16a34a) are signals only — never decorative.
- Surface tokens: `surface-raised` = card on the page; `surface-chip` = the chosen thing (segment, today) — must be lighter than its track in both themes; `surface-card` = something drawn *on* a surface (a booking on the grid, a list row) and gets no edge.
- Cards: `CARD_EDGE` / `CARD` from `components/card.js` (soft `card-edge` border, 20px squircle). In dark mode `surface` = `ground` = black, so the edge is what makes a card visible. Skeletons must use the same string or the layout jumps when data lands.
- Form controls: `components/controls.js` (`CONTROL`, `FIELD`, `FIELD_ERROR`, `BUTTON_PRIMARY`, `BUTTON_SECONDARY`). Field rings are `box-shadow` (no layout shift on focus) referencing `var(--color-field…)` — Tailwind drops arbitrary values that reference unregistered variables like `var(--field)`.
- In a hand-written arbitrary value read `var(--now)`, not `var(--color-now)` (the latter resolves once at `:root` and ignores subtree overrides).
- Don't put two utilities of the same property in one class string (`mb-3 mb-6`, `text-ink text-surface`) — stylesheet order decides, not write order. Use a ternary.
- `Skeleton` only adds its default radius/fill when the caller names none (`.rounded-md` is emitted after `.rounded-full`).
- Font: Onest Variable only (`font-sans` and `font-display` both point at it; keep both names — they are roles). Any replacement font must ship `cyrillic-ext` (Kazakh letters ә ғ қ ң ө ұ ү һ) — Geist and Jost don't.
- Icons: `@hugeicons/react` + `@hugeicons/core-free-icons` only.
- No UI kit. **Radix only for hard behaviour** (dialog, popover, select). Small fixed lists → `react-select`; long lists needing search → popover + filtering. shadcn was rejected (second token system for nothing).
- Theme: `lib/theme.js` (`system`/`light`/`dark`, `localStorage` `airec_theme`); an inline script in `index.html` applies it before first paint and must agree with `applyTheme`. Some tokens don't flip: `rail` stays dark in both themes (active marker `bg-rail-ink`), `scrim` stays dark.
- Type scale: page title 28/700, hero number 32/700, secondary value 24/700, card title 15/600, body 14, secondary 13, label 11/500. One 32 per screen; never put adjacent steps (15 next to 14) side by side. Spacing 4/8/12/16/24/32/48.
- Popovers needing a height cap: `max-h-[var(--radix-popover-content-available-height,calc(100vh_-_92px))]` — the fallback is load-bearing (the variable doesn't exist on the first frame). Nested overlays inside a dialog use `z-[70]`, `data-nested-overlay`, and a `Portal`.

## Motion

- **Every route change is `PageTransition`**: opacity-only cross-fade, `useOutlet()` (not `<Outlet/>`), `mode="wait"`, `initial={false}`. No slide — transforms add scrollable overflow.
- Use `m` + `LazyMotion features={domAnimation}`, never bare `motion.*`. Use `domMax` only where drag or layout/`layoutId` is needed — `domAnimation` has no drag.
- Shared constants: `SPRING` (`bounce: 0`, `visualDuration: 0.4`) and `CROSSFADE` from `lib/motion.js`; popover/sheet classes and timings from `components/appointments/panel.js` (`PANEL_MOTION`, `PANEL_TIMING`, `SHEET_TIMING`, `SCRIM_TIMING`) — edit class strings and timing constants together. Sheets use `cubic-bezier(0.32, 0.72, 0, 1)`, 420ms.
- Animate only what answers "what just happened / where did this come from". Opacity/transform only; the exceptions are content-height folds (`grid-template-rows: 0fr → 1fr`) and the inbox search field's `width`.
- An `AnimatePresence initial={false}` propagates to every later-mounted descendant; reset `PresenceContext` around content that must still play an entrance.
- Grids keyed for directional entrance animate **entering only, no `AnimatePresence`** (a leaving grid cell sits beside its replacement).
- Placeholders: `animate-placeholder` (2s breathe, shared phase via `Skeleton`'s negative delay — keep `BREATH_MS` equal to the utility's duration). Content replacing shown placeholders uses `animate-content-reveal`, gated by `useSkeleton`'s `reveal`.
- **Reduced motion means fewer and gentler, never none.** Travel becomes a fade; press feedback and finger-driven drags stay. When someone reports "no animation / tearing", check `prefers-reduced-motion` first.

### Gestures (Apple fluid-interface rules)

- **Respond on pointer-down.** Tailwind v4 `hover:` is dead on touch devices — every touch target needs `active:` feedback: `active:scale-[0.97]` (`0.95` on small round buttons) with `transition-[scale] duration-[160ms] ease-out` or `transition-transform`. `scale` is its own property; `transition-[transform]` doesn't animate it.
- Small controls take the `touch-target` utility (44px hit area under `pointer: coarse`, nothing visual changes). It needs a positioned element and no clipping ancestor.
- Track the finger 1:1; pick the axis once in the first ~8px; set `touch-pan-y` on the dragged element *and* on any scroll container inside it.
- Commit on `distance + project(velocity)` (`lib/motion.js`), never on distance alone. Use `velocityFrom` (measures up to release). Resist at edges with `rubberband()`. Continue release animations from the on-screen value with the release velocity.
- Nothing a gesture writes goes through React state — write to refs/`MotionValue`s; read layout once at pointerdown.
- Don't let two owners write `transform` (Motion's inline style beats `active:scale-*`) — use `whileTap`, or a separate wrapper element.
- Haptics (`lib/haptics.js`) only on commit and on crossing a threshold, fired from the event itself. Silent on iOS/desktop — never the only signal.

## Mobile

- Every `<input>`/`<textarea>` is `text-[16px]` below `sm` (iOS zooms into smaller fields and never zooms out).
- Pinch-zoom is blocked on purpose (`gesturestart` in `main.jsx`, `touch-action: pan-x pan-y` in CSS). Known WCAG 1.4.4 trade-off, user's request.
- Phones get their own shapes rather than shrunk desktop ones: bottom bar instead of rail, `/profile` screen instead of popup, full-bleed bottom sheets instead of popovers (`components/appointments/Sheet.jsx`), shelves that scroll sideways instead of 3-up rows, list rows instead of tables. Prefer a `sm:` class; use `useMediaQuery` (`lib/media.js`) only when a prop or primitive must change. Hide-don't-unmount (`hidden sm:flex`) so clocks and scroll survive resizes.

## i18n

`lib/i18n.js` + `lib/locales/{ru,kk,en}.js`. No library, no context. `ru` is source and fallback; a missing key renders as the key itself.
- Components: `useT()`. Non-components/callbacks: `translate(key, vars)` (reads the language at call time; never put it in effect deps). `useLanguage()`, `getLocale()` for `Intl` dates.
- Use `{name}` placeholders, never string concatenation.
- **A module-level constant may not hold a translated string** — store keys (`labelKey`) and call `t()` at render.
- Dates through `Intl` with `getLocale()` (functions, not constants). Language names are written in their own language.
- Still Russian-only: `formatPrice`/`formatDuration`, `BOOKING_STATES` labels (UI uses `booking.*` keys instead), `cities.js`, `businessOptions.js`.

## Screen-specific rules worth knowing

### Bookings (`/appointments`, dashboard `DayCard`, inbox day row)
- Status is the only colour on an unmarked card, and only as one word/dot (`statusTone`); cancelled is muted and faded. Never tint the whole card by status.
- **Owner-chosen colour** (`appointments.color`, 8 names in `BOOKING_TINTS`) paints the card with the exact hex via `cardFill`; text colour comes from `cardInk` (WCAG contrast), and lines inherit it (no `text-muted`/status colour on a painted card). **Automatic colours** (`dayColors`, by position in the day, avoiding names already chosen that day) are a dot only, never a fill. The server stores the name, not the hex. `color: null` is always sent on save — it means «Автоматически».
- Open-ended bookings (no `ends_at`): drawn `OPEN_MINUTES` (45) long with a faded bottom; `endOf()` is the only place that stands in for the end; they count up instead of down and are excluded from free-window maths.
- `byStart` is a total order (id tiebreak) — always sort with it.
- Status filter filters in the client; nothing ticked = everything shown.
- Desktop: single click reserved for selection; double-click opens `BookingPopover` (on a card: edit; on empty grid: new at the floored quarter hour, anchored at the point). Phone: tap opens read-only `BookingDetail`, «Изменить» opens the editor.
- Booking form: adding starts blank (no seeded service/price); typing over the service name unhooks `service_id`; times are typed (`1430` → `14:30`); hours outside opening time are a warning (`hoursProblem`), not an error; delete takes two presses.
- Timetable: full 00–24 day, 90-minute rows, hour height measured (`HOURS_ON_SCREEN = 3`), observer paused while the grid is being pulled (`settling` ref, not raised under reduced motion). Card content depends on measured height *and* width; below `CARD_WIDTH.RANGE` a cluster collapses into a dashed `GroupBlock` that opens a list. Closed hours are hatched (`HATCH`, `--hatch` per theme), never filled, `pointer-events-none`. While loading, bookings are redacted (`GhostDay`), the grid itself is real.
- `MonthScroller`'s scroll box must be `relative` (offsetTop is measured from it). `CONTROLS_HEIGHT` in `grid.js` is shared by three phone screens.
- `MonthCalendar` renders twice on a page — its `layoutId` must be per instance.

### Inbox (`/inbox`) and conversations
- A message sent by hand switches the assistant off in that thread (server rule). While the assistant holds a thread the composer shows a bar with «Ответить самому», not a field.
- Thread: opens at the bottom instantly; re-pins only on thread change or when already pinned (40px slack); photos re-request bottom on load; only newly arriving bubbles animate; incoming while open is marked read.
- Archive and bin are separate boxes; a thread is in exactly one. «Удалить навсегда» exists only in the bin and asks inside the popover with «Отмена» focused. Archive/bin actions are optimistic and re-read both lists.
- Rows with no `chatId` (manual bookings) are not pressable and have no menu.
- Empty cells show an em dash, never blank.
- Phone thread is `ThreadSheet` with swipe-back; desktop is a split view, never a modal.

### Shell
- `DashboardLayout` owns the user, `isMenuOpen`, `dialogSection`, and passes `{user, onUserChange, onOpenSection}` via `PageTransition`'s `context` → `useOutletContext()`.
- Profile: desktop = `ProfileMenu` popup from the rail avatar + `ProfileDialog`; phone = `/profile` screen opening the same dialog as a bottom sheet. Sections live in `components/profile/sections.js` (add once, appears in both). `ProfileMenu` holds the only sign-out. Avatar crops are staged and uploaded on Save.
- `TelegramIsland` in the header notifies of new client Telegram messages (polls every 5s); it cannot show where the header is hidden.
- Bell popover: four columns, the Telegram column lists unread Telegram threads; badge "unseen since last open" stored in `localStorage` `airec_notifications_seen`.
- Auth pages: measured off vercel.com/login; `login.jsx`/`signup.jsx` are visual twins — keep them in sync. All forms `noValidate`; whitespace is rejected client-side. Apple sign-in is UI only.

### Logos
`BrandMark` (`airec_logo.png`) is white — dark surfaces only. `black_logo_icon.png` for light surfaces. Bump `?v=N` when replacing an asset in place.
