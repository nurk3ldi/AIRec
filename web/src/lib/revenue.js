import { dayKey } from './dates'

/**
 * Whether a booking's price is money the business has or is owed.
 *
 * `confirmed` and `completed` are. `cancelled` gave its hour back and a
 * `no_show` held the slot without paying for it. **`pending` depends on who
 * wrote it**: from the assistant it is a request nobody has agreed to yet, but
 * the panel creates the owner's own bookings as `pending` too (the server's
 * default) and shows them as «Активно» — so a manual one is booked money.
 */
const earns = (row) =>
  row.status === 'confirmed' ||
  row.status === 'completed' ||
  (row.status === 'pending' && row.source === 'manual')

/**
 * The week's takings, day by day — the arithmetic under «Выручка».
 *
 * `days` are the seven dates of this week, Monday first; `bookings` are
 * `toBlock` rows covering this week *and the one before it*, which is what the
 * comparison is made against. A confirmed booking later this week counts:
 * it is booked money, and leaving it out would make every Monday look like a
 * collapse against a finished week.
 *
 * `change` is the percentage against last week, or `null` when last week took
 * nothing — growth from zero is not a percentage anybody can read.
 */
export function weekRevenue({ days, bookings }) {
  const keys = days.map(dayKey)
  const previous = days.map((day) =>
    dayKey(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 7)),
  )

  const sumOf = (key) =>
    bookings
      .filter((row) => row.day === key && earns(row))
      .reduce((total, row) => total + (row.price || 0), 0)

  const perDay = keys.map(sumOf)
  const total = perDay.reduce((a, b) => a + b, 0)
  const before = previous.map(sumOf).reduce((a, b) => a + b, 0)

  return {
    perDay,
    total,
    before,
    change: before > 0 ? Math.round(((total - before) / before) * 100) : null,
  }
}
