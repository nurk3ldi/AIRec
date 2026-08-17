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
    start: minutesInto(start),
    // A booking running past midnight would otherwise end "before" it started.
    end: dayKey(end) === dayKey(start) ? minutesInto(end) : 24 * 60,
    range: `${clock(start)} – ${clock(end)}`,
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
