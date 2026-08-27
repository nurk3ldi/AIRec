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
import BookingDetail from './BookingDetail'
import BookingPopover from './BookingPopover'
import ChatFeed from './ChatFeed'

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

/** How many conversations the foot of the list shows before «Все ›» takes over.
 *  Enough to see whether anything is waiting, few enough that the day above it
 *  is still the subject of the screen. */
const CHAT_ROWS = 3

export default function MobileList({
  day,
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
  const total = counted.reduce((sum, block) => sum + block.price, 0)

  return (
    <div className={`flex flex-col ${className}`}>
      {controls}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* **The day, then what it adds up to.** Two lines and no card: this is
            the heading of the list under it, not a box sitting on top of one.
            The summary is the one place a number belongs on this screen — the
            rows below say what happened, this says how much of it there was. */}
        <div className="px-4 pt-2 pb-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">
            {isToday ? t('appointments.today') : dayLabel(day)}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {[
              t('appointments.countBookings', { count: counted.length }),
              total > 0 ? formatPrice(total) : null,
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
          <ul className="border-t border-line">
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
                  past={isToday && item.block.end <= nowMinutes}
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

        {/* The other half of the day, and the last thing on the screen because
            the rows above it are about the next hour and this is about everyone
            who is not in it. */}
        <div className="mt-6 border-t border-line px-4 pt-4 pb-4">
          <ChatFeed chats={null} timeZone={timeZone} limit={CHAT_ROWS} className="flex" />
        </div>
      </div>
    </div>
  )
}

/**
 * One booking.
 *
 * **The time leads and everything else follows it**, because in a list ordered
 * by time the left edge is what the eye runs down. A booking that has already
 * finished fades to 45% — the same weight a cancelled one carries on the grid,
 * and for the same reason: it is still what happened, and it is not what you
 * are looking for.
 *
 * A tap opens the detail, not the editor — reading before writing, as
 * everywhere else on the phone.
 */
function BookingRow({
  block,
  past,
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
      <li className="border-b border-line">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-ink/4 focus-visible:bg-ink/4 ${
            past || block.status === 'cancelled' ? 'opacity-45' : ''
          }`}
        >
          <span className="w-[52px] shrink-0 pt-0.5 font-display text-[14px] font-semibold tabular-nums text-ink">
            {block.from}
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
              {[
                block.service,
                running
                  ? t('appointments.remainingShort', {
                      time: formatDuration(Math.max(remaining, 1)),
                    })
                  : formatDuration(block.minutes),
                formatPrice(block.price),
              ].join(' · ')}
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
      <li className="border-b border-line">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-ink/4 focus-visible:bg-ink/4"
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
    <li aria-hidden="true" className="flex items-center gap-2 px-4 py-1">
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
