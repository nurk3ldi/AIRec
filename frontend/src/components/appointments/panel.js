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
