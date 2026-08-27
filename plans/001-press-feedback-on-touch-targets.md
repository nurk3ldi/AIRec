# 001 — Give every mobile tap target a press state

- **Status**: TODO
- **Commit**: 8a90ba3
- **Severity**: HIGH
- **Category**: Purpose & frequency / Physicality (press feedback)
- **Estimated scope**: 6 files, one class string each

## Problem

The app has **97 `hover:` declarations and 5 `:active` declarations**. Tailwind v4
compiles `hover:` to `&:hover { @media (hover: hover) { … } }`, so on a phone —
where the primary input has no hover — every one of those rules is dead. The
result is that the primary tap targets of the whole mobile experience give
**nothing back between the finger landing and the screen changing**.

Apple's *Designing Fluid Interfaces* puts this first: respond on pointer-**down**,
not on release; the moment lag appears "the feeling of directness falls off a
cliff." A row that waits for a sheet to open before acknowledging the tap reads
as a dropped input, and people re-tap.

The six sites, current code verbatim:

```jsx
// frontend/src/components/appointments/MobileList.jsx:240 — booking row
className={`flex w-full items-start gap-3 rounded-xl bg-surface-card px-3 py-3 text-left outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85 ${
  block.status === 'cancelled' ? 'opacity-45' : ''
}`}
```

```jsx
// frontend/src/components/appointments/MobileList.jsx:333 — free-window row
className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2.5 text-left outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong"
```

```jsx
// frontend/src/components/appointments/MobileSearch.jsx:204 — search result
className={`w-full rounded-xl bg-surface-card px-3 py-2.5 text-left outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85 ${
  state === 'cancelled' ? 'opacity-45' : ''
}`}
```

```jsx
// frontend/src/components/appointments/MobileToolbar.jsx:199 — ToolButton (+, search, view switch)
className="grid h-10 w-10 place-items-center rounded-full text-ink outline-none transition-colors hover:bg-ink/8 focus-visible:bg-ink/8"
```

```jsx
// frontend/src/components/appointments/MonthScroller.jsx:227 — day cell button
className="grid h-12 place-items-center outline-none"
```

```jsx
// frontend/src/components/appointments/WeekStrip.jsx:153 — day cell button
className="grid place-items-center py-1 outline-none"
```

## Target

Every one of the six gets the press recipe from the audit playbook —
`transform: scale(0.97)` on `:active`, `transition: transform 160ms ease-out` —
expressed in Tailwind and **merged into the element's existing
`transition-property`**, never appended as a second `transition-*` utility.

**The merge is the part that is easy to get wrong.** Two utilities that set the
same CSS property are resolved by stylesheet order, not by the order they appear
in the class string, so `transition-opacity transition-transform` does not mean
"both" — one silently wins. This repo already documents that trap in `CLAUDE.md`
("One class or the other through a ternary, never `mb-3 mb-6` in one string").
Use the bracket form that names every property that must animate.

Exact target class strings:

```jsx
// frontend/src/components/appointments/MobileList.jsx:240 — target
className={`flex w-full items-start gap-3 rounded-xl bg-surface-card px-3 py-3 text-left outline-none transition-[opacity,transform] duration-[160ms] ease-out hover:opacity-85 focus-visible:opacity-85 active:scale-[0.97] ${
  block.status === 'cancelled' ? 'opacity-45' : ''
}`}
```

```jsx
// frontend/src/components/appointments/MobileList.jsx:333 — target
className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2.5 text-left outline-none transition-[border-color,transform] duration-[160ms] ease-out hover:border-line-strong focus-visible:border-line-strong active:scale-[0.97]"
```

```jsx
// frontend/src/components/appointments/MobileSearch.jsx:204 — target
className={`w-full rounded-xl bg-surface-card px-3 py-2.5 text-left outline-none transition-[opacity,transform] duration-[160ms] ease-out hover:opacity-85 focus-visible:opacity-85 active:scale-[0.97] ${
  state === 'cancelled' ? 'opacity-45' : ''
}`}
```

```jsx
// frontend/src/components/appointments/MobileToolbar.jsx:199 — target
className="grid h-10 w-10 place-items-center rounded-full text-ink outline-none transition-[background-color,transform] duration-[160ms] ease-out hover:bg-ink/8 focus-visible:bg-ink/8 active:scale-[0.95]"
```

```jsx
// frontend/src/components/appointments/MonthScroller.jsx:227 — target
className="grid h-12 place-items-center outline-none transition-transform duration-[160ms] ease-out active:scale-[0.95]"
```

```jsx
// frontend/src/components/appointments/WeekStrip.jsx:153 — target
className="grid place-items-center py-1 outline-none transition-transform duration-[160ms] ease-out active:scale-[0.95]"
```

Two scale values, not one, and the reason is the target's size: `0.97` on a
full-width row is a visible settle, while `0.97` on a 36–40px circle is under a
pixel and invisible. Both stay inside the playbook's 0.95–0.98 band.

### Reduced motion: leave the press state ON

Do **not** add `motion-reduce:` guards here. `prefers-reduced-motion` asks for the
removal of vestibular *travel* — things crossing the screen — and the audit
playbook is explicit that a reduced-motion implementation which "nukes all
feedback" is itself a finding. A 3% scale lasting 160ms under the finger is
feedback tied to the touch, not motion across the screen, and it is the only
acknowledgement a touch user gets. It stays.

## Repo conventions to follow

- Interactive elements in this codebase state their feedback inline as Tailwind
  utilities on the element; there is no shared button component to change.
- The press-feedback pattern already exists in the app and should be imitated:
  `frontend/src/pages/profile.jsx:191` — `transition-colors active:bg-ground`, and
  `frontend/src/pages/index.jsx:53` — `transition-opacity active:opacity-70`. Those
  two use colour/opacity; the six here use scale because they are cards and
  circles, where a tint change is easy to miss at arm's length.
- Arbitrary values in brackets are the house style everywhere in this project
  (`text-[15px]`, `rounded-[10px]`), so `active:scale-[0.97]` matches.

## Steps

1. `frontend/src/components/appointments/MobileList.jsx:240` — replace the class
   string with the target above. Keep the `${…}` cancelled-opacity suffix exactly
   as it is.
2. `frontend/src/components/appointments/MobileList.jsx:333` — replace with the
   target above.
3. `frontend/src/components/appointments/MobileSearch.jsx:204` — replace with the
   target above, keeping the `${…}` suffix.
4. `frontend/src/components/appointments/MobileToolbar.jsx:199` — replace with the
   target above. This is the shared `ToolButton`, so all three toolbar buttons
   change at once; do not edit the call sites.
5. `frontend/src/components/appointments/MonthScroller.jsx:227` — append the three
   utilities to the existing class string. The `<span>` holding the day number is
   a child of this button and inherits the scale; do **not** move the transform
   onto the span.
6. `frontend/src/components/appointments/WeekStrip.jsx:153` — same, append to the
   button's class string, not the span's.

## Boundaries

- Do NOT touch the desktop grid's booking card
  (`frontend/src/components/appointments/Timetable.jsx:1076`). It needs the same
  treatment but cannot take a Tailwind `active:scale-*` class: the element is a
  `m.div` that animates `scale` on mount, and Motion's inline transform beats the
  utility. That is plan 005's problem, not this one.
- Do NOT add `motion-reduce:` variants — see the reduced-motion note above.
- Do NOT add a second `transition-*` utility beside an existing one; merge into
  the bracket form.
- Do NOT change markup, handlers, or any structure — class strings only.
- Do NOT add dependencies.
- If a class string does not match the "current" excerpt above, the file has
  drifted since commit `8a90ba3`. STOP and report rather than improvising.

## Verification

- **Mechanical**: from `frontend/`, run `npm run lint` — expect zero new findings.
  Then `npm run build` — expect success. Grep to confirm no element ended up with
  two conflicting transition utilities:
  `grep -rn "transition-[a-z[]* .*transition-" src/components/appointments/`
  should return nothing.
- **Feel check** — this must be done on a real touch device or in Chrome DevTools
  device emulation with touch simulation on, because `:active` behaves differently
  under a mouse:
  - Open `/appointments` on a phone-width viewport, switch to the list view, and
    press-and-hold a booking row: it must shrink **the instant the finger lands**,
    before anything opens, and return when the finger lifts.
  - Press a row and slide the finger off it without lifting: the row must return
    to full size (the browser drops `:active`), and no sheet may open.
  - Press a day in the month scroller and in the week strip: the circle must dip.
    Confirm the dip is actually visible at arm's length — if `0.95` reads as
    nothing on a 36px circle, report that rather than silently deepening it.
  - In DevTools → Animations, set playback speed to 10% and press a row: confirm
    the scale eases **out** (fast start, slow settle), not in.
  - DevTools → Rendering → emulate `prefers-reduced-motion: reduce`, then press a
    row: the press state must **still** be there.
- **Done when**: all six elements dip on press on a touch device, none of them
  lost their existing hover or focus-visible behaviour on a desktop, and the build
  is clean.
