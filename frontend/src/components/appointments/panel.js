/**
 * The one entrance every panel on `/appointments` uses.
 *
 * Four popovers open on this screen — the booking form, the month, the service
 * list and the status filter — and a screen where each appears differently is a
 * screen where none of them is *the* way a panel arrives. Written once so they
 * cannot drift, and long enough to read as a movement rather than a flash: see
 * the note on `popover-in` in `globals.css` for the numbers and why.
 *
 * `motion-reduce:animate-none` is the whole accommodation needed here. There is
 * nothing to fall back to — the panel is simply there, which is what somebody
 * who turned animation off asked for.
 */
export const PANEL_MOTION =
  'origin-[var(--radix-popover-content-transform-origin)] ' +
  'data-[state=open]:animate-[popover-in_260ms_cubic-bezier(0.16,1,0.3,1)] ' +
  'data-[state=closed]:animate-[popover-out_150ms_cubic-bezier(0.4,0,1,1)] ' +
  'motion-reduce:animate-none'

/**
 * The phone's sheet, and the dim behind it — see the keyframes in
 * `globals.css`.
 *
 * A second string rather than a variant of `PANEL_MOTION`, because it is not
 * the same movement said at another size: a popover grows out of the control
 * that opened it, and a sheet arrives from the bottom edge of the screen. One
 * is anchored to a thing, the other to the device.
 */
export const SHEET_MOTION =
  'data-[state=open]:animate-[sheet-in_420ms_cubic-bezier(0.32,0.72,0,1)] ' +
  'data-[state=closed]:animate-[sheet-out_220ms_cubic-bezier(0.4,0,1,1)] ' +
  'motion-reduce:animate-none'

export const SCRIM_MOTION =
  'data-[state=open]:animate-[scrim-in_220ms_ease-out] ' +
  'data-[state=closed]:animate-[scrim-out_180ms_ease-in] ' +
  'motion-reduce:animate-none'

/**
 * **The same three movements, as values rather than as classes.**
 *
 * `ProfileDialog` is the one panel in the app that cannot read the strings
 * above. It is closed by its parent unmounting it rather than by Radix seeing
 * `open` go false, so there is no `data-[state=closed]` frame for a CSS
 * animation to hang on and its exit has to be driven by Motion. Giving it its
 * own hand-picked numbers is what made a settings panel and a booking panel two
 * different gestures on one product.
 *
 * **These live here, beside the strings, and the two have to be edited
 * together.** They cannot be generated from each other — Tailwind needs a
 * literal class name to find at build time, so the durations are spelled out
 * above and cannot come from a variable. Side by side in one file is as close as
 * that gets: change a curve in one and the other is on the next line.
 */
export const PANEL_TIMING = {
  // `popover-in` / `popover-out`. The scale is small and the time is long on
  // purpose — see the note on the keyframes in `globals.css`: a deeper, faster
  // version read as a pop, where the eye caught the scale as a separate event
  // from the fade.
  scale: 0.98,
  in: { duration: 0.26, ease: [0.16, 1, 0.3, 1] },
  out: { duration: 0.15, ease: [0.4, 0, 1, 1] },
}

/** `sheet-in` / `sheet-out`. Slower in, because it travels the whole screen. */
export const SHEET_TIMING = {
  in: { duration: 0.42, ease: [0.32, 0.72, 0, 1] },
  out: { duration: 0.22, ease: [0.4, 0, 1, 1] },
}

/** `scrim-in` / `scrim-out`. */
export const SCRIM_TIMING = {
  in: { duration: 0.22, ease: 'easeOut' },
  out: { duration: 0.18, ease: [0.4, 0, 1, 1] },
}
