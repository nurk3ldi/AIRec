import { useEffect, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import {
  byStart,
  dayOf,
  formatDuration,
  minutesOf,
} from '../../lib/appointments'
import { useT } from '../../lib/i18n'
import { CARD } from '../card'
import Step from './Step'

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
 * **One at a time, paged with the arrows** — the shape `NowCard` beside it
 * already uses, and for a reason that turned out to be the same one. A scrolling
 * list of rows fitted a busy afternoon into a fixed card, but it answered "what
 * is left today" where the question asked at the counter is "who is next": the
 * name that matters was one of four at the same size, and the card's own height
 * decided how many of the others were visible. The next booking now gets the
 * whole card and reads at a glance; the ones behind it are a press away, and the
 * count says how many there are so none of them is a surprise.
 */
export default function UpNextCard({ bookings, timeZone }) {
  const t = useT()
  const now = useMinute()
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)

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
    // They are not merged into one entry: each is somebody arriving, so two at
    // half past are two pages of this card showing the same span — which is
    // what «2 в 15:30» looks like when it is read one name at a time.
    .sort(byStart)

  // **Clamped on read, not corrected in an effect.** The queue shortens by
  // itself — a booking's start slips into the past and it leaves — so an index
  // pointing past the end of it is an ordinary state rather than a bug, and an
  // effect that fixed it would render the empty card once on the way. The same
  // answer `NowCard` gives to the same problem.
  const at = Math.min(index, Math.max(queue.length - 1, 0))
  const next = queue[at]

  return (
    <section className={`flex h-full min-h-0 flex-col ${CARD}`}>
      {/* **28px tall whether or not it holds arrows.** The three cards
          across the top of the page carry their labels on one line, and a
          card that grew a pager would otherwise push its own down by
          thirteen pixels — three headings at two heights read as a row that
          failed to line up rather than as one card having more to offer. */}
      <header className="flex h-7 shrink-0 items-center justify-between gap-2">
        <p className="text-[12px] font-medium tracking-wide text-muted uppercase">
          {t('appointments.upNext')}
        </p>

        {/* The count travels with the arrows rather than standing alone: two
            buttons with nothing between them say you may move, not that there
            is somewhere to move to. One booking needs neither. */}
        {queue.length > 1 && (
          <div className="flex shrink-0 items-center gap-1">
            <Step
              icon={ArrowLeft01Icon}
              label={t('appointments.prev')}
              onClick={() =>
                setIndex((was) => (was - 1 + queue.length) % queue.length)
              }
            />
            <span className="font-display text-[12px] font-medium text-muted tabular-nums">
              {at + 1}/{queue.length}
            </span>
            <Step
              icon={ArrowRight01Icon}
              label={t('appointments.next')}
              onClick={() => setIndex((was) => (was + 1) % queue.length)}
            />
          </div>
        )}
      </header>

      {!next ? (
        <p className="m-auto text-center text-[13px] text-muted">
          {t('appointments.upNextEmpty')}
        </p>
      ) : (
        // **Keyed on the booking, so paging is a change and not a redraw.** The
        // arrows swap one person for another in the same four lines, and
        // without the fade the card would simply be holding different words the
        // next frame — the one thing motion is for here is saying that what is
        // on screen was replaced. It is also what plays when a booking's start
        // slips into the past and the queue moves on by itself, which is the
        // one change on this page that happens *to* you.
        //
        // Opacity alone, no layout animation: that needs `domMax`, and this app
        // deliberately loads the smaller `domAnimation` everywhere but the
        // sidebar's marker.
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={next.id}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.16, ease: 'easeOut' }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* **Who, and when they are due, on one line.** The wait belongs
                beside the name rather than under the span: it is a fact about
                the person — how long before this one walks in — where the span
                below is a fact about the day. Held to the right edge, which is
                also where the pager above it sits, so the card has one column
                of small type down its right side instead of a number floating
                mid-block.

                `items-baseline`, not `items-center`: 17px and 13px centred
                against each other sit on two different lines and read as a
                misalignment; on a shared baseline they read as one row. */}
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-[17px] leading-tight font-semibold text-ink">
                {next.client}
              </p>
              {/* On the clock the card already ticks on. It is the half of "who
                  is next" that a time of day does not answer on its own —
                  twenty minutes and two hours read the same until they are
                  subtracted. */}
              <span className="shrink-0 text-[13px] leading-tight font-medium text-ink">
                {t('appointments.startsIn', {
                  time: formatDuration(next.start - minute),
                })}
              </span>
            </div>

            {/* **The number sits under the name, because it belongs to the
                name.** This is the one card on the page about somebody who has
                not arrived yet, which is exactly when they get rung — "он
                опаздывает" is answered by a call, and the alternative was
                opening the booking to read six digits. A `tel:` link for the
                same reason `BookingDetail` makes one: on a phone it dials, and
                on a laptop it is still the only value here worth acting on
                rather than only reading.

                Nothing is drawn when there is no number — a client who never
                gave one is the ordinary case, and a dash would be a place where
                an answer is missing rather than never asked for. */}
            {next.phone && (
              <a
                href={`tel:${next.phone}`}
                className="mt-0.5 block truncate font-display text-[13px] leading-tight text-ink tabular-nums underline decoration-line underline-offset-4 outline-none transition-colors hover:decoration-current focus-visible:decoration-current"
              >
                {next.phone}
              </a>
            )}

            {/* **The bottom line of the card, and it is held to the bottom
                edge** — `mt-auto` gives it whatever height is left over, so the
                span sits on the card's own floor however much is written above
                it. The three cards in this row are one height and each fills it
                differently; a number that floated wherever the text above it
                ended would be the one thing in the row that moved.

                **The span, whole, is the loudest thing here** — the question
                this card answers is when to expect somebody, and both ends of
                it are what gets said out loud ("Азамат в три, до
                полчетвёртого"). 24 rather than the countdown's 32 next door:
                one thing on a screen is at 32, and the booking that is already
                happening is the one with a claim on it. With no end `range` is
                already «15:00 –», which says the rest.

                **What they are coming for shares the line**, at full strength
                rather than muted: on this card it is one of the two things
                actually being said, and against the span it is the shorter
                half — 24 next to 13 reads as a hierarchy, which is what the
                type scale asks for. */}
            <div className="mt-auto flex items-baseline justify-between gap-3 pt-3">
              <p className="shrink-0 font-display text-[24px] leading-none font-bold tracking-[-0.02em] text-ink tabular-nums">
                {next.range}
              </p>
              <p className="min-w-0 truncate text-right text-[13px] font-medium text-ink">
                {next.service}
              </p>
            </div>
          </m.div>
        </AnimatePresence>
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
