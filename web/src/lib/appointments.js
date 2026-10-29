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
  // **A booking may have no end**, and `null` travels the whole way rather than
  // being filled in with a guess here. Every screen that draws one has to know
  // the difference — a card with no end is a length nobody stated, and drawing
  // it as though somebody had is the one thing this must not do.
  const end = row.ends_at ? partsIn(row.ends_at, timeZone) : null

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
    // `null` when there is no end at all — see `open` below, which is the flag
    // to branch on; this stays null so that arithmetic done on it fails loudly
    // rather than silently placing a card somewhere.
    end: end ? (end.day === start.day ? end.minutes : 24 * 60) : null,
    /** No end time: the client is here and nobody has said until when. */
    open: end === null,
    // Both the joined form and its two halves: the panel reads it as one
    // phrase, a narrow column stacks it over two lines. With no end the dash
    // stays and the second clock does not — «12:00 –» is the honest reading,
    // and it is also what tells a glance that the end is missing rather than
    // that the booking is a moment long.
    range: end ? `${start.clock} – ${end.clock}` : `${start.clock} –`,
    from: start.clock,
    to: end ? end.clock : null,
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
 * What colour a booking's status is said in, as a text class.
 *
 * **Three of the four get one, and `cancelled` is the grey.** That is the
 * exception on purpose: it gave its hour back — see `BLOCKING_STATUSES` — so it
 * is the one row that is not an appointment any more, and the card already
 * fades to say so. Colouring it would point at the one booking nobody has to
 * look at.
 *
 * None of the three is a new hue. `completed` is `ok`, the green this project
 * already means "done" with; `no_show` is `danger`, the red it already means
 * "this went wrong" with; `confirmed` is `--now`, the colour that already means
 * "the present moment" here.
 *
 * It lives beside `statusLabel` rather than in a component because two screens
 * read it — the grid and the phone's search results — and two copies of a
 * three-line map are two maps that agree until one is restyled.
 */
const STATUS_TONE = {
  confirmed: 'text-now',
  completed: 'text-ok',
  no_show: 'text-danger',
}

export const statusTone = (status) => STATUS_TONE[stateOf(status)] ?? 'text-muted'

/**
 * The marks a booking may carry, as name -> hue.
 *
 * **It is a dot, never the fill of a card.** An automatic hue per booking stood
 * on the grid once and came off: a week of coloured blocks is a week that looks
 * like something is happening, and every line on a tinted card has to be
 * re-checked against a new ground. What came back on 2026-09-10 is the same
 * idea reduced to the smallest thing that can carry it — six pixels beside the
 * client's name on the day's cards in «Диалоги», where telling one card from
 * the next at a glance is the whole job. The grid is unchanged and still says
 * the status in the colour of one word (`STATUS_TONE` in `Timetable`).
 */
export const BOOKING_TINTS = {
  indigo: '#3248F2',
  violet: '#7C3AED',
  fuchsia: '#C026D3',
  rose: '#E11D63',
  orange: '#EA6A1E',
  gold: '#C99A00',
  green: '#2FA36B',
  cyan: '#0E96C7',
}

/**
 * What a booking's card is filled with — its mark, exactly as the swatch shows
 * it, or the ordinary card grey.
 *
 * **The hex itself, not a mix of it.** It was `color-mix(… 32%, surface-card)`
 * for a day, which made a card that was recognisably *related* to the colour
 * picked and never the same colour — indigo came out slate, fuchsia came out
 * plum, and the swatch in the panel and the card on the grid disagreed about
 * what the owner had chosen. A mark whose whole job is to be matched against
 * another mark cannot be a shade of itself.
 *
 * **Only a colour the owner chose paints a card.** The automatic one is a dot
 * on a list and stops there: a week of coloured blocks is a week that looks
 * like something is happening, which is the argument that took per-booking
 * colour off the grid in the first place, and it applies exactly as much to a
 * hue nobody asked for. A mark the owner put on three bookings is the opposite
 * — they are the three worth spotting.
 */
export const cardFill = (color) =>
  BOOKING_TINTS[color] ?? 'var(--color-surface-card)'

/**
 * What to write on that fill — white or the ink, whichever the colour can
 * carry, and `null` on an unmarked card so it keeps the theme's own tokens.
 *
 * **Painting the card at full strength is what makes this necessary.** `--ink`
 * is white on the dark theme and near-black on the light one, and neither
 * survives all eight: white on gold is 2.2:1 and black on indigo is 2.6:1, both
 * unreadable. A marked card is the same colour in both themes, so what is
 * written on it cannot follow the theme either — it follows the fill.
 *
 * The test is the WCAG contrast ratio of each candidate against the fill, which
 * comes out four cards in white and four in black. That the eight are not
 * uniform is a fact about the colours rather than a wrinkle to smooth over:
 * gold and white is the pairing nobody can read.
 */
export function cardInk(color) {
  const hex = BOOKING_TINTS[color]
  if (!hex) return null

  // WCAG relative luminance: sRGB channels linearised, then weighted for the
  // eye's own sensitivity — which is why green counts for seven times what blue
  // does and why `#2FA36B` takes black where `#3248F2` takes white.
  const channel = (value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  const [r, g, b] = [1, 3, 5].map((at) =>
    channel(Number.parseInt(hex.slice(at, at + 2), 16) / 255),
  )
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b

  // Against white the ratio is 1.05 / (L + 0.05); against black, (L + 0.05) /
  // 0.05. Comparing them is comparing those two, and they cross at L ≈ 0.179.
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05
    ? '#ffffff'
    : '#171215'
}

/**
 * The palette, in the order it is handed out.
 *
 * **Names, not hexes, because a name is what the row stores.** The server keeps
 * the same closed set and refuses anything outside it; what each name *looks*
 * like is this file's answer, which is the only way the palette can be retuned
 * without an `UPDATE` over every booking ever written, and the only way a mark
 * could ever differ between the light theme and the dark one. It has been
 * retuned twice and not one stored row changed either time.
 *
 * **Eight, because eight is how many bookings a day can hold before two of them
 * look alike.** The six constructed at one OKLCH lightness that stood here
 * before were built to be *mixed* into a card, where matching lightness is what
 * keeps ink legible on all of them; as dots they read as six pastels, and a
 * card carrying one read as a shade rather than as the colour picked. These are
 * the saturated set the owner asked for, painted as they are — see `cardFill`,
 * and `cardInk` for what that costs.
 *
 * `#DC2626` and `#16A34A` are deliberately absent: they mean "error" and "up"
 * elsewhere in this app, and a booking that happened to be sixth would look
 * like a warning.
 */
export const BOOKING_COLORS = Object.keys(BOOKING_TINTS)

/**
 * What a colour name is drawn in — and grey for anything unknown.
 *
 * A row could hold a name this build has never heard of: the set has been
 * renamed once, and a client older than the server is the ordinary way that
 * happens. Falling back to the muted grey draws a booking with no mark rather
 * than a card with a hole in it.
 */
export const tintOf = (name) => BOOKING_TINTS[name] ?? 'var(--color-muted)'

/**
 * Which colour every booking of a day wears, as a `Map` of id to name.
 *
 * **Two rules, and they answer to different people.** A colour the owner
 * *chose* is used exactly as chosen — including on five bookings at once, which
 * is a perfectly good way to say "these five are the same job" and is why
 * nothing here refuses a repeat. A booking with no colour of its own is handed
 * one, and those must not collide: the whole point of an automatic mark is that
 * two cards side by side are told apart without reading them.
 *
 * So the automatic ones are handed out from the names *not already spoken for*
 * by a manual choice on that day, in palette order, and only when those run out
 * does the walk go round again — the day is bigger than the palette at that
 * point, and repeating is the honest answer to a set that has genuinely been
 * exhausted.
 *
 * **By position within the day, not hashed from the id.** A hash collides, and
 * two bookings an hour apart wearing the same colour is exactly what this
 * exists to prevent. Every view sorts a day the same way — see `byStart` — so
 * the same booking comes out the same colour wherever it is drawn.
 */
export function dayColors(blocks) {
  const chosen = new Set(
    (blocks ?? []).map((block) => block.color).filter(Boolean),
  )
  const free = BOOKING_COLORS.filter((name) => !chosen.has(name))
  const pool = free.length > 0 ? free : BOOKING_COLORS

  let next = 0
  const painted = new Map()
  for (const block of blocks ?? []) {
    painted.set(block.id, block.color ?? pool[next++ % pool.length])
  }

  return painted
}

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
/**
 * How long a booking with no end is *drawn* as.
 *
 * **A drawing length, not a claim.** The server stores nothing for it and the
 * assistant goes on offering the time — see `ends_at` on the model — so this
 * number exists only so the card has somewhere to stop. Forty-five minutes is
 * what makes it stop somewhere useful: at the desktop grid's usual hour it is
 * a little over ninety pixels, which is where a card has room for the status,
 * the client and the service, and on the phone's fixed 80px hour it is sixty,
 * which holds a name and a time. Shorter and the card cannot say who is in it;
 * longer and an unknown starts taking up more of the day than the bookings that
 * are actually known.
 *
 * The card's bottom edge is faded out wherever this is used, so the length
 * reads as "still going" rather than as a booking that ends at 12:45.
 */
export const OPEN_MINUTES = 45

/**
 * Where a booking stops for the purpose of laying out a day.
 *
 * The one place the drawn length stands in for a real one. Overlap has to be
 * decided on what is *on screen*: two cards that visually cover each other must
 * be given lanes, however little the open one claims about the day.
 */
export function endOf(block) {
  return block.end ?? block.start + OPEN_MINUTES
}

export function layoutDay(blocks) {
  const sorted = [...blocks].sort(
    (a, b) => a.start - b.start || endOf(b) - endOf(a),
  )

  const placed = []
  let cluster = []
  let clusterEnd = 0
  // Which chain of overlaps a block belongs to. `lanes` says how many ways the
  // column is split and `lane` says which one this is, but neither says *whose
  // company* a booking is in — and a narrow week column has to be able to
  // gather a whole cluster into one card. Bumped per flush, so it is unique
  // within the day and means nothing beyond it.
  let clusterIndex = 0

  const flush = () => {
    // Greedy lanes: reuse the leftmost one whose last booking has finished.
    const laneEnds = []
    const lanes = cluster.map((block) => {
      let lane = laneEnds.findIndex((end) => end <= block.start)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[lane] = endOf(block)
      return lane
    })

    cluster.forEach((block, index) => {
      placed.push({
        ...block,
        lane: lanes[index],
        lanes: laneEnds.length,
        cluster: clusterIndex,
      })
    })
    clusterIndex += 1
    cluster = []
  }

  for (const block of sorted) {
    if (cluster.length > 0 && block.start >= clusterEnd) flush()
    cluster.push(block)
    clusterEnd =
      cluster.length === 1 ? endOf(block) : Math.max(clusterEnd, endOf(block))
  }
  if (cluster.length > 0) flush()

  return placed
}
