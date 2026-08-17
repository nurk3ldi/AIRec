/** Turning the API's bookings into something the calendar can place. */

import { dayKey } from './dates'

const minutesInto = (moment) => moment.getHours() * 60 + moment.getMinutes()

const clock = (moment) =>
  `${String(moment.getHours()).padStart(2, '0')}:${String(
    moment.getMinutes()
  ).padStart(2, '0')}`

/**
 * One booking, ready to be positioned.
 *
 * Times are read in the browser's zone rather than the business's. Kazakhstan
 * is a single zone and the panel is used from inside the country, so the two
 * agree today — but an owner opening this from abroad would see their day
 * shifted, and the fix is to convert against `business.timezone` here, in the
 * one place that reads these fields.
 */
export function toBlock(row) {
  const start = new Date(row.starts_at)
  const end = new Date(row.ends_at)

  return {
    id: row.id,
    day: dayKey(start),
    // The raw instant and the service it was booked from, kept alongside the
    // display forms below: editing a booking has to hand both straight back to
    // the API, and re-parsing "12:15" into a date would need the day, the zone
    // and a guess about which of the two it came from.
    startsAt: row.starts_at,
    serviceId: row.service_id,
    start: minutesInto(start),
    // A booking running past midnight would otherwise end "before" it started.
    end: dayKey(end) === dayKey(start) ? minutesInto(end) : 24 * 60,
    // Both the joined form and its two halves: the panel reads it as one
    // phrase, the grid stacks it over two lines inside a narrow column.
    range: `${clock(start)} – ${clock(end)}`,
    from: clock(start),
    to: clock(end),
    client: row.client_name,
    phone: row.client_phone,
    service: row.service_name,
    minutes: row.duration_minutes,
    price: row.price,
    status: row.status,
    source: row.source,
    note: row.note,
  }
}

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

/** "12:15" — read in the browser's zone, like everything else here. */
export const clockOf = (iso) => clock(new Date(iso))

/** Where an instant falls in its own day, in minutes — for grouping slots. */
export const minutesOf = (iso) => minutesInto(new Date(iso))

/** The clock time a service of `minutes` starting at `iso` would finish at. */
export const endClock = (iso, minutes) =>
  clock(new Date(new Date(iso).getTime() + minutes * 60000))

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
