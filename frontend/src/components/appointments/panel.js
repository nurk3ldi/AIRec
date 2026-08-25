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
