/**
 * Arithmetic and rules for a working week.
 *
 * Lives here rather than inside `WorkingHours.jsx` because two callers need it:
 * the card renders the verdict under the offending row, and the page it sits on
 * uses the same verdict to decide whether Save may run at all. A copy in each
 * would be two rules that agree only until one of them is edited.
 */

/** Minutes since midnight, from a `"HH:MM"` string. */
export const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export const formatSpan = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} мин`
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

/**
 * Hours the business is actually open that day — the working span minus the
 * break. Derived rather than entered, so it can't disagree with the times next
 * to it, and it turns a row of settings into a row that also answers "how long
 * is this day?".
 */
export const openMinutes = (item) => {
  if (!item.from || !item.to) return null
  const span = toMinutes(item.to) - toMinutes(item.from)
  const rest =
    item.breakFrom && item.breakTo
      ? toMinutes(item.breakTo) - toMinutes(item.breakFrom)
      : 0
  const total = span - Math.max(rest, 0)
  // A closing time before the opening one is a mistake, not a negative day.
  return total > 0 ? total : null
}

const MINUTES_IN_DAY = 24 * 60

/**
 * The stretches of a day the business *is* open, as `[fromMinute, toMinute]`.
 *
 * The mirror image of `closedRanges`, and deliberately a separate function
 * rather than one with a flag: this one speaks the card's vocabulary (`from`,
 * `breakFrom`, `is24h`) where that one speaks the API's (`opens_at`,
 * `break_starts_at`, `is_24h`), and the two shapes meet nowhere else.
 *
 * It exists for the week bar in `WorkingHours`, which needs the open stretches
 * as geometry — a break is what makes a day two bars instead of one, and it is
 * the only thing a row of times cannot show at a glance.
 */
export function openSpans(item) {
  if (!item) return []
  if (item.is24h) return [[0, MINUTES_IN_DAY]]
  if (!item.from || !item.to) return []

  const opens = toMinutes(item.from)
  const closes = toMinutes(item.to)
  // A day that reads as nonsense draws nothing rather than drawing backwards;
  // `dayProblem` is what tells the owner about it.
  if (closes <= opens) return []

  if (item.breakFrom && item.breakTo) {
    const from = toMinutes(item.breakFrom)
    const to = toMinutes(item.breakTo)
    if (from > opens && to < closes && to > from) {
      return [
        [opens, from],
        [to, closes],
      ]
    }
  }
  return [[opens, closes]]
}

/**
 * Whether the business is shut all day.
 *
 * A missing row reads as *open*, not closed: it means the week hasn't arrived
 * yet, and marking a day the business may well be working as a day off is the
 * worse of the two wrong answers.
 */
export const isDayOff = (row) =>
  Boolean(row) && !row.is_24h && !row.opens_at

/**
 * The stretches of a day the business is shut, as `{from, to, kind}`.
 *
 * The inverse of what `WorkingHours` stores, because that is what the calendar
 * has to draw: a grid of twenty-four identical hours cannot say that Sunday is
 * closed or that nobody is there at lunch, and the owner ends up learning it
 * from the server refusing a booking.
 *
 * Takes the API's shape (`opens_at`, `is_24h`, …) rather than the card's edited
 * one — the grid reads the week straight from `GET /business/working-hours`.
 *
 * A missing row shades nothing rather than everything: it means the week has
 * not arrived yet, and greying out a day the business may well be open is the
 * worse of the two wrong answers.
 *
 * **`kind` is what the caller labels the block with**, and the three are not
 * interchangeable. `off` is a day the business does not work at all, `break` is
 * the hour nobody is there in the middle of one, and `shut` is simply the time
 * either side of opening hours. Only the first two are worth writing a word on
 * the grid for — "closed before 10:00" is what the empty grid already says —
 * so the distinction has to survive out of this function rather than being
 * re-derived from the times by whoever draws it.
 */
export function closedRanges(row) {
  if (!row || row.is_24h) return []
  if (!row.opens_at || !row.closes_at)
    return [{ from: 0, to: MINUTES_IN_DAY, kind: 'off' }]

  const opens = toMinutes(row.opens_at)
  const closes = toMinutes(row.closes_at)

  const ranges = []
  if (opens > 0) ranges.push({ from: 0, to: opens, kind: 'shut' })

  if (row.break_starts_at && row.break_ends_at) {
    const from = toMinutes(row.break_starts_at)
    const to = toMinutes(row.break_ends_at)
    if (to > from) ranges.push({ from, to, kind: 'break' })
  }

  if (closes < MINUTES_IN_DAY)
    ranges.push({ from: closes, to: MINUTES_IN_DAY, kind: 'shut' })
  return ranges
}

/**
 * What is wrong with putting a booking here, or `null` if nothing is.
 *
 * **A warning, not a refusal.** The server used to reject any booking outside
 * opening hours whoever was making it; it no longer does for the owner, and
 * this is what replaced that check. A booking written by hand is a record of
 * something agreed or already done — somebody came during the break, somebody
 * was fitted in after closing — and a calendar that will not write those down
 * is arguing with the day it exists to record. What is left is the real risk
 * the old check also caught, a mistyped date, and a warning catches that
 * *before* Save while there is still something to correct.
 *
 * The assistant is still refused by the server. This is the owner's panel.
 *
 * `from`/`to` are minutes of the day. An end at or before the start is a
 * booking running past midnight, which no pair of clock columns can express as
 * open — so it is measured to the end of the day and will report `shut` unless
 * the day is round-the-clock.
 *
 * A missing row means the week has not loaded and reports nothing, the same
 * choice `closedRanges` makes: a warning invented out of data that has not
 * arrived is worse than no warning at all.
 */
export function hoursProblem(row, from, to) {
  if (!row || row.is_24h) return null
  if (from == null || to == null) return null

  const end = to > from ? to : MINUTES_IN_DAY
  const hit = closedRanges(row).find(
    (range) => range.from < end && from < range.to,
  )
  return hit?.kind ?? null
}

/**
 * The stretches of a day that are open and unbooked, as `[from, to]` minutes.
 *
 * The complement of everything in the way: the hours the business is shut
 * (`closedRanges` — before opening, the break, after closing) *and* the hours
 * already taken. Both are subtracted in one pass rather than two, because they
 * overlap constantly — a booking that runs up to the break leaves no gap
 * between them, and treating the two lists separately would invent one.
 *
 * `busy` is `[from, to]` pairs in the same minute-of-day units, which is what
 * `toBlock` already produces. Kept in this shape on purpose: this file knows
 * about the week, not about bookings, and handing it a list of appointment
 * objects would be the first thread of a knot.
 *
 * `notBefore` is where to start looking — the current minute, for "what is
 * free from now". Passing 0 gives the whole day.
 *
 * A missing row means the week has not loaded, and reports the day as open
 * rather than closed: the same choice `closedRanges` makes, for the same reason
 * — telling an owner their working day is over because a request is in flight
 * is the worse of the two wrong answers.
 */
export function freeWindows(row, busy, notBefore = 0) {
  const blocked = [
    ...closedRanges(row).map((range) => [range.from, range.to]),
    ...busy,
  ].sort((a, b) => a[0] - b[0])

  const free = []
  let cursor = notBefore

  for (const [from, to] of blocked) {
    // Already behind us, whole or in part: only the far edge can move the
    // cursor, and it only moves forward.
    if (to <= cursor) continue
    if (from > cursor) free.push([cursor, from])
    cursor = Math.max(cursor, to)
  }
  if (cursor < MINUTES_IN_DAY) free.push([cursor, MINUTES_IN_DAY])

  return free
}

/**
 * What is wrong with this day, in Russian, or `null` if nothing is.
 *
 * Deliberately mirrors the checks `WorkingHoursInput` runs on the backend: the
 * server is the one that has to be right, but a 422 arriving after Save names
 * a weekday number, not the row the owner is looking at. Catching it here is
 * about pointing at the row, not about trusting the client.
 *
 * A day that closes before it opens is rejected rather than read as running
 * past midnight — the two time columns cannot express "next day", and guessing
 * would turn a typo into a twenty-two-hour day. An all-night business marks the
 * day as round the clock instead.
 */
export function dayProblem(item) {
  // Round the clock owns no times, and a closed day has none to check.
  if (item.is24h || !item.from || !item.to) return null

  if (toMinutes(item.to) <= toMinutes(item.from)) {
    return 'Конец рабочего дня должен быть позже начала.'
  }

  if (Boolean(item.breakFrom) !== Boolean(item.breakTo)) {
    return 'Укажите начало и конец перерыва.'
  }

  if (item.breakFrom) {
    if (toMinutes(item.breakTo) <= toMinutes(item.breakFrom)) {
      return 'Конец перерыва должен быть позже начала.'
    }
    if (
      toMinutes(item.breakFrom) < toMinutes(item.from) ||
      toMinutes(item.breakTo) > toMinutes(item.to)
    ) {
      return 'Перерыв должен быть внутри рабочего дня.'
    }
  }

  return null
}
