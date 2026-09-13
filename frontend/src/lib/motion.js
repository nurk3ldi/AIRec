/**
 * The arithmetic under a gesture, kept out of the components that use it.
 *
 * Two screens hand-roll a drag — the phone's sheet and the day grid's sideways
 * swipe — and both have to answer the same two questions: how fast was the
 * finger going when it let go, and where would that throw land. Two copies of
 * Apple's deceleration constant are two constants that agree until one of them
 * is edited, which is the reason this file exists rather than a pair of helpers
 * sitting in whichever component needed them first.
 *
 * No React here, like everything else in `lib`.
 */

/**
 * Where a flick would come to rest if you let it decelerate.
 *
 * Apple's own projection function from the *Designing Fluid Interfaces* sample
 * code, and deliberately **not** the physics-textbook `v² / (2·a)`: this is the
 * exponential-decay form, which is what iOS actually ships and what the tail of
 * a scroll feels like. At the default rate the factor works out to 499, so a
 * release at 500 px/s projects about 250px further on.
 *
 * `velocity` is in px/s and **signed**, which is the half that matters at a
 * boundary: a negative one projects backwards, so "drag down, then flick up
 * before letting go" correctly refuses to dismiss. Deciding on the projected
 * endpoint rather than on where the finger stopped is what makes a short fast
 * throw and a long slow drag mean different things.
 */
export function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/**
 * How far back a release velocity is measured, in milliseconds.
 *
 * Long enough to average out one stray frame, short enough that it is still the
 * *release* velocity and not the average of the whole gesture.
 */
export const VELOCITY_WINDOW = 100

/**
 * Release velocity in px/s from a trail of `{ at, value }` samples.
 *
 * A trail rather than the last two points: two consecutive `pointermove` events
 * can be a millisecond and a pixel apart, and dividing one by the other gives a
 * number with no relationship to how fast anything was moving. Returns 0 rather
 * than `Infinity` when there is not enough of a gap to divide by, which is also
 * the honest answer for a finger that was resting.
 *
 * **Measured up to the moment of release, not up to the last movement.** The
 * trail only grows on `pointermove`, and a finger that drags, stops and then
 * lifts sends no event while it rests — so a window anchored to the last sample
 * still reported the speed of a movement that had ended a quarter of a second
 * earlier, and a deliberate "hold, then let go" was thrown as if flicked. Found
 * on `/inbox`'s swipe-back, where it closed the thread under a finger that had
 * stopped; `MobileDay` and `Sheet` had the same fault. With `now` as the end of
 * the window, a rest longer than it leaves no sample inside and reads as 0, and
 * a shorter one dilutes the speed in proportion — which is what a slowing
 * finger is.
 */
export function velocityFrom(trail, now = performance.now()) {
  const last = trail.at(-1)
  if (!last) return 0
  const first = trail.find((sample) => now - sample.at <= VELOCITY_WINDOW)
  if (!first || now - first.at < 8) return 0
  return ((last.value - first.value) / (now - first.at)) * 1000
}

/**
 * Resistance past a boundary, so an edge is felt rather than hit.
 *
 * Apple's rubber-band curve: the further past the bound the finger goes, the
 * less the element follows, approaching a limit instead of stopping dead. A
 * hard clamp reads as "this froze"; rising friction reads as "still listening,
 * but there is nothing more this way".
 *
 * `overshoot` is how far past the bound the finger is, `dimension` the size of
 * the thing being dragged — the resistance is relative to it, or the same
 * gesture would feel different on a tablet and a phone.
 */
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (
    (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  )
}

/**
 * The spring for anything that moves because of a press — Apple's default.
 *
 * **Critically damped (`bounce: 0`) with a response of about 0.4s**, the values
 * *Designing Fluid Interfaces* ships for moving and repositioning. No overshoot,
 * because nothing that a tap starts carried momentum; bounce is for a thrown
 * object, and a field that wobbles after opening reads as a toy.
 *
 * `visualDuration` rather than `duration`: it is the time to *look* arrived,
 * which is Apple's "response". A spring's `duration` includes the long tail
 * where it is settling by fractions of a pixel, and tuning by that number is
 * what made earlier springs here feel either sluggish or abrupt.
 *
 * It replaced 0.2–0.26s ease-out tweens on `/inbox` on 2026-09-13, which were
 * the "too fast" in the report: an expo-out covers half its distance in the
 * first 50ms, so the eye sees a pop rather than a movement.
 */
export const SPRING = { type: 'spring', bounce: 0, visualDuration: 0.4 }

/**
 * One view giving way to another in place — a cross-fade, not a movement.
 *
 * Slower in than out, and both slower than the 0.15s that read as a blink: the
 * leaving view should be *seen* to go, and the arriving one should settle rather
 * than snap. Opacity only, so it holds under `prefers-reduced-motion` too.
 */
export const CROSSFADE = {
  in: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1] },
  out: { duration: 0.2, ease: [0.4, 0, 1, 1] },
}
