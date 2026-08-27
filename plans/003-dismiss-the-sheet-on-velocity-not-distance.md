# 003 — Dismiss the sheet on projected momentum, not on distance

- **Status**: TODO
- **Depends on**: 002 (must be applied first — this plan assumes `endDrag` already
  hands the exit its starting offset and that `pulled` is cleared on open)
- **Commit**: 8a90ba3
- **Severity**: HIGH
- **Category**: Interruptibility / Physicality (momentum projection, velocity handoff)
- **Estimated scope**: 2 files, ~45 lines (one of them new)

## Problem

The sheet decides whether to close by looking only at **how far** the finger
travelled, never at **how fast** it was going when it let go.

```jsx
// frontend/src/components/appointments/Sheet.jsx:64-70 — current (pre-002)
const endDrag = (event) => {
  if (grabbed.current === null) return
  const distance = event.clientY - grabbed.current
  grabbed.current = null
  setPulled(0)
  if (distance > 120) onOpenChange?.(false)
}
```

```jsx
// frontend/src/components/appointments/Sheet.jsx:59-62 — current
const onDrag = (event) => {
  if (grabbed.current === null) return
  setPulled(Math.max(0, event.clientY - grabbed.current))
}
```

Nothing anywhere records a timestamp, so velocity does not exist in this
component. Two consequences, both of which people hit immediately:

- **A fast flick of 60px springs back.** The gesture that most clearly means
  "throw this away" is the one the sheet refuses, because it is short.
- **A slow, deliberate 130px drag closes.** Someone dragging carefully to look at
  what is underneath loses the sheet.

Apple's rule is the opposite of a distance threshold: *don't snap to the nearest
boundary from the release point — use velocity to project the resting position,
then choose the target nearest that projection.* And once the target is chosen,
the animation has to continue **at the finger's release velocity**, or there is a
visible seam between dragging and animating. That seam is, in the words of the
talk, the detail that most separates "fluid" from "fine."

## Target

### A shared motion helper

A new file, because plan 004 needs the same two functions for the day-swipe and
two copies of Apple's deceleration constant is two constants that agree until one
is edited:

```js
// frontend/src/lib/motion.js — new file, complete contents

/**
 * Where a flick would come to rest if you let it decelerate.
 *
 * Apple's own projection function from the *Designing Fluid Interfaces* sample
 * code, and deliberately **not** the physics-textbook `v² / (2·a)`: this is the
 * exponential-decay form, which is what iOS actually ships and what a scroll
 * view's deceleration feels like. At the default rate the factor works out to
 * 499, so a release at 500 px/s projects about 250px further on.
 *
 * `velocity` is in px/s and signed — a negative one projects backwards, which is
 * what makes "drag down, then flick up before letting go" correctly refuse to
 * dismiss.
 */
export function project(velocity, decelerationRate = 0.998) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate)
}

/**
 * Release velocity in px/s from a short trail of `{ at, value }` samples.
 *
 * A trail rather than the last two points: two consecutive `pointermove` events
 * can be a millisecond and a pixel apart, which divides out to a nonsense
 * number. The window is 100ms, which is long enough to average out one stray
 * frame and short enough that it is still the *release* velocity and not the
 * average of the whole gesture.
 *
 * Returns 0 rather than Infinity when the trail is too short to divide by.
 */
export const VELOCITY_WINDOW = 100

export function velocityFrom(trail) {
  const last = trail.at(-1)
  const first = trail.find((sample) => last.at - sample.at <= VELOCITY_WINDOW)
  if (!first || last.at - first.at < 8) return 0
  return ((last.value - first.value) / (last.at - first.at)) * 1000
}
```

### The sheet uses it

```jsx
// frontend/src/components/appointments/Sheet.jsx — target

// A trail of where the finger was and when, for the release velocity. A ref
// rather than state: nothing renders from it, and a render per pointermove is a
// render per frame.
const trail = useRef([])

const startDrag = (event) => {
  if (event.target.closest('button')) return
  grabbed.current = event.clientY
  trail.current = [{ at: performance.now(), value: 0 }]
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

const onDrag = (event) => {
  if (grabbed.current === null) return
  const distance = Math.max(0, event.clientY - grabbed.current)
  const at = performance.now()
  trail.current.push({ at, value: distance })
  // Keep only what the velocity window can use, or a long slow drag grows an
  // array for the whole of its length.
  while (trail.current.length > 2 && at - trail.current[1].at > VELOCITY_WINDOW) {
    trail.current.shift()
  }
  setPulled(distance)
}

const endDrag = (event) => {
  if (grabbed.current === null) return
  const distance = Math.max(0, event.clientY - grabbed.current)
  const velocity = velocityFrom(trail.current)
  grabbed.current = null
  trail.current = []

  // **The threshold moved from the release point to the projected one.** 120px
  // still means the same thing it did — this is where the sheet is more gone
  // than not — but it is now asked of where the gesture was *heading* rather
  // than where the finger happened to stop.
  if (distance + project(velocity) > 120) {
    const node = content.current
    if (node) {
      node.style.setProperty('--sheet-pulled', `${distance}px`)
      node.style.animationDuration = `${exitDuration(node, distance, velocity)}ms`
    }
    onOpenChange?.(false)
    return
  }

  setPulled(0)
}
```

and the duration that carries the velocity across the release:

```jsx
// frontend/src/components/appointments/Sheet.jsx — target, module scope

/**
 * How long the exit should take, so it leaves at roughly the speed the finger
 * released at and there is no seam between the drag and the animation.
 *
 * **This is an approximation of velocity handoff, not the real thing.** A true
 * handoff feeds the release velocity into a spring as its initial velocity; this
 * component animates on a CSS keyframe by deliberate choice (see the note at the
 * head of the file), and a keyframe has one dial. Matching the duration to
 * `remaining / velocity` makes the first frame leave at about the right speed,
 * which is the part the eye actually catches.
 *
 * Clamped at both ends: under 140ms the exit is a cut, over 320ms a hard flick
 * feels caught.
 */
const EXIT_MS = { min: 140, max: 320 }

function exitDuration(node, distance, velocity) {
  const remaining = node.getBoundingClientRect().height - distance
  if (velocity <= 0) return EXIT_MS.max
  const ideal = (remaining / velocity) * 1000
  return Math.round(Math.min(Math.max(ideal, EXIT_MS.min), EXIT_MS.max))
}
```

### The duration has to be cleared again

`animationDuration` set inline outranks the `animate-[…]` class, and the same
element also plays `sheet-in`. Extend the effect plan 002 added so opening clears
it too:

```jsx
// frontend/src/components/appointments/Sheet.jsx — target, amending 002's effect
useEffect(() => {
  if (!open) return
  setPulled(0)
  const node = content.current
  node?.style.removeProperty('--sheet-pulled')
  if (node) node.style.animationDuration = ''
}, [open])
```

## Repo conventions to follow

- **Pure rules live in `src/lib`, screens import them.** `CLAUDE.md` states this
  outright: "the data layer stays in `src/lib` … a screen is what keeps being
  redrawn; the arithmetic below it is what the next version starts from."
  `frontend/src/lib/schedule.js` and `frontend/src/lib/appointments.js` are the
  exemplars — small named exports, a doc comment on each saying why the rule is
  what it is, no React.
- The drag stays hand-rolled on Pointer Events. `Sheet.jsx:31-34` documents why no
  drag library is used here; that decision is settled and this plan does not
  reopen it.
- Constants that encode a decision are named objects at module scope with a
  comment (`CARD_WIDTH` in `Timetable.jsx`, `EXIT_MS` here), not bare numbers at
  the call site.

## Steps

1. Create `frontend/src/lib/motion.js` with exactly the contents given above.
2. `frontend/src/components/appointments/Sheet.jsx` — import from it:
   `import { project, velocityFrom, VELOCITY_WINDOW } from '../../lib/motion'`.
   (Two directories up: this file sits in `src/components/appointments/`.)
3. Same file — add `EXIT_MS` and `exitDuration` at module scope, above the
   `Sheet` component.
4. Same file — add the `trail` ref beside `grabbed` and `pulled`.
5. Same file — replace `startDrag`, `onDrag` and `endDrag` with the target
   versions above.
6. Same file — amend the `open` effect that plan 002 added so it also clears
   `animationDuration`.

## Boundaries

- Do NOT change the `120` threshold value itself. What changes is the quantity it
  is compared against.
- Do NOT change the exit curve (`cubic-bezier(0.4, 0, 1, 1)`) or anything in
  `SHEET_MOTION`, `SCRIM_MOTION` or the `sheet-in` keyframe.
- Do NOT add rubber-banding to the upward clamp — still a separate finding.
- Do NOT replace the CSS keyframe exit with a spring, a rAF loop, or a library.
  If the approximation in `exitDuration` feels wrong on a real device, report that
  rather than changing the animation scheme.
- Do NOT convert `pulled` from state to a ref in this plan, tempting as the
  per-frame render is. That is its own finding with its own risk, and mixing it in
  here makes a feel regression impossible to attribute.
- Do NOT use this helper anywhere else yet — plan 004 is its second caller.
- Do NOT add dependencies.
- If `Sheet.jsx` does not already contain plan 002's `content` ref and `open`
  effect, plan 002 has not been applied. STOP and report.

## Verification

- **Mechanical**: from `frontend/`, `npm run lint` then `npm run build`, both
  clean. Sanity-check the projection in a node one-liner — it is the one number
  here that is easy to get wrong by an order of magnitude:
  `node --input-type=module -e "import {project} from './src/lib/motion.js';console.log(project(500))"`
  must print approximately `249.5`. If it prints `0.499` or `499000`, the formula
  was transcribed wrong.
- **Feel check** — real touch device strongly preferred; DevTools touch emulation
  with a mouse produces unrealistic velocities:
  - **Short fast flick.** Open a booking, flick the header down ~50px quickly and
    release. It must dismiss. This is the case that fails today and is the whole
    point of the plan.
  - **Long slow drag.** Drag down ~200px over about two seconds and release
    without any speed. It must **spring back**, not dismiss.
  - **Reversal.** Drag down 150px, then flick back up and release while moving
    upward. It must spring back — the negative velocity projects the endpoint
    backwards past the threshold.
  - **Seam check, the important one.** Flick hard and watch the moment of release
    frame by frame (DevTools → Animations, 10% playback). The sheet must not
    visibly change speed at the instant the finger lifts. A hard flick that then
    drifts away slowly means `exitDuration` is being clamped at `max` when it
    should not be; a hard flick that snaps out instantly means it is hitting `min`.
    Report which, with the numbers, rather than retuning blind.
  - **Non-drag closes are unaffected.** ×, Escape and a scrim tap must each still
    take the full 220ms, because `animationDuration` is only ever set on the drag
    branch.
  - **Reopen.** After a fast flick-dismiss, open the sheet again: `sheet-in` must
    take its usual 420ms. If the second opening is visibly quicker, the inline
    `animationDuration` is not being cleared.
- **Done when**: a quick short flick dismisses, a slow long drag does not, a
  reversal does not, and no test above shows a speed discontinuity at release.
