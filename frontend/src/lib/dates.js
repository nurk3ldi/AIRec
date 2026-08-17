/**
 * Russian date names and the small amount of calendar arithmetic that goes
 * with them.
 *
 * Written out rather than taken from `Intl`, which returns "авг.",
 * "24 августа 2026 г." and a lowercase "апрель" — every one of which would
 * have to be trimmed or capitalised by hand, and the trimming is the part that
 * breaks quietly when a locale changes shape.
 */

export const MONTHS_SHORT = [
  'ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН',
  'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК',
]

/** Genitive — these only ever appear after a day number: "24 августа". */
export const MONTHS_OF = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

/** For a date squeezed into a narrow column: "31 авг 2026". */
export const MONTHS_ABBR = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

/** Nominative — the month standing on its own: "Апрель 2025". */
export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

/**
 * Indexed by `Date.getDay()`, so Sunday is 0 — deliberately *not* the same
 * order as the backend's `weekday`, which starts on Monday.
 */
export const DAY_NAMES = [
  'Воскресенье', 'Понедельник', 'Вторник', 'Среда',
  'Четверг', 'Пятница', 'Суббота',
]

/** Column headings, Monday first — how a week is read here. */
export const DAY_LETTERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** Monday of the week `date` falls in. */
export function weekStart(date) {
  const start = new Date(date)
  // getDay() is Sunday-first; shifting by 6 puts Sunday at the end of its week
  // rather than the start of the next one.
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  start.setHours(0, 0, 0, 0)
  return start
}

/**
 * One step forward or back, by whatever is on screen.
 *
 * Lives here because both the toolbar's arrows and the calendar's own do it,
 * and a second copy would be a second answer to "how far is one step" the day
 * a month view is added.
 */
export function shiftDate(date, view, direction) {
  const next = new Date(date)
  next.setDate(next.getDate() + direction * (view === 'week' ? 7 : 1))
  return next
}

/** The seven days of the week `date` falls in, Monday first. */
export function weekDays(date) {
  const first = weekStart(date)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(first)
    day.setDate(first.getDate() + index)
    return day
  })
}

/**
 * The block of days a month is drawn in — always **six weeks**, Monday first.
 *
 * Fixed rather than however many the month happens to need. Six is the most any
 * month can take (a 31-day month starting on a Sunday runs to 37 cells), so a
 * constant block is the only one that both fits every month and keeps a day the
 * same size in February as in October. Sizing each month to its own row count
 * saved a row four times a year at the price of the whole grid resizing under
 * the pointer every time the month was stepped through.
 */
export function monthGrid(date) {
  const start = weekStart(new Date(date.getFullYear(), date.getMonth(), 1))
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

/**
 * One month forward or back, landing on the 1st.
 *
 * Through the `Date` constructor rather than `setMonth`, which keeps the day of
 * the month and so turns 31 March into 2 March on the way back to February.
 */
export const shiftMonth = (date, direction) =>
  new Date(date.getFullYear(), date.getMonth() + direction, 1)

export const sameMonth = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()

/**
 * A year and month as one sortable number.
 *
 * Browsing months is "one more, one less", and doing that on a `Date` means
 * remembering that January minus one is last December. A single integer makes
 * the arithmetic ordinary, and it compares by value rather than by identity —
 * so a component can hold it in state without re-rendering every time a new
 * `Date` object for the same month arrives.
 */
export const monthIndex = (date) => date.getFullYear() * 12 + date.getMonth()

/**
 * `YYYY-MM-DD` in local time.
 *
 * `toISOString` would be one line shorter and wrong: it converts to UTC first,
 * which shifts the date by a day for any evening in a zone east of Greenwich —
 * which is every zone this product runs in.
 */
export function dayKey(day) {
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${date}`
}

export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
