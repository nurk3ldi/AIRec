/**
 * A short buzz, at the two moments in this app that earn one.
 *
 * **Utility is the whole rule here.** Feedback that fires everywhere trains
 * people to stop noticing it, so this is spent on two things and nothing else:
 * a drag crossing the point where letting go commits, and a booking actually
 * being written. Both are moments where something changes in the world and the
 * hand is already on the glass — a tap on a button is not one of them, because
 * the screen answers that on its own.
 *
 * **Causality and harmony** are the other two: it fires on the causal event
 * itself, not afterwards, and on the same frame as the thing you can see. That
 * is why the call sites are inside the handlers rather than in an effect
 * watching state — an effect would land a frame or more late, and a buzz that
 * trails its cause reads as a second event rather than as part of the first.
 *
 * **Silence is a correct outcome.** iOS Safari has never shipped the Vibration
 * API, so on an iPhone none of this does anything; desktop browsers expose it
 * and have nothing to vibrate. It is an enhancement on the devices that have
 * it, which means nothing here may ever be the *only* signal for anything —
 * every one of these moments is visible as well.
 */

/**
 * Two shapes, matched to what they are about.
 *
 * `snap` is a single tick: something clicked into place, the way a switch does.
 * `commit` is two, because finishing is a bigger event than crossing a line and
 * the hand can tell one pulse from two without being taught which is which.
 */
const PATTERNS = {
  snap: 10,
  commit: [10, 30, 10],
}

export function haptic(kind) {
  // Optional call rather than a feature test: `vibrate` is either a method or
  // undefined, and the browsers without it are exactly the ones to do nothing
  // on. It returns `false` rather than throwing when it declines.
  navigator.vibrate?.(PATTERNS[kind] ?? PATTERNS.snap)
}
