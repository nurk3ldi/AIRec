import { useEffect, useState } from 'react'
import {
  byStart,
  formatDuration,
  formatPrice,
  fromMinutes,
  statusLabel,
  statusTone,
} from '../../lib/appointments'
import { dayKey, dayLabel, sameDay } from '../../lib/dates'
import { freeWindows } from '../../lib/schedule'
import { useT } from '../../lib/i18n'
import { useRemembered } from '../../lib/viewState'
import BookingDetail from './BookingDetail'
import BookingPopover from './BookingPopover'
import WeekStrip from './WeekStrip'

/**
 * The day as one list, with the present marked inside it.
 *
 * **This replaced three cards and it is the same information.** «Сейчас»,
 * «Дальше» and «Ближайшее окно» were three boxes over one dataset — the day's
 * bookings, sliced three ways — and each carried its own heading, its own
 * padding and its own scroll. Laid out as a single run of time they stop being
 * separate answers and become *positions*: what is happening now is the row the
 * line is next to, what is next is the row after it, and a free window is a row
 * of its own between two bookings.
 *
 * That also scales, which the cards did not. A day with two bookings and a day
 * with twelve are the same screen here; three fixed cards are 540px of chrome
 * before the second booking is even on it.
 *
 * **A free window is a row you can press**, not a statistic. It is the question
 * asked out loud with somebody standing there — "can you fit me in?" — so it
 * opens the panel with that day and that time already in it. Nothing else is
 * seeded: what the booking is for and what it costs are still theirs to say.
 *
 * **It follows the calendar's day rather than always showing today.** The two
 * halves of this screen are then one thing — the month picks a day, the list
 * says what is in it — and a Wednesday can be looked at without pretending it
 * is now. What only exists on today is the line and the countdown, because
 * those are claims about the present and false on any other date.
 */

/** Below this a gap is not a window anybody can sell — see `FreeSlotCard`,
 *  which uses the same floor. */
const MIN_GAP_MINUTES = 15

export default function MobileList({
  day,
  onDayChange,
  bookings,
  week,
  services,
  timeZone,
  onSaved,
  controls,
  className = '',
}) {
  const t = useT()
  const now = useNow()
  // **Remembered, like every other choice on this screen.** Whether the month
  // is open is something the owner set on purpose, and folding it back every
  // time they look at a booking and come out again is the screen forgetting it.
  const [monthOpen, setMonthOpen] = useRemembered(
    'appointments.monthOpen',
    false,
  )
  const isToday = sameDay(day, now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const key = dayKey(day)
  const blocks = (bookings ?? []).filter((b) => b.day === key).sort(byStart)
  // A cancelled booking gave its hour back, so it is not in the way of a new
  // one — the same rule `BLOCKING_STATUSES` states on the server.
  const busy = blocks
    .filter((b) => b.status !== 'cancelled')
    .map((b) => [b.start, b.end])

  const hours = week?.find((row) => row.weekday === (day.getDay() + 6) % 7)
  // Today, only what is still ahead: a window that closed at eleven is not a
  // window at three. On any other day the whole day is ahead.
  const gaps = freeWindows(hours, busy, isToday ? nowMinutes : 0).filter(
    ([from, to]) => to - from >= MIN_GAP_MINUTES,
  )

  /**
   * Everything on the day, in the order it happens.
   *
   * The now marker is an item like the others rather than something drawn over
   * them, so it lands wherever it belongs and the list needs no special case
   * for it. Sorted plainly: everything above the line has begun and everything
   * below has not, which is what a line across a day means.
   */
  const items = [
    ...blocks.map((block) => ({ kind: 'booking', at: block.start, block })),
    ...gaps.map(([from, to]) => ({ kind: 'gap', at: from, from, to })),
    ...(isToday ? [{ kind: 'now', at: nowMinutes }] : []),
  ].sort((a, b) => a.at - b.at)

  const counted = blocks.filter((b) => b.status !== 'cancelled')

  return (
    <div className={`flex flex-col ${className}`}>
      {controls}

      {/* **The week over the day it belongs to.** The switcher gets you to this
          screen and the calendar chooses which day it is about, but going back
          to a whole year of months to move one day forward is a trip; the strip
          is that move in one tap, and it is the same control the day grid
          carries — see `WeekStrip`. */}
      <WeekStrip
        day={day}
        onDayChange={onDayChange}
        expanded={monthOpen}
        onToggle={() => setMonthOpen((was) => !was)}
        className="pb-1"
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* **One line: the day on the left, what is in it on the right.** It
            was two lines with the counts under the date, which spent a whole
            row on two short numbers — and the numbers are a caption of the list
            below rather than a statement of their own, so they belong beside
            the thing they caption.

            **The day's takings are gone from it.** Money on this screen was the
            one figure nobody came here for: the question a phone gets opened
            for in a shop is who is next and where the gap is, and a total is
            something looked at once in the evening. It is also the number most
            likely to be wrong here — cancelled bookings out, no-shows in, and
            neither is obvious from a sum with no explanation under it. */}
        <div className="flex items-baseline justify-between gap-3 px-4 pt-2 pb-3">
          <h2 className="min-w-0 truncate font-display text-[22px] font-bold tracking-[-0.02em] text-ink">
            {isToday ? t('appointments.today') : dayLabel(day)}
          </h2>
          <p className="shrink-0 text-[13px] text-muted">
            {[
              t('appointments.countBookings', { count: counted.length }),
              gaps.length
                ? t('appointments.countWindows', { count: gaps.length })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {items.length === 0 ? (
          <p className="px-4 pt-8 text-center text-[13px] text-muted">
            {t('appointments.dayEmpty')}
          </p>
        ) : (
          // **Cards with air between them, not rows divided by hairlines.** A
          // ruled list is right where every row is the same kind of thing; here
          // three kinds share the column — a booking, an empty window, and the
          // present moment — and a card is what says the first two are objects
          // while the line between them is not.
          <ul className="space-y-2 px-4 pb-6">
            {items.map((item) =>
              item.kind === 'now' ? (
                <NowRow key="now" minutes={nowMinutes} />
              ) : item.kind === 'gap' ? (
                <GapRow
                  key={`gap-${item.from}`}
                  day={key}
                  from={item.from}
                  to={item.to}
                  services={services}
                  week={week}
                  timeZone={timeZone}
                  onSaved={onSaved}
                />
              ) : (
                <BookingRow
                  key={item.block.id}
                  block={item.block}
                  running={
                    isToday &&
                    item.block.start <= nowMinutes &&
                    nowMinutes < item.block.end
                  }
                  remaining={item.block.end - nowMinutes}
                  services={services}
                  week={week}
                  timeZone={timeZone}
                  onSaved={onSaved}
                />
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * One booking.
 *
 * **The span leads and everything else follows it**, because in a list ordered
 * by time the left edge is what the eye runs down — so it carries both ends of
 * the booking with the rule between them, not only its start.
 *
 * A tap opens the detail, not the editor — reading before writing, as
 * everywhere else on the phone.
 */
function BookingRow({
  block,
  running,
  remaining,
  services,
  week,
  timeZone,
  onSaved,
}) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <BookingDetail
      open={open}
      onOpenChange={setOpen}
      booking={block}
      services={services}
      week={week}
      timeZone={timeZone}
      onSaved={onSaved}
    >
      <li>
        <button
          type="button"
          onClick={() => setOpen(true)}
          // **Only a cancelled booking fades.** A finished one was fading too,
          // and that was wrong about what a day's list is for: the morning is
          // what the owner looks back over — who came, what they had, what it
          // cost — and dimming it says it no longer counts. A cancellation is
          // the one row that genuinely did not happen, and it keeps the 45% it
          // wears on the grid.
          // **`active:` and not only `hover:`.** Tailwind compiles the hover
          // variant inside `@media (hover: hover)`, which is right — it stops a
          // tap leaving a stuck highlight — but it also means that on the phone
          // this row is built for, the hover rule never runs at all. Without a
          // press state the row gives nothing back between the finger landing
          // and the sheet opening, which reads as a dropped tap.
          //
          // One `transition-[…]` naming both properties rather than two
          // `transition-*` utilities: two of them set the same declaration and
          // are resolved by stylesheet order, so one would silently win.
          //
          // **`scale`, not `transform`.** Tailwind v4 compiles `scale-[0.97]`
          // to the standalone `scale` property, which is a different animatable
          // property from `transform` — naming `transform` here would leave the
          // dip with no transition at all and it would simply snap.
          className={`flex w-full items-start gap-3 rounded-xl bg-surface-card px-3 py-3 text-left outline-none transition-[opacity,scale] duration-[160ms] ease-out hover:opacity-85 focus-visible:opacity-85 active:scale-[0.97] ${
            block.status === 'cancelled' ? 'opacity-45' : ''
          }`}
        >
          {/* **Both ends of the span, joined by the line between them.** The
              start alone leaves "how long" to be read out of the line under the
              client, where it sits among the service and the price; here the
              two times are the column the eye is already running down, and the
              rule between them says they are one span rather than two facts
              that happen to be stacked.

              Centred, which the digits allow: `tabular-nums` makes every time
              the same width, so the rule lands under the middle of both. */}
          <span className="flex w-[52px] shrink-0 flex-col items-center gap-1 pt-0.5">
            <span className="font-display text-[14px] font-semibold tabular-nums text-ink">
              {block.from}
            </span>
            <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
            <span className="font-display text-[13px] tabular-nums text-muted">
              {block.to}
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[15px] font-semibold text-ink">
                {block.client}
              </span>
              <span
                className={`shrink-0 text-[12px] font-medium ${statusTone(block.status)}`}
              >
                {statusLabel(block.status)}
              </span>
            </span>

            {/* **What it is, how long, what it cost — one line.** The running
                booking swaps the length for what is left of it, which is the
                only thing anybody wants from a booking already under way. */}
            <span className="mt-0.5 block truncate text-[13px] text-muted">
              {/* The length is gone from here: the two times beside it are
                  the span, and saying "45 мин" next to «10:00 / 10:45» is the
                  same fact twice. What is left of it is the countdown, which
                  the times cannot give. */}
              {[
                block.service,
                running
                  ? t('appointments.remainingShort', {
                      time: formatDuration(Math.max(remaining, 1)),
                    })
                  : null,
                formatPrice(block.price),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        </button>
      </li>
    </BookingDetail>
  )
}

/**
 * A stretch of the day nobody has booked.
 *
 * **A row you press, not a figure you read.** "Can you fit me in?" is asked out
 * loud with somebody standing there, and the answer is worth nothing if acting
 * on it means opening a form and typing the time back in. The whole row is the
 * target — a button inside a row would be a second thing to aim at, on the one
 * screen where the hand is already busy.
 */
function GapRow({ day, from, to, services, week, timeZone, onSaved }) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <BookingPopover
      asAnchor
      open={open}
      onOpenChange={setOpen}
      preset={{ day, from: fromMinutes(from) }}
      services={services}
      week={week}
      timeZone={timeZone}
      onSaved={onSaved}
    >
      <li>
        {/* **Dashed and unfilled**, the one stroked thing here — the grid marks
            a collapsed stack the same way and for the same reason: a booking is
            a solid card, and an absence is not. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2.5 text-left outline-none transition-[border-color,scale] duration-[160ms] ease-out hover:border-line-strong focus-visible:border-line-strong active:scale-[0.97]"
        >
          <span className="w-[52px] shrink-0 font-display text-[14px] font-medium tabular-nums text-muted">
            {fromMinutes(from)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
            {t('appointments.freeFor', {
              time: formatDuration(to - from),
            })}
          </span>
          <span className="shrink-0 text-[13px] font-medium text-ink">
            {t('appointments.create')}
          </span>
        </button>
      </li>
    </BookingPopover>
  )
}

/**
 * Where the day has got to.
 *
 * `--now`, the colour this product already means "the present moment" with —
 * the same one the desktop grid draws its line in and the calendar marks the
 * day in play with. The clock is on the line rather than beside it for the
 * reason the day grid's is: a line says where, the digits say what.
 */
function NowRow({ minutes }) {
  return (
    <li aria-hidden="true" className="flex items-center gap-2 py-1">
      <span className="w-[52px] shrink-0 font-display text-[12px] font-semibold tabular-nums text-now">
        {fromMinutes(minutes)}
      </span>
      <span className="h-px flex-1 bg-now" />
    </li>
  )
}

/** The current minute, ticking on its own clock and only while mounted. */
function useNow() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  return now
}
