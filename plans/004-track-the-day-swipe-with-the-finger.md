# 004 — Make the day swipe track the finger

- **Status**: TODO
- **Depends on**: 003 (imports `project` / `velocityFrom` from the `src/lib/motion.js`
  that plan creates)
- **Commit**: 8a90ba3
- **Severity**: HIGH
- **Category**: Direct manipulation / Response
- **Estimated scope**: 1 file, ~60 lines

## Problem

Swiping sideways on the phone's day grid steps to the next day, and **nothing
moves while you are swiping**. The gesture is recognised only at the moment the
finger lifts.

```jsx
// frontend/src/components/appointments/MobileDay.jsx:139-165 — current
const startSwipe = (event) => {
  swipe.current = { x: event.clientX, y: event.clientY, axis: null }
}

const moveSwipe = (event) => {
  const from = swipe.current
  if (!from || from.axis === 'y') return

  const dx = event.clientX - from.x
  const dy = event.clientY - from.y
  if (from.axis === null && Math.abs(dx) + Math.abs(dy) > 8) {
    from.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
  }
}

const endSwipe = (event) => {
  const from = swipe.current
  swipe.current = null
  if (!from || from.axis !== 'x') return

  const dx = event.clientX - from.x
  if (Math.abs(dx) < 60) return

  const step = dx < 0 ? 1 : -1
  setDirection(step)
  onDayChange?.(shiftDate(day, 'day', step))
}
```

`moveSwipe` computes `dx` and then throws it away — it exists only to latch an
axis. The whole gesture is invisible until it is over, and then the day teleports
with a 24px flourish:

```jsx
// frontend/src/components/appointments/MobileDay.jsx:323-328 — current
<m.div
  key={key}
  initial={direction ? { opacity: 0, x: direction * 24 } : false}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
```

Three Apple rules are broken at once. *Touch and content should move together* —
they do not. *Feedback must be continuous during the interaction, not just at the
end* — there is none until the end. And the explicit warning against recognisers
that "only report a final state," because they throw away the continuous tracking
you need for feedback. The practical cost is that the gesture is undiscoverable:
nothing tells you a swipe is possible, and a 55px swipe that does nothing is
indistinguishable from a swipe the app did not notice.

The same `< 60` distance-only threshold as the sheet has, with the same
consequence: a fast short flick does nothing.

## Target

### The grid follows the finger, on its own wrapper

The element that animates the day change is a Motion `m.div`, and Motion owns its
inline `transform`. The drag must therefore live on a **plain wrapper between the
scroll box and the `m.div`**, so the two transforms compose by nesting instead of
overwriting each other.

```jsx
// frontend/src/components/appointments/MobileDay.jsx — target, inside the scroll box
<div
  ref={track}
  // The drag lives here, not on the `m.div` below: that one's transform belongs
  // to Motion's enter animation, and two owners of one property is one of them
  // losing. Nesting composes them instead.
  className="will-change-transform"
>
  <m.div key={key} …>
</div>
```

### The handlers

```jsx
// frontend/src/components/appointments/MobileDay.jsx — target
const track = useRef(null)
const trail = useRef([])

// How far the arriving day starts from. It was 24px while the gesture itself was
// invisible; now that the finger has already moved the grid a real distance, a
// 24px entrance reads as a smaller movement than the one that caused it.
const ENTER_OFFSET = 48
// Past this, the swipe commits. Asked of the *projected* endpoint, not of where
// the finger stopped — see `project` in `src/lib/motion.js`.
const COMMIT_PX = 60

const slide = (x, animated) => {
  const node = track.current
  if (!node) return
  node.style.transition = animated
    ? 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)'
    : 'none'
  node.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
}

const startSwipe = (event) => {
  swipe.current = { x: event.clientX, y: event.clientY, axis: null }
  trail.current = [{ at: performance.now(), value: 0 }]
}

const moveSwipe = (event) => {
  const from = swipe.current
  if (!from || from.axis === 'y') return

  const dx = event.clientX - from.x
  const dy = event.clientY - from.y
  if (from.axis === null && Math.abs(dx) + Math.abs(dy) > 8) {
    from.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    // **Captured only once the axis is known to be horizontal.** Capturing at
    // pointerdown would claim the pointer before it is clear whether this is a
    // scroll, and the browser's vertical pan is the thing that must not be
    // interfered with.
    if (from.axis === 'x') event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  if (from.axis !== 'x') return

  trail.current.push({ at: performance.now(), value: dx })
  while (
    trail.current.length > 2 &&
    trail.current.at(-1).at - trail.current[1].at > VELOCITY_WINDOW
  ) {
    trail.current.shift()
  }
  // 1:1 with the finger, written straight to the node. Through React state this
  // would be a render of the whole day per pointermove.
  slide(dx, false)
}

const endSwipe = (event) => {
  const from = swipe.current
  swipe.current = null
  if (!from || from.axis !== 'x') return

  const dx = event.clientX - from.x
  const projected = dx + project(velocityFrom(trail.current))
  trail.current = []

  if (Math.abs(projected) < COMMIT_PX) {
    // Under the threshold it goes back where it was, on the sheet's own curve.
    slide(0, true)
    return
  }

  const step = projected < 0 ? 1 : -1
  // Cleared without a transition, in the same commit as the day change: React
  // batches the two, so the browser paints one frame — the new day already at
  // its entry offset. A transition here would animate the *old* day back to
  // centre underneath the arriving one.
  slide(0, false)
  setDirection(step)
  onDayChange?.(shiftDate(day, 'day', step))
}
```

The direction is now taken from `projected` rather than from `dx`, so a flick
that reverses at the last moment goes the way it was thrown.

### The entrance, and reduced motion

```jsx
// frontend/src/components/appointments/MobileDay.jsx — target
const reduce = useReducedMotion()

<m.div
  key={key}
  initial={reduce || !direction ? false : { opacity: 0, x: direction * ENTER_OFFSET }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: reduce ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
```

**The 1:1 drag stays on under `prefers-reduced-motion`, and only the entrance is
dropped.** The two are different things: the entrance is a screenful of content
travelling on its own, which is what the setting is about; the drag is the
content sitting under a finger that is moving it, and removing it would leave the
gesture with no feedback at all — the state this plan exists to fix.

### One containment detail

`overflow-y: auto` on the scroll box computes `overflow-x` to `auto`, so a
translated child can raise a horizontal scrollbar mid-drag. The non-scrolling
branch has to say `overflow-x-hidden` explicitly:

```jsx
// frontend/src/components/appointments/MobileDay.jsx:310-312 — target
className={`relative min-h-0 flex-1 overflow-y-auto overscroll-contain ${
  scrolls ? 'overflow-x-auto' : 'touch-pan-y overflow-x-hidden'
}`}
```

## Repo conventions to follow

- `frontend/src/components/appointments/Sheet.jsx` is the exemplar for a
  hand-rolled pointer gesture in this codebase: a ref for the gesture's origin,
  `setPointerCapture`, `pointercancel` wired to the same handler as `pointerup`,
  and an inline transform. Imitate its shape.
- `cubic-bezier(0.32, 0.72, 0, 1)` at ~260ms is this project's spring-back curve
  and appears in `Sheet.jsx:115`, `Timetable.jsx:451` and `WeekStrip.jsx:74`. Use
  it; do not introduce a fourth curve.
- Every non-obvious decision in these files carries a comment explaining why the
  alternative was rejected. Match that — the comments in the target blocks above
  are part of the deliverable, not decoration.

## Steps

1. `frontend/src/components/appointments/MobileDay.jsx:1` — add `useReducedMotion`
   to the existing Motion import (currently `import { m } from 'motion/react'`).
2. Same file — add
   `import { project, velocityFrom, VELOCITY_WINDOW } from '../../lib/motion'`.
3. Same file — add `ENTER_OFFSET` and `COMMIT_PX` at module scope with the
   comments above.
4. Same file — add the `track` and `trail` refs and the `reduce` value beside the
   existing `swipe` ref and `direction` state (around line 136).
5. Same file — add the `slide` helper and replace `startSwipe`, `moveSwipe` and
   `endSwipe` with the target versions.
6. Same file:310-312 — add `overflow-x-hidden` to the non-scrolling branch.
7. Same file — wrap the `m.div` at line 323 in the plain `<div ref={track}>`
   above it, and close it after the `m.div` ends at line 473. **Check the closing
   tag lands in the right place**: line 473 is `</m.div>`, and the new `</div>`
   goes immediately after it, still inside the scroll box.
8. Same file:325-327 — apply the target `initial` and `transition`.

## Boundaries

- Do NOT touch the `scrolls` branch behaviour. When a day has more lanes than fit,
  the horizontal axis belongs to the content and the swipe handlers are not
  attached at all (`MobileDay.jsx:298-301`, `MobileDay.jsx:228-231` explain why).
  That stays exactly as it is.
- Do NOT remove `touch-pan-y`. Without it the browser owns the horizontal pan and
  the pointer events arrive already cancelled — the gesture stops working entirely.
- Do NOT introduce `AnimatePresence` here. `MobileDay.jsx:317-320` documents why:
  a leaving grid would sit beside its replacement for the length of the animation,
  two days of hours in one column. If the commit hand-off looks wrong without it,
  **report that** — do not reach for it.
- Do NOT add rubber-banding or edge resistance. There is no first or last day.
- Do NOT change `WeekStrip`, the toolbar, the hour grid, the now-line, or any of
  the layout arithmetic.
- Do NOT change what `direction` does elsewhere in the file.
- Do NOT add dependencies.
- If `startSwipe`/`moveSwipe`/`endSwipe` do not match the "current" excerpt, or if
  `src/lib/motion.js` does not exist, STOP and report — the latter means plan 003
  has not been applied.

## Verification

- **Mechanical**: from `frontend/`, `npm run lint` (note it will not catch a
  mismatched JSX tag from step 7 — the build will) then `npm run build`, both
  clean.
- **Feel check** — real touch device strongly preferred:
  - **Tracking.** Put a finger on the grid and move it slowly sideways without
    lifting. The hours must move with it, pixel for pixel, in both directions, and
    follow the finger back if you reverse without lifting.
  - **Spring back.** Drag 30px and release: the grid returns to centre on a curve,
    and the day does not change.
  - **Short fast flick.** Flick ~40px quickly: the day must change. This is the
    case that fails today.
  - **Slow long drag.** Drag 80px over two seconds and release: it must still
    commit (80 is past 60 on its own), and the arriving day must come from the
    correct side — swipe left, next day enters from the right.
  - **Vertical scroll is untouched.** Scroll the hours up and down: the grid must
    not drift sideways by a pixel, and no horizontal scrollbar may appear at any
    point during a sideways drag.
  - **Diagonal.** Start a drag at 45°: whichever axis wins the first 8px must keep
    it for the rest of the press. The grid must never flip between scrolling and
    sliding mid-gesture.
  - **The three-lane case.** Find or create a day with four overlapping bookings so
    `scrolls` is true. The grid must scroll sideways and **not** step the day.
  - **Tap a date in the week strip** instead of swiping: the new day must simply
    appear, with no slide, because `direction` is cleared on that path.
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: dragging must still
    track the finger 1:1; committing must swap the day with no slide.
  - DevTools → Performance, record a slow sideways drag on a busy day: look for a
    green compositor-only trace. Any purple Layout blocks during the drag mean the
    transform landed on the wrong element — report it.
- **Done when**: the grid moves under the finger throughout the gesture, a quick
  short flick commits, a slow small drag springs back, vertical scrolling and the
  scrolling-lane day are both unaffected, and no horizontal scrollbar ever appears.
