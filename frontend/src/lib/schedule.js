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
 * Whether the business is shut all day.
 *
 * A missing row reads as *open*, not closed: it means the week hasn't arrived
 * yet, and marking a day the business may well be working as a day off is the
 * worse of the two wrong answers.
 */
export const isDayOff = (row) =>
  Boolean(row) && !row.is_24h && !row.opens_at

/**
 * The stretches of a day the business is shut, as `[fromMinute, toMinute]`.
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
 */
export function closedRanges(row) {
  if (!row || row.is_24h) return []
  if (!row.opens_at || !row.closes_at) return [[0, MINUTES_IN_DAY]]

  const opens = toMinutes(row.opens_at)
  const closes = toMinutes(row.closes_at)

  const ranges = []
  if (opens > 0) ranges.push([0, opens])

  if (row.break_starts_at && row.break_ends_at) {
    const from = toMinutes(row.break_starts_at)
    const to = toMinutes(row.break_ends_at)
    if (to > from) ranges.push([from, to])
  }

  if (closes < MINUTES_IN_DAY) ranges.push([closes, MINUTES_IN_DAY])
  return ranges
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
