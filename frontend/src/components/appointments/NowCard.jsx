import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { dayOf, minutesOf } from '../../lib/appointments'
import { useT } from '../../lib/i18n'

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
      minute < booking.end,
  )

  // The set changes under the page — a booking ends, another starts — and an
  // index pointing past the end of it would blank the card. Clamped on read
  // rather than corrected in an effect, which would render the empty state once
  // before fixing itself.
  const at = Math.min(index, Math.max(running.length - 1, 0))
  const current = running[at]

  return (
    // `surface-raised` and no border, matching the two cards beside it exactly:
    // three cards in a row that do not share a fill are three cards that look
    // like a mistake, and this one is not more important than its neighbours —
    // it is only the one that has arrived first.
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-surface-raised p-4">
      <header className="flex shrink-0 items-center justify-between gap-2">
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
          <p className="mt-3 truncate text-[17px] leading-tight font-semibold text-ink">
            {current.client}
          </p>
          <p className="mt-0.5 truncate text-[13px] leading-tight text-ink">
            {current.service}
          </p>

          {/* **The countdown is the largest thing on the card**, because it is
              the only part that changes while you look at it. The span under it
              is what the number is counted against — a timer with no end time
              beside it is a number you have to trust. */}
          <p className="mt-auto pt-3 font-display text-[32px] leading-none font-bold tracking-[-0.02em] text-ink tabular-nums">
            {countdown(current.end - minute, now)}
          </p>
          <p className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-muted">
            <span>{t('appointments.remaining')}</span>
            <span className="font-display font-medium tabular-nums">
              {current.range}
            </span>
          </p>
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

/** One of the two arrows, at the size every small control on this page is. */
function Step({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted outline-none transition-colors hover:bg-ink/6 hover:text-ink focus-visible:bg-ink/6 focus-visible:text-ink"
    >
      <HugeiconsIcon
        icon={icon}
        size={15}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
    </button>
  )
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
