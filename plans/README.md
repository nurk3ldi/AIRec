# Animation plans

Written by the `improve-animations` audit of commit `8a90ba3`, against Emil
Kowalski's animation playbook and Apple's *Designing Fluid Interfaces*.

The audit's conclusion in one line: **the desktop's motion is largely in good
shape — nearly all of the weakness is on the phone, and specifically in the
gestures.** These four plans are the mobile gesture work, in order.

## Plans

| # | Title | Severity | Depends on | Status |
| --- | --- | --- | --- | --- |
| [001](001-press-feedback-on-touch-targets.md) | Give every mobile tap target a press state | HIGH | — | **DONE** |
| [002](002-sheet-exits-from-where-the-finger-left-it.md) | Make the sheet exit from where the finger left it | HIGH | — | **DONE** |
| [003](003-dismiss-the-sheet-on-velocity-not-distance.md) | Dismiss the sheet on projected momentum, not distance | HIGH | 002 | **DONE** |
| [004](004-track-the-day-swipe-with-the-finger.md) | Make the day swipe track the finger | HIGH | 003 | **DONE** |

All four are applied, along with every remaining finding in the table below.
`npm run lint` and `npm run build` are clean; the feel checks in each plan have
**not** been run — they need a real touch device.

### One correction the plans got wrong

Plan 001 specified `transition-[opacity,transform]` beside `active:scale-[0.97]`.
**Tailwind v4 compiles `scale-*` to the standalone `scale` property, not to
`transform`** — verified in the built CSS as `.active\:scale-\[0\.97\]:active{scale:.97}`
— and `scale`, `translate` and `rotate` are separate animatable properties from
`transform`. Naming `transform` would have left every press state with no
transition and it would have snapped. The applied code names `scale`; the bracket
lists are `transition-[opacity,scale]`, `transition-[border-color,scale]` and
`transition-[background-color,scale]`. Tailwind's own `transition-transform`
utility is safe — it expands to `transform, translate, scale, rotate`.

## Execution order

Run them **001 → 002 → 003 → 004**. The order is not arbitrary:

- **001 is first because it is independent and cannot break anything.** Six class
  strings, no logic. It is also the widest felt improvement per line changed, so
  it is worth having in hand before the riskier work starts.
- **002 before 003** because 003 assumes the exit already begins at the release
  offset. Applied the other way round, velocity-based dismissal fires more often
  and makes the upward jump 002 removes *more* visible, not less — the fix would
  look like a regression.
- **003 before 004** because 003 creates `frontend/src/lib/motion.js`, and 004's
  first line imports `project` and `velocityFrom` from it. 004 says to stop and
  report if that file is missing.

Each plan is verifiable on its own. Do not batch them into one branch — the feel
checks are the point, and a single diff containing all four makes a regression
impossible to attribute to the change that caused it.

## Shared thread

All four are the same principle said four times: **the interface should respond
to the finger, continuously, and continue from wherever the finger left it.**
001 is the response at the moment of contact, 002 is continuity at the moment of
release, 003 is inheriting the release velocity, 004 is continuity for the whole
length of a gesture.

## The rest of the table — also applied

Done directly rather than as numbered plans, since each is one or two edits.

| Severity | Location | What changed |
| --- | --- | --- |
| HIGH | `Timetable.jsx` `BookingBlock` | The desktop booking card now answers a press (`whileTap={{ scale: 0.98 }}`, a Motion value because the element already animates `scale` and a Tailwind utility would be overwritten by the inline transform) and shows a `line-strong` hairline on hover, as a `box-shadow` so the card gains no width. Before this, hover, the first click and the second click all looked identical until the panel opened. |
| MED | `Timetable.jsx` measure effect | **The real cost of the pull was never the height transition — it was the `ResizeObserver`.** The scroll box changes height on every frame of it, so `measure` ran ~18 times a pull, each with an in-flight number, re-rendering every booking, closed span, hour row and the now-line with a fresh pixel size. `GRID_SHARE` exists so the measured hour is *identical* in both states, so the correct behaviour is for it not to move at all. A `settling` ref now holds the observer off for the length of the transition and `onTransitionEnd` measures once against the height it landed at. The `height` transition itself stays: there is no transform-only equivalent without restructuring the definite-height flex chain `CLAUDE.md` documents at length, and that is a redesign, not a motion fix. |
| MED | `controls.js`, `Header.jsx`, `OtpInput.jsx`, `login.jsx` | `transition-all` → the properties that actually change: `[box-shadow,background-color,opacity]` on `CONTROL`, `transition-shadow` on the header search and the OTP boxes, `[background-color,box-shadow]` on the remember checkbox. |
| MED | `MobileDay.jsx` | `useReducedMotion` added; the day's entrance is dropped under it and the 1:1 drag is kept. **`MobileSearch`, `MonthScroller` and `Sheet` needed nothing** — on re-inspection their only transitions are colour and opacity, which reduced motion keeps, and their `scrollIntoView` is already instant. That part of the finding was over-stated. |
| MED | `Sheet.jsx` | The upward clamp is a rubber band (`rubberband` in `lib/motion.js`) instead of `Math.max(0, …)`. The sheet's height is read once at `pointerdown` rather than per frame. |
| LOW | `Sheet.jsx` | `pulled` state is gone; the drag writes `transform` straight to the node, so there is no longer a React render per `pointermove`. Done together with 002/003 after all — they touch the same six lines, and splitting them would have meant writing the handler twice. |
| LOW | `Sidebar.jsx` | The rail tooltips lost their `transition-all` **and** their animation entirely — no fade, no 4px slide. Four labels pointed at tens of times a day are exactly the frequency band where the playbook's answer is to delete the animation. |
| LOW | `404.jsx` | `-0.03em` → `-0.045em` at 64px, so tracking tightens as size grows instead of inverting against the 32px headings. |

### Missed opportunities — two applied, two declined by the code

**Applied.**

- **The theme switch no longer flashes.** `lib/theme.js` arms a
  `data-theme-switching` attribute on `<html>` for 200ms around a real change,
  and an **unlayered** rule in `globals.css` gives every element a colour-only
  transition for exactly that window. Unlayered on purpose: `transition-colors`
  sits on about a hundred elements and each would otherwise keep its own 150ms
  through the switch, and an unlayered rule is the only thing that outranks a
  Tailwind utility. Verified unlayered in the built CSS. It arms only when there
  is a previous theme (the first call of a session is the page *arriving* at its
  colours — fading that in is the flash the inline script exists to prevent),
  only when the theme actually differs, and never under `prefers-reduced-motion`.
- **Haptics, at two moments and no more.** `lib/haptics.js`: a single tick when a
  sheet drag crosses the dismiss threshold — fired on the crossing, held by a ref
  so it cannot repeat per frame, and only on the way in — and a double tick when
  a booking is actually written (`BookingPopover`, on the success itself rather
  than from an effect, so it lands on the same frame as its cause). Silent on iOS
  Safari, which has never shipped the Vibration API, and on every desktop; both
  moments are visible as well, so nothing depends on it.

**Declined — the code already answers both, deliberately, against what the audit
proposed.** Both findings were written from `CLAUDE.md`'s older description; the
components have moved past it.

- **Translucent chrome.** The header is not transparent any more. `Header.jsx`
  carries `bg-ground` with a comment that names the blur and rejects it: *"A blur
  (`bg-ground/80 backdrop-blur`) is the other way to do it and the one to reach
  for if this should ever read as glass; it costs a compositing layer and says
  'there is something under here', which is a claim this header does not need to
  make."* The scrolling-content problem the audit raised is what the opaque
  `bg-ground` already fixes. `BottomNav` is the same choice on the same
  reasoning, and making one glass without the other would leave the two ends of
  the app disagreeing. Left alone.
- **Stacked sheet depth.** There is no stack to give depth to. `BookingDetail`
  renders its sheet as `open={open && !editing}` and the edit button does
  `setEditing(true); onOpenChange(false)` — the detail closes and the editor
  opens, one screen at a time, which the file states outright: *"Two sheets
  stacked would be a question."* Dimming and pushing back a parent layer would
  mean introducing the stack first. Left alone.

  One thing there **is** worth a feel-check on a device: the detail plays
  `sheet-out` downward while the editor plays `sheet-in` upward, so for ~220ms
  two full-height sheets cross in opposite directions on a step that is
  conceptually a drill-*in*. That may read as a seam. It is an observation, not a
  finding — it needs eyes on a phone before anything is changed.

### Checked and dismissed

- **Ungated `:hover`.** Reported in the first pass and **wrong**. Tailwind v4
  compiles the `hover:` variant to `&:hover { @media (hover: hover) { … } }`
  itself, so all 97 are already gated. Nothing to do.
- **Reduced motion leaves popovers with no fade at all.** Documented as deliberate
  in `components/appointments/panel.js:10-12`. Not re-litigated.
- **`WeekStrip`'s `grid-template-rows: 0fr → 1fr`.** A layout animation, and
  `CLAUDE.md` names it as the one earned exception. Left alone.
