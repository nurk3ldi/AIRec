# 002 — Make the sheet exit from where the finger left it

- **Status**: TODO
- **Commit**: 8a90ba3
- **Severity**: HIGH
- **Category**: Interruptibility (animate from the presentation value)
- **Estimated scope**: 2 files, ~15 lines

## Problem

Dragging the phone sheet down past its threshold produces a **visible jump
upward before it leaves**. Drag it to 130px, release, and the sheet snaps back to
0 and only then slides down off the screen.

Two pieces cause it together.

```jsx
// frontend/src/components/appointments/Sheet.jsx:64-70 — current
const endDrag = (event) => {
  if (grabbed.current === null) return
  const distance = event.clientY - grabbed.current
  grabbed.current = null
  setPulled(0)
  if (distance > 120) onOpenChange?.(false)
}
```

`setPulled(0)` runs **unconditionally**, including on the branch that dismisses,
so the inline `translateY` is wiped in the same commit that closes the dialog.

```css
/* frontend/src/styles/globals.css — current */
@keyframes sheet-out {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}
```

And the exit keyframe is hard-coded to begin at `translateY(0)` — so even if the
inline transform survived, the animation would override it. (CSS animations sit
above normal author declarations in the cascade, which includes the `style`
attribute, so the keyframe always wins.)

This is the single most-cited rule in *Designing Fluid Interfaces*: **always
animate from the presentation value, never from the target value.** Starting from
the logical value causes exactly this visible jump. It is the seam between "I
threw this away" and "the app took it off me and put it back first."

## Target

The dismissal continues from the offset the finger released at.

```css
/* frontend/src/styles/globals.css — target */
@keyframes sheet-out {
  from {
    transform: translateY(var(--sheet-pulled, 0px));
  }
  to {
    transform: translateY(100%);
  }
}
```

```jsx
// frontend/src/components/appointments/Sheet.jsx — target
const endDrag = (event) => {
  if (grabbed.current === null) return
  const distance = event.clientY - grabbed.current
  grabbed.current = null

  if (distance > 120) {
    // **Hand the exit its starting point.** `sheet-out` reads this, so the
    // animation continues from where the finger let go instead of snapping to
    // the top first. `pulled` is deliberately *not* cleared here — clearing it
    // is what put the jump there.
    content.current?.style.setProperty('--sheet-pulled', `${distance}px`)
    onOpenChange?.(false)
    return
  }

  setPulled(0)
}
```

with the offset cleared on the way back **in**, not on the way out:

```jsx
// frontend/src/components/appointments/Sheet.jsx — target, new effect
useEffect(() => {
  if (!open) return
  setPulled(0)
  content.current?.style.removeProperty('--sheet-pulled')
}, [open])
```

Why the reset moved to open rather than staying at release: Radix keeps the node
mounted for the length of the exit animation, so anything that clears the offset
during the close is racing the animation that reads it. Opening is the one moment
where zero is unambiguously correct.

The exit duration stays as it is (`220ms`, `cubic-bezier(0.4, 0, 1, 1)` in
`SHEET_MOTION`). Matching the duration to the release velocity is plan 003's job;
this plan only removes the discontinuity.

## Repo conventions to follow

- The drag is deliberately hand-rolled on Pointer Events with an inline
  transform, **not a drag library** — `Sheet.jsx:31-34` explains why (Motion would
  bring `AnimatePresence` and `forceMount`, a different animation scheme from the
  one every panel here rides). Keep it that way; do not reach for Motion.
- Enter/exit motion for this component lives as class strings in
  `frontend/src/components/appointments/panel.js` (`SHEET_MOTION`, `SCRIM_MOTION`)
  and as keyframes in `frontend/src/styles/globals.css`. Keyframes belong in
  `globals.css`; do not inline a new `@keyframes`.
- Every keyframe in `globals.css` carries a comment saying why its numbers are
  what they are. Match that density — a one-line comment on the `var()` explaining
  that it is the release offset.
- The file already reaches into the DOM imperatively via refs
  (`Sheet.jsx:56`, `setPointerCapture`), so a `style.setProperty` on a ref is in
  keeping.

## Steps

1. `frontend/src/styles/globals.css` — change `sheet-out`'s `from` block to
   `transform: translateY(var(--sheet-pulled, 0px));`. Add a short comment above
   the keyframe saying the variable is the offset the finger released at and that
   the `0px` fallback covers a dismissal that was not a drag (the close button,
   Escape, a tap on the scrim). **The fallback unit matters** — `var(--sheet-pulled, 0)`
   would produce `translateY(0)` with no unit and be dropped as invalid.
2. `frontend/src/components/appointments/Sheet.jsx` — add `useEffect` to the
   existing React import on line 1 (currently `import { useRef, useState } from 'react'`).
3. Same file — add a ref for the content element beside the existing `grabbed`
   and `pulled` state:
   `const content = useRef(null)`.
4. Same file — attach it: `<Dialog.Content ref={content} …>` at line 80. Radix
   forwards refs on `Content`, so nothing else changes.
5. Same file — replace `endDrag` with the target version above.
6. Same file — add the `useEffect` on `open` from the target above, placed after
   the `endDrag` declaration.

## Boundaries

- Do NOT change the dismissal threshold (`120`), the curve, or the durations.
  Velocity and thresholds are plan 003.
- Do NOT add rubber-banding to the upward clamp at `Sheet.jsx:61`
  (`Math.max(0, …)`). That is a separate finding and a separate plan.
- Do NOT switch the drag to Motion, `react-use-gesture`, Vaul, or any library.
- Do NOT touch `SHEET_MOTION` in `panel.js`, the `sheet-in` keyframe, or anything
  to do with the scrim.
- Do NOT touch `ProfileDialog.jsx`, which is a different sheet with its own
  Motion-driven exit.
- Do NOT add dependencies.
- If `endDrag` does not match the "current" excerpt above, the file has drifted
  since commit `8a90ba3`. STOP and report.

## Verification

- **Mechanical**: from `frontend/`, `npm run lint` then `npm run build` — both
  clean. Confirm the fallback survived compilation: after a build,
  `grep -rn "sheet-pulled" dist/assets/*.css` must show the `var(--sheet-pulled, 0px)`
  form with its unit intact.
- **Feel check** — phone-width viewport with touch emulation, on `/appointments`:
  - Open a booking, drag the sheet's header down about a third of the screen and
    release. The sheet must carry on downward **from where you let go**. There must
    be no upward movement at any point after the release.
  - Repeat at ~150px, ~300px and nearly full height. The further you drag, the
    shorter the remaining travel should look — never the same slide every time.
  - Drag to 60px (under the threshold) and release: it must spring back to the top
    as before. This branch is unchanged and must stay unchanged.
  - Close the sheet the other three ways — the header's × button, Escape, a tap on
    the scrim — with no drag involved. Each must slide from the top of the sheet
    exactly as it does today; this is what the `0px` fallback protects.
  - Open and close five times in a row. The second opening must start from the top,
    not from the last release offset — that is what the `open` effect guarantees.
  - DevTools → Animations at 10% playback, then drag-dismiss: step through and
    confirm the first frame of `sheet-out` is at the release offset, not at 0.
- **Done when**: no frame of a drag-dismissal moves the sheet upward, the three
  non-drag dismissals are unchanged, and a reopened sheet always starts at the top.
