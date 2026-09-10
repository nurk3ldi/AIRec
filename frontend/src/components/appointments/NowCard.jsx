import { useEffect, useState } from 'react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { dayOf, minutesOf } from '../../lib/appointments'
import { useT } from '../../lib/i18n'
import { CARD } from '../card'
import Step from './Step'

/**
 * What is happening right now.
 *
 * **The one card on this page that is about a moment rather than a day.** The
 * grid below answers "what does Thursday look like"; this answers "who is in
 * the chair", which is the question the owner actually has while somebody is in
 * it — and the one the grid is worst at, because finding the current hour means
 * reading an axis.
 *
 * A cancelled booking is not happening, whatever its hours say. Everything else
 * is: a `no_show` still occupies the slot — see `BLOCKING_STATUSES` — and the
 * owner marking it as such is exactly what this card is for.
 *
 * **Parallel bookings are paged, not stacked.** A business with `capacity`
 * above one has two chairs, and two cards' worth of detail does not fit in one
 * card. Arrows and a count are the honest answer: one at a time, and the count
 * says how many there are so the second is never a surprise.
 */
export default function NowCard({ bookings, timeZone }) {
  const t = useT()
  const now = useSecond()
  const [index, setIndex] = useState(0)

  const today = dayOf(now.toISOString(), timeZone)
  const minute = minutesOf(now.toISOString(), timeZone)

  const running = (bookings ?? []).filter(
    (booking) =>
      booking.day === today &&
      booking.status !== 'cancelled' &&
      booking.start <= minute &&
      // No end means it is still running: that is what the owner said when they
      // wrote it down without one.
      minute < (booking.end ?? 24 * 60),
  )

  // The set changes under the page — a booking ends, another starts — and an
  // index pointing past the end of it would blank the card. Clamped on read
  // rather than corrected in an effect, which would render the empty state once
  // before fixing itself.
  const at = Math.min(index, Math.max(running.length - 1, 0))
  const current = running[at]

  return (
    // Крой — общий `CARD`, ровно тот же, что у двух соседей и у скелета: три
    // карточки в ряд, не совпадающие фоном или краем, читаются как ошибка, а эта
    // не важнее остальных — она лишь та, что наступила первой.
    <section className={`flex h-full min-h-0 flex-col ${CARD}`}>
      {/* **28px tall whether or not it holds arrows.** The three cards
          across the top of the page carry their labels on one line, and a
          card that grew a pager would otherwise push its own down by
          thirteen pixels — three headings at two heights read as a row that
          failed to line up rather than as one card having more to offer. */}
      <header className="flex h-7 shrink-0 items-center justify-between gap-2">
        <p className="text-[12px] font-medium tracking-wide text-muted uppercase">
          {t('appointments.now')}
        </p>

        {running.length > 1 && (
          <div className="flex shrink-0 items-center gap-1">
            <Step
              icon={ArrowLeft01Icon}
              label={t('appointments.prev')}
              onClick={() =>
                setIndex((was) => (was - 1 + running.length) % running.length)
              }
            />
            {/* The count is what makes the arrows mean something: two buttons
                with nothing between them say you may move, not that there is
                somewhere to move to. */}
            <span className="font-display text-[12px] font-medium text-muted tabular-nums">
              {at + 1}/{running.length}
            </span>
            <Step
              icon={ArrowRight01Icon}
              label={t('appointments.next')}
              onClick={() => setIndex((was) => (was + 1) % running.length)}
            />
          </div>
        )}
      </header>

      {current ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* **Who, and the span they hold, on one line.** The span is a fact
              about this booking rather than about the countdown, so it belongs
              beside the name instead of under a number it was only ever the
              scale for — and the card beside it says who is next the same way,
              which is what makes the two read as one row rather than as two
              layouts.

              `items-baseline`: 17px and 13px centred against each other sit on
              two different lines and read as a misalignment. */}
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-[17px] leading-tight font-semibold text-ink">
              {current.client}
            </p>
            <span className="shrink-0 font-display text-[13px] leading-tight font-semibold text-ink tabular-nums">
              {current.range}
            </span>
          </div>

          {/* **The number, under the name it belongs to.** Somebody is in the
              chair, and the call this card is opened for is the one that says
              they are running over or that the next client is at the door. A
              `tel:` link for the same reason `BookingDetail` makes one: on a
              phone it dials, and on a laptop it is still the only value here
              worth acting on rather than only reading. Nothing is drawn where
              there is no number. */}
          {current.phone && (
            <a
              href={`tel:${current.phone}`}
              className="mt-0.5 block truncate font-display text-[13px] leading-tight text-ink tabular-nums underline decoration-line underline-offset-4 outline-none transition-colors hover:decoration-current focus-visible:decoration-current"
            >
              {current.phone}
            </a>
          )}

          {/* **The countdown is the largest thing on the card**, because it is
              the only part that changes while you look at it.

              **With no end it counts up instead of down.** There is nothing to
              count towards, and a dash here would leave the card's largest
              element saying nothing on the one booking that is happening. Time
              since the client sat down is the answer to the same question the
              countdown answers — how far through this are we — asked from the
              other side. */}
          <p className="mt-auto pt-3 font-display text-[32px] leading-none font-bold tracking-[-0.02em] text-ink tabular-nums">
            {countdown(
              current.open ? minute - current.start : current.end - minute,
              now,
            )}
          </p>

          {/* **What the number is, and what they are here for.** Ink rather
              than muted on both: a label grey at 12px under a 32px figure read
              as a caption somebody could skip, and the one thing nobody can
              skip is what the countdown is counting. 13 against 32 is the
              pairing the type scale wants.

              The service is at the far end of this line and so at the card's
              own bottom-right corner — the last thing said about a booking
              already under way, which is the right weight for it: who is in the
              chair and how long is left are what this card is opened for. */}
          <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[13px] font-medium text-ink">
            <span className="shrink-0">
              {t(
                current.open
                  ? 'appointments.elapsed'
                  : 'appointments.remaining',
              )}
            </span>
            <span className="min-w-0 truncate text-right">
              {current.service}
            </span>
          </div>
        </div>
      ) : (
        // Centred rather than sitting under the heading: an empty card that
        // keeps the shape of a full one reads as a card that failed to load.
        <p className="m-auto text-[13px] text-muted">
          {t('appointments.nowEmpty')}
        </p>
      )}
    </section>
  )
}

/**
 * `mm:ss` left, or `h:mm:ss` once there is an hour of it.
 *
 * The minutes come from the booking's own arithmetic and the seconds from the
 * wall clock, which is what lets the card tick without every booking carrying a
 * second-accurate end: `minutesLeft` is whole minutes, and the seconds are
 * however many are left of the current one.
 */
function countdown(minutesLeft, now) {
  const seconds = Math.max(minutesLeft * 60 - now.getSeconds(), 0)
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const pad = (value) => String(value).padStart(2, '0')

  return hours > 0
    ? `${hours}:${pad(mins)}:${pad(secs)}`
    : `${pad(mins)}:${pad(secs)}`
}


/**
 * A clock that ticks every second.
 *
 * Every second and not every minute, unlike the grid's `useNow`: this drives a
 * countdown, and a timer that jumps sixty at a time is a clock that has
 * stopped. It is one `setState` a second against a card of four lines, which is
 * nothing — and it only runs while this component is mounted, which is while
 * somebody is looking at it.
 */
function useSecond() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return now
}
