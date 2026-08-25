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
 * The colours a booking wears in the calendar and in the day list.
 *
 * They mark *which booking* — not what became of it. Status used to pick the
 * colour, and the result was a screen of black: almost every booking is an
 * ordinary live one, so a status palette paints them all the same and tells you
 * nothing you couldn't already see. Identity is the thing that actually differs
 * from row to row, so identity is what gets the colour.
 *
 * Chosen as a family rather than picked apart: one saturation band, one
 * lightness band, evenly spaced around the wheel, with the brand accent as the
 * first of them so the product's own blue belongs to the set instead of
 * standing outside it. `#DC2626` and `#16A34A` are deliberately *not* here —
 * they mean "error" and "up" elsewhere in this app, and a booking that happens
 * to be sixth would otherwise look like a warning.
 *
 * Eight is enough that a day repeats a colour only past eight bookings, and
 * few enough that they stay tellable apart.
 */
/**
 * The marks a booking may carry, as name → hue.
 *
 * **The names are the API's** — the server keeps the same closed set and
 * refuses anything outside it — and the hues are this app's answer to them, so
 * the palette can be retuned without touching a single stored row.
 *
 * They are never painted at full strength. Every one is mixed into the card's
 * own fill at a low percentage where it is drawn, which is what keeps a marked
 * booking a *tinted card* rather than a coloured block: a week of saturated
 * rectangles is a week that looks like something is happening, which is the
 * reason per-booking colour was taken out in the first place. What came back is
 * a mark the owner chooses, on the few bookings worth marking.
 */
export const BOOKING_TINTS = {
  orange: '#ea6a1e',
  green: '#16a34a',
  blue: '#3248f2',
  violet: '#7c3aed',
  rose: '#e11d63',
  teal: '#0e96c7',
}

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
        .map((part) => [part.type, part.value])
    )
    const shown = Date.UTC(
      Number(at.year),
      Number(at.month) - 1,
      Number(at.day),
      Number(at.hour),
      Number(at.minute),
      Number(at.second)
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
    minutes % 60
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
    clusterEnd = cluster.length === 1 ? block.end : Math.max(clusterEnd, block.end)
  }
  if (cluster.length > 0) flush()

  return placed
}
