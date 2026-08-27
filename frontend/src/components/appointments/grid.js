/**
 * What the timetable and the phone's day view both have to agree on.
 *
 * Two screens draw the same day now — the desktop grid and `MobileDay` — and
 * the things they cannot disagree about are how much of the day is drawn and
 * what a closed hour looks like. Kept here for the same reason `panel.js`
 * exists: a value used by two components in one folder and defined in one of
 * them is a value the other one copies.
 */

/**
 * **The whole day, midnight to midnight.**
 *
 * It was 08:00–21:00, which is a guess about when a business is open, and the
 * guess became unnecessary once the real hours arrived from
 * `/business/working-hours` and could be drawn as shading. It also stopped
 * being merely tidy: a booking may now be written outside opening hours, so a
 * grid that only drew the working day could hide a booking it had just
 * accepted.
 */
export const START_HOUR = 0
export const END_HOUR = 24

/** The slice of the day the grid draws, in minutes. */
export const WINDOW_FROM = START_HOUR * 60
export const WINDOW_TO = END_HOUR * 60

/**
 * The diagonal hatch a closed stretch wears.
 *
 * **A pattern rather than a flat grey, because a flat grey is a colour and this
 * has to read as "nothing happens here".** A tint says the hour is *some* other
 * kind of hour; hatching says it is struck out. It is also the one thing that
 * survives a booking being drawn on top of it, which a fill would not.
 *
 * 6px on, 6px off at 135° — the reference's own period, measured off it.
 *
 * **The stripe is `--hatch`, a token with a value per theme**, and it has to
 * be. It was `ink` at 5% mixed for both, which is a grey stripe on a white page
 * and `#0d0d0d` on a black one — a value you can measure and cannot see. The
 * two sides do not want the same number either: dark-on-light is read more
 * readily than light-on-dark, so the dark theme takes the larger share to
 * arrive at the same faintness. Faint is still the intent — this is the
 * background of the grid — but faint and invisible are not the same thing.
 *
 * **It was briefly a flat tint and is back.** The argument for the tint was
 * scale: over twenty-four hours most of the day is shut, so the pattern went
 * from marking a corner to covering two-thirds of the busiest surface in the
 * product. That lost to how the two actually look — struck-out reads as struck
 * out at any size, and a tint at that scale reads as a second kind of surface
 * rather than as an absence.
 */
export const HATCH =
  'repeating-linear-gradient(135deg, transparent 0 6px, var(--color-hatch) 6px 12px)'

/**
 * The room the phone keeps above the calendar for the controls that steer it.
 *
 * It began as the desktop header's 68 — what this screen gave up when the
 * header came off it below `sm` — and that was the wrong measure: a desktop
 * header is one row of small controls on a wide bar, where this has to hold a
 * row sized for thumbs (44pt is the floor) with air around it.
 *
 * `env(safe-area-inset-top)` is added rather than baked in: 0 in a browser tab,
 * and the notch's height once this is installed to a home screen — the same
 * reason the bottom bar carries the inset for the home indicator.
 *
 * **It lives here because three screens have to agree on it.** The calendar
 * reserves it, the toolbar fills it, and the search puts its field in the same
 * place — if any one of them measured it differently, switching between them
 * would move the row under the reader's thumb.
 */
export const CONTROLS_HEIGHT = 'calc(96px + env(safe-area-inset-top))'
