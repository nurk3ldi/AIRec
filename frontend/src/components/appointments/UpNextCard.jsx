import { useEffect, useState } from 'react'
import { byStart, dayOf, minutesOf } from '../../lib/appointments'
import { useT } from '../../lib/i18n'

/**
 * What is coming, in order.
 *
 * The card beside it answers "who is in the chair"; this answers "who is
 * next", which is the other half of the same question and the one the grid is
 * second-worst at — reading a column tells you what the day holds, not what is
 * about to happen.
 *
 * **Today only.** A queue is a thing you are standing in, and a booking on
 * Thursday is not in it: it belongs to the calendar below, where a date can be
 * seen. What this list is for is the next hour or two, and it ends when the day
 * does.
 *
 * Cancelled bookings are dropped — nobody is waiting for one. A `no_show` that
 * has not started yet is still expected, so it stays until its time passes.
 *
 * The list scrolls inside the card rather than stretching it: the row of three
 * across the top of the page has one height, and a busy afternoon must not be
 * what decides it.
 */
export default function UpNextCard({ bookings, timeZone }) {
  const t = useT()
  const now = useMinute()

  const today = dayOf(now.toISOString(), timeZone)
  const minute = minutesOf(now.toISOString(), timeZone)

  const queue = (bookings ?? [])
    .filter(
      (booking) =>
        booking.day === today &&
        booking.status !== 'cancelled' &&
        booking.start > minute,
    )
    // `byStart` rather than a bare start comparison, because two bookings can
    // begin at the same minute — a business with `capacity` above one has two
    // chairs — and that order has to be *total* or the two swap places on every
    // render. It breaks the tie on the id, so parallel bookings keep the same
    // two positions in the queue for as long as they are both in it.
    //
    // They are not merged into one entry: each is somebody arriving, each gets
    // a card, and they sit one under the other both showing the same time —
    // which is what "two at half past" looks like written down.
    .sort(byStart)

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-surface-raised p-4">
      <header className="flex shrink-0 items-baseline justify-between gap-2">
        <p className="text-[12px] font-medium tracking-wide text-muted uppercase">
          {t('appointments.upNext')}
        </p>
        {queue.length > 0 && (
          <span className="font-display text-[12px] font-medium text-muted tabular-nums">
            {queue.length}
          </span>
        )}
      </header>

      {queue.length === 0 ? (
        <p className="m-auto text-center text-[13px] text-muted">
          {t('appointments.upNextEmpty')}
        </p>
      ) : (
        // **A card each, not rows under one rule.** A hairline says "these are
        // parts of one thing", which a schedule is — but a queue is read one
        // entry at a time, and giving each its own block is what lets the eye
        // stop on the next name instead of scanning a table. The list scrolls;
        // the card does not grow.
        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {queue.map((booking, index) => (
            <div
              key={booking.id}
              className="flex shrink-0 items-start gap-3 rounded-xl bg-ink/[0.06] px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                {/* The first is the one about to happen, so it is the one that
                    reads at full strength; the rest are context. That is the
                    whole hierarchy here — no colour, no badge, just weight. */}
                <p
                  className={`truncate text-[14px] leading-tight ${
                    index === 0
                      ? 'font-semibold text-ink'
                      : 'font-medium text-ink'
                  }`}
                >
                  {booking.client}
                </p>
                <p className="mt-0.5 truncate text-[12px] leading-tight text-muted">
                  {booking.service}
                </p>
              </div>

              {/* The start alone, not the span: the question this list answers
                  is when to expect somebody, and the end of a booking that has
                  not begun is a number nobody needs yet. */}
              <span className="shrink-0 font-display text-[13px] font-semibold text-ink tabular-nums">
                {booking.from}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * A clock that ticks on the minute.
 *
 * On the minute and not every second, unlike the card beside it: nothing here
 * counts down, and this list only changes when a booking's start slips into the
 * past. Lined up with the wall clock first so that happens when the minute
 * turns rather than up to a minute later.
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
