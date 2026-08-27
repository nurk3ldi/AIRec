import { useEffect, useState } from 'react'
import {
  dayOf,
  formatDuration,
  fromMinutes,
  minutesOf,
} from '../../lib/appointments'
import { freeWindows, isDayOff } from '../../lib/schedule'
import { useT } from '../../lib/i18n'

/** Anything shorter than a quarter hour is a gap, not a window: nothing this
 *  business sells fits in it — `SLOT_MINUTES` is the floor on the server. */
const SHORTEST = 15

/**
 * When somebody could be fitted in next.
 *
 * **A tool, not a statistic.** The question it answers is asked out loud,
 * usually with a client on the phone: "when can you take me?" Everything needed
 * to answer it is already on this page — the working week, the break, and what
 * is booked — but answering it from the grid means reading a column and doing
 * arithmetic while somebody waits.
 *
 * It looks forward only. A window that ended at eleven is not one you can offer
 * at noon, so the search starts at the current minute and the card empties as
 * the day fills.
 */
export default function FreeSlotCard({ bookings, week, timeZone }) {
  const t = useT()
  const now = useMinute()

  const today = dayOf(now.toISOString(), timeZone)
  const minute = minutesOf(now.toISOString(), timeZone)

  // `(getDay() + 6) % 7` because the API counts weekdays from Monday. Built
  // from the business's own date rather than the browser's, so near midnight
  // the row looked up is the row for the day the business is having.
  const weekday = (new Date(`${today}T00:00:00`).getDay() + 6) % 7
  const row = week?.find((item) => item.weekday === weekday)

  const busy = (bookings ?? [])
    .filter(
      (booking) =>
        booking.day === today &&
        booking.status !== 'cancelled' &&
        // **A booking with no end is not in the way of anything.** It claims no
        // stretch of the day — the server does not block on it either, see
        // `ends_at` on the model — so subtracting a made-up length here would
        // hide a window that is genuinely free.
        !booking.open,
    )
    .map((booking) => [booking.start, booking.end])

  const window = freeWindows(row, busy, minute).find(
    ([from, to]) => to - from >= SHORTEST,
  )

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-surface-raised p-4">
      <p className="shrink-0 text-[12px] font-medium tracking-wide text-muted uppercase">
        {t('appointments.freeSlot')}
      </p>

      {window ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* **The span is the answer and it is the loudest thing here.** The
              length under it is what the caller asks next — "how long have you
              got?" — and the two together are the whole of what this card is
              for. */}
          <p className="mt-auto font-display text-[26px] leading-none font-bold tracking-[-0.02em] text-ink tabular-nums">
            {fromMinutes(window[0])} – {fromMinutes(window[1])}
          </p>
          <p className="mt-2 flex items-center justify-between gap-2 text-[12px] text-muted">
            <span>{formatDuration(window[1] - window[0])}</span>
            {/* Only when it is not now: "через 0 мин" is a phrase that has to be
                read before it can be dismissed. */}
            {window[0] > minute && (
              <span className="shrink-0">
                {t('appointments.startsIn', {
                  time: formatDuration(window[0] - minute),
                })}
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className="m-auto text-center text-[13px] text-muted">
          {/* Two different silences, and the difference matters: a day off is a
              decision the business made, an afternoon with nothing left is one
              it earned. */}
          {isDayOff(row)
            ? t('appointments.dayOff')
            : t('appointments.freeSlotNone')}
        </p>
      )}
    </section>
  )
}

/**
 * A clock that ticks on the minute.
 *
 * The window this card shows shrinks as the hour passes — it starts at "now" —
 * so it has to be recomputed as the clock moves, and a minute is as fine as a
 * schedule ever gets. Lined up with the wall clock first, so the change happens
 * when the minute turns rather than up to a minute later.
 */
function useMinute() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    let interval
    const timeout = setTimeout(
      () => {
        tick()
        interval = setInterval(tick, 60_000)
      },
      60_000 - (Date.now() % 60_000),
    )

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [])

  return now
}
