import { dayKey } from './dates'
import { closedRanges } from './schedule'

const MINUTES_IN_DAY = 24 * 60

/**
 * How full a week is, hour by hour — the arithmetic under «Загрузка».
 *
 * Counted at minute resolution (seven arrays of 1440), because a booking at
 * 14:20–15:05 and a break at 13:00–14:00 never line up with the hour cells they
 * are drawn in, and minutes make every overlap exact without a case for each.
 *
 * - **Only what claims time counts**: cancelled bookings gave their hour back
 *   and open-ended ones claim no stretch — the same line `BLOCKING_STATUSES`
 *   draws on the server and the agenda draws on the phone.
 * - **`capacity` is the denominator**, so a business with two chairs is half
 *   full with one client, not full. Parallel bookings past it are clamped:
 *   a third client in a two-chair hour does not make it 150%.
 * - **The percentage is of open time only.** A booking written outside hours
 *   is still drawn in its cell, but counting it would let a busy evening after
 *   closing push the week past what the business offered.
 *
 * `hours` is `GET /business/working-hours` (weekday 0 = Monday), `bookings`
 * are `toBlock` rows, `days` the seven dates of the week, Monday first.
 */
export function weekLoad({ days, hours, bookings, capacity = 1 }) {
  const chairs = Math.max(1, capacity)
  const keys = days.map(dayKey)

  const open = keys.map((_, index) => {
    const minutes = new Uint8Array(MINUTES_IN_DAY).fill(1)
    const row = hours?.find((item) => item.weekday === index)
    for (const range of closedRanges(row)) minutes.fill(0, range.from, range.to)
    return minutes
  })

  const taken = keys.map(() => new Uint8Array(MINUTES_IN_DAY))
  for (const booking of bookings) {
    if (booking.status === 'cancelled' || booking.open) continue
    const index = keys.indexOf(booking.day)
    if (index === -1) continue
    const minutes = taken[index]
    for (let minute = booking.start; minute < booking.end; minute += 1) {
      if (minutes[minute] < chairs) minutes[minute] += 1
    }
  }

  // The rows drawn: from the earliest opening to the latest closing in the
  // week, widened to any booking outside them so nothing booked is off-grid.
  let first = 24
  let last = 0
  keys.forEach((_, index) => {
    for (let minute = 0; minute < MINUTES_IN_DAY; minute += 1) {
      if (open[index][minute] || taken[index][minute]) {
        first = Math.min(first, Math.floor(minute / 60))
        last = Math.max(last, Math.floor(minute / 60) + 1)
      }
    }
  })

  let openTotal = 0
  let takenTotal = 0
  const cells = keys.map((_, index) => {
    const row = []
    for (let hour = first; hour < last; hour += 1) {
      let openMinutes = 0
      let takenMinutes = 0
      let takenOpen = 0
      for (let minute = hour * 60; minute < hour * 60 + 60; minute += 1) {
        const isOpen = open[index][minute]
        const count = taken[index][minute]
        openMinutes += isOpen
        takenMinutes += count
        if (isOpen) takenOpen += count
      }
      openTotal += openMinutes
      takenTotal += takenOpen
      row.push({
        hour,
        open: openMinutes > 0,
        // Share of what the hour could hold: its open minutes when it has
        // any, the whole hour when the booking sits outside opening time.
        share: takenMinutes / (chairs * (openMinutes || 60)),
      })
    }
    return row
  })

  return {
    first,
    last,
    cells,
    openMinutes: openTotal,
    takenMinutes: takenTotal / chairs,
    percent: openTotal ? Math.round((takenTotal / (chairs * openTotal)) * 100) : 0,
  }
}

