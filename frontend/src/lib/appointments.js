/** Turning the API's bookings into something the calendar can place. */

/**
 * An instant, broken into the wall-clock parts of a given zone.
 *
 * `Intl` rather than arithmetic: it is the only thing in the browser that knows
 * what a named zone's offset was on a particular date, daylight saving and all.
 * `en-CA` because its numeric format is already zero-padded `YYYY-MM-DD`, and
 * `h23` because `hour12: false` reports midnight as "24" in some engines.
 *
 * `timeZone: undefined` means the browser's own zone, which is the behaviour
 * everything here had before a business zone was available — so a page that
 * hasn't loaded the business yet still shows sensible times rather than none.
 */
function partsIn(iso, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))

  const at = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    day: `${at.year}-${at.month}-${at.day}`,
    clock: `${at.hour}:${at.minute}`,
    minutes: Number(at.hour) * 60 + Number(at.minute),
  }
}

/**
 * One booking, ready to be placed — read in the **business's** zone.
 *
 * Not the browser's. Kazakhstan is a single zone and the panel is mostly used
 * from inside it, so the two agree on most days — but an owner opening this
 * from abroad would have seen every booking shifted, and a booking near
 * midnight would have landed on the wrong day of the calendar entirely.
 *
 * The zone is threaded in from `GET /business` rather than read here, because
 * this file must stay a pure transform: the page fetches once and hands the
 * same answer to every view.
 */
export function toBlock(row, timeZone) {
  const start = partsIn(row.starts_at, timeZone)
  const end = partsIn(row.ends_at, timeZone)

  return {
    id: row.id,
    day: start.day,
    // The raw instant and the service it was booked from, kept alongside the
    // display forms below: editing a booking has to hand both straight back to
    // the API, and re-parsing "12:15" into a date would need the day, the zone
    // and a guess about which of the two it came from.
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    serviceId: row.service_id,
    start: start.minutes,
    // A booking running past midnight would otherwise end "before" it started.
    end: end.day === start.day ? end.minutes : 24 * 60,
    // Both the joined form and its two halves: the panel reads it as one
    // phrase, a narrow column stacks it over two lines.
    range: `${start.clock} – ${end.clock}`,
    from: start.clock,
    to: end.clock,
    client: row.client_name,
    phone: row.client_phone,
    service: row.service_name,
    minutes: row.duration_minutes,
    price: row.price,
    status: row.status,
    color: row.color,
    archived: row.archived,
    source: row.source,
    note: row.note,
  }
}

/**
 * The four states a booking can be put into.
 *
 * `pending` — what the assistant leaves behind when it books on its own — sits
 * in «Активно» rather than getting a fifth entry: from the owner's side it is
 * an active booking, and saving the form is what marks it as seen. The five
 * backend statuses map onto four here for that one reason and no other.
 *
 * In `lib` rather than beside the form, because two components read it: the
 * form offers them, and the details window names the current one.
 */
export const BOOKING_STATES = [
  { id: 'confirmed', label: 'Активно', covers: ['pending', 'confirmed'] },
  { id: 'completed', label: 'Завершено', covers: ['completed'] },
  { id: 'no_show', label: 'Не пришёл', covers: ['no_show'] },
  { id: 'cancelled', label: 'Отменено', covers: ['cancelled'] },
]

export const stateOf = (status) =>
  BOOKING_STATES.find((state) => state.covers.includes(status))?.id ??
  'confirmed'

export const statusLabel = (status) =>
  BOOKING_STATES.find((state) => state.id === stateOf(status))?.label ?? ''

/**
 * The marks a booking may carry, as name -> hue — **switched off in the UI, and
 * imported by nothing.**
 *
 * The picker was taken out of the booking panel and the grid draws every card
 * in the plain `surface-card` grey again. Nothing else was undone: the column
 * is still there, the values already written are still on their rows, and the
 * server still refuses a name outside this set. Two lines put it back — the
 * `PanelSelect` block noted in `BookingPopover`, and a `color-mix` of the tint
 * into the card fill in `Timetable`'s `BookingBlock`.
 *
 * **The names are the API's** — the server keeps the same closed set and
 * refuses anything outside it — and the hues are this app's answer to them, so
 * the palette can be retuned without touching a single stored row. It has been
 * retuned twice now, and not one row changed either time.
 *
 * **These six are constructed, not picked**, from a reference the owner gave
 * as the look wanted for a booking's background: `#ffd60a`, `#f8f9fa`,
 * `#495057`, `#d00000` — cool neutrals carrying two flat, near-gamut-edge
 * accents. What transfers from it is that character rather than those four
 * literals: two of the four are the neutrals a card and its ink already are,
 * and the closed set of names this app may store holds no yellow and no red.
 *
 * So: every one is OKLCH `L 0.74` at 97% of the chroma its own hue can reach in
 * sRGB — the reference's punch, which is what `#ffd60a` and `#d00000` both are
 * — on hues 20 / 75 / 150 / 198 / 258 / 308. The two warm ones are placed
 * against the reference: `rose` at 20° reaches for `#d00000` (29°) as far as
 * the word rose allows, and `orange` at 75° for `#ffd60a` (95°) as far as the
 * word orange does.
 *
 * **One lightness for all six is the part that is not negotiable.** The
 * hand-picked Tailwind 500s before this ran `L 0.61` (blue, violet) to `L 0.72`
 * (green), which is a visible step: the set read as six colours from six places
 * rather than as one palette, and the darker two looked heavier for no reason a
 * reader could name. Because these mix into the card at matching strength, ink
 * contrast on a marked booking now varies by half a point instead of by three —
 * 13.4–14.2 on the light theme, 8.1–8.7 on the dark.
 *
 * Chroma is *not* equalised, and cannot be: sRGB simply holds less cyan than it
 * does magenta at this lightness, so teal tops out around `C 0.12` where green
 * reaches `0.20`. Flattening everything to teal's ceiling would have paid for
 * an equality nobody can see with a palette nobody can.
 *
 * They are never painted at full strength either — every one is mixed into the
 * card's own fill at `BOOKING_TINT_MIX`, which is what keeps a marked booking a
 * *tinted card* rather than a coloured block. A week of saturated rectangles is
 * a week that looks like something is happening, which is the reason automatic
 * per-booking colour was taken out in the first place. What came back is a mark
 * the owner chooses, on the few bookings worth marking.
 */
export const BOOKING_TINTS = {
  rose: '#fc7f82',
  orange: '#e19b18',
  green: '#1bcc62',
  teal: '#1cc2c6',
  blue: '#76acfc',
  violet: '#c98afd',
}

/**
 * How much of the hue reaches the card, as a percentage.
 *
 * **One number, used by the grid and by the picker**, so the swatch in the list
 * and the card it produces cannot disagree — they were two literals in two
 * files, which is exactly the pair that drifts.
 *
 * 38, up from 16 and then 20. The low numbers made a *wash*: recognisable if
 * you knew which colour you had picked and barely a colour if you did not,
 * which is the opposite of what a mark is for. This is high enough to name at a
 * glance and still low enough that the card reads as tinted rather than
 * painted — ink stays legible on all six in both themes, which is the ceiling
 * that actually decides this.
 */
export const BOOKING_TINT_MIX = 38

/**
 * A colour per booking of a day, handed out by position — **imported by
 * nothing.**
 *
 * It was the first answer to telling one booking from another at a glance, and
 * it lost to a plainer argument: a week of coloured blocks is a week that looks
 * like something is happening, and nothing on that screen needed a colour to
 * mean anything. `BOOKING_TINTS` above is what replaced it — the same idea,
 * except the owner decides which few bookings are worth marking.
 *
 * Kept for the day something does need a colour of its own. Eight is enough
 * that a day repeats only past eight bookings, and few enough that they stay
 * tellable apart. `#DC2626` and `#16A34A` are deliberately absent: they mean
 * "error" and "up" elsewhere in this app, and a booking that happened to be
 * sixth would look like a warning.
 */
export const BOOKING_COLORS = [
  '#3248F2', // indigo — the brand accent
  '#7C3AED', // violet
  '#C026D3', // fuchsia
  '#E11D63', // rose
  '#EA6A1E', // orange
  '#C99A00', // gold
  '#2FA36B', // green
  '#0E96C7', // cyan
]

/**
 * The colour of the `index`-th booking of a day.
 *
 * By position within the day rather than hashed from the id: a hash collides,
 * and two bookings an hour apart wearing the same colour is exactly what this
 * is meant to prevent. Every view sorts a day the same way — see `byStart` —
 * so the same booking comes out the same colour wherever it is drawn.
 */
export const bookingColor = (index) =>
  BOOKING_COLORS[index % BOOKING_COLORS.length]

/**
 * The order a day is read in, and the order its colours are handed out in.
 *
 * The tiebreak on `id` is what makes it total: two bookings starting at the
 * same minute would otherwise be left in whatever order the API returned them,
 * and could swap colours between the month and the day list.
 */
export const byStart = (a, b) => a.start - b.start || a.id.localeCompare(b.id)

/* --- reading and writing the same booking elsewhere ---------------------- */

/**
 * Whether two ISO strings name the same moment.
 *
 * Compared as instants rather than as text, deliberately: `/appointments/slots`
 * returns times in the business's offset and a booking returns its start in
 * UTC, so the very same 12:15 arrives spelled two different ways. Matching the
 * strings is what made an edit form fail to highlight the time it was already
 * booked for.
 */
export const sameInstant = (a, b) =>
  Boolean(a) && Boolean(b) && new Date(a).getTime() === new Date(b).getTime()

/**
 * The instant at which a wall-clock time on a given day falls, in a named zone.
 *
 * The inverse of `partsIn`, and the harder direction: a browser can read any
 * zone but can only *construct* dates in its own, so "14:30 in Asia/Almaty" has
 * to be worked out rather than asked for. The method is to guess that the wall
 * clock is UTC, ask what that instant looks like in the target zone, and shift
 * by the difference — then do it once more, because the offset that applies is
 * the one at the *answer*, not at the guess, and near a daylight-saving change
 * those differ by an hour. Kazakhstan has no such change and one pass would do;
 * the second costs nothing and makes this correct anywhere.
 *
 * `day` is `YYYY-MM-DD` and `clock` is `HH:MM` — the two shapes every caller
 * here already holds. Returns an ISO string with a real offset on it, which is
 * what the API needs: a naive datetime would be read against whatever clock the
 * *server* keeps.
 */
export function instantAt(day, clock, timeZone) {
  const [year, month, date] = day.split('-').map(Number)
  const [hours, minutes] = clock.split(':').map(Number)
  const guess = Date.UTC(year, month - 1, date, hours, minutes)

  const offsetAt = (ms) => {
    const at = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(ms))
        .map((part) => [part.type, part.value]),
    )
    const shown = Date.UTC(
      Number(at.year),
      Number(at.month) - 1,
      Number(at.day),
      Number(at.hour),
      Number(at.minute),
      Number(at.second),
    )
    return shown - ms
  }

  const first = guess - offsetAt(guess)
  return new Date(guess - offsetAt(first)).toISOString()
}

/** "12:15", in the business's zone — the same zone `toBlock` reads. */
export const clockOf = (iso, timeZone) => partsIn(iso, timeZone).clock

/**
 * The calendar day an instant falls on in a named zone, as `YYYY-MM-DD`.
 *
 * The same string `toBlock` puts on a booking, so "is this happening today?" is
 * a comparison rather than a second date calculation — and read in the
 * business's zone, because near midnight the browser's answer and the
 * business's are different days.
 */
export const dayOf = (iso, timeZone) => partsIn(iso, timeZone).day

/** Where an instant falls in its own day, in minutes — for grouping slots. */
export const minutesOf = (iso, timeZone) => partsIn(iso, timeZone).minutes

/** The clock time a service of `minutes` starting at `iso` would finish at. */
export const endClock = (iso, minutes, timeZone) =>
  partsIn(new Date(new Date(iso).getTime() + minutes * 60000), timeZone).clock

export const formatPrice = (value) => `${value.toLocaleString('ru-RU')} ₸`

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} мин`
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

/** "13:00" → 780. Null for a day that has no break. */
export function parseClock(text) {
  if (!text) return null
  const [hours, minutes] = text.split(':').map(Number)
  return hours * 60 + minutes
}

export const fromMinutes = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(
    minutes % 60,
  ).padStart(2, '0')}`

export function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function addDays(date, count) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + count)
  return copy
}

/**
 * Works out how wide each booking may be and which slice of the column it
 * takes, so overlapping ones sit side by side instead of on top of each other.
 *
 * Two bookings at the same hour is not a bug — a business with `capacity` above
 * one is expected to have them, and hiding the second behind the first would
 * make the day look emptier than it is.
 *
 * The width is decided per *cluster* of mutually overlapping bookings, not per
 * day: one busy hour in the morning must not make every booking after it half
 * as wide.
 *
 * Returns new objects rather than annotating the ones passed in. Those come
 * straight out of React state, and writing a layout result onto them would make
 * the same booking mean different things depending on when it was last drawn.
 */
export function layoutDay(blocks) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end)

  const placed = []
  let cluster = []
  let clusterEnd = 0

  const flush = () => {
    // Greedy lanes: reuse the leftmost one whose last booking has finished.
    const laneEnds = []
    const lanes = cluster.map((block) => {
      let lane = laneEnds.findIndex((end) => end <= block.start)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[lane] = block.end
      return lane
    })

    cluster.forEach((block, index) => {
      placed.push({ ...block, lane: lanes[index], lanes: laneEnds.length })
    })
    cluster = []
  }

  for (const block of sorted) {
    if (cluster.length > 0 && block.start >= clusterEnd) flush()
    cluster.push(block)
    clusterEnd =
      cluster.length === 1 ? block.end : Math.max(clusterEnd, block.end)
  }
  if (cluster.length > 0) flush()

  return placed
}
