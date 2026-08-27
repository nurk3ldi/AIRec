import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import {
  byStart,
  formatPrice,
  fromMinutes,
  layoutDay,
  statusLabel,
  statusTone,
} from '../../lib/appointments'
import {
  dayKey,
  dayLabel,
  monthName,
  sameDay,
  weekDays,
  weekdayLabels,
} from '../../lib/dates'
import { closedRanges, toMinutes } from '../../lib/schedule'
import { useT } from '../../lib/i18n'
import BookingPopover from './BookingPopover'
import MobileToolbar from './MobileToolbar'
import { HATCH, END_HOUR, START_HOUR, WINDOW_FROM } from './grid'

/**
 * One day on a phone: the week it sits in, its date, and the hours with what is
 * booked in them.
 *
 * **Its own component rather than `Timetable` made narrow.** That one carries a
 * toolbar with a status filter, two arrows, a day/week switcher and an add
 * button, a grip that pulls the grid over three cards, day-name columns and a
 * lane-splitting layout for five days at once — every one of which is an answer
 * to having a wide screen. Threading a "hide all of that" prop through it would
 * leave one component holding two designs. What the two genuinely share is the
 * arithmetic, and that already lives in `lib` (`layoutDay`, `closedRanges`,
 * `byStart`) and in `grid.js` (the window, the hatch), so the duplication here
 * is drawing rather than rules.
 *
 * **Hourly rows, where the desktop draws ninety minutes.** There the gutter is
 * beside five columns and sixteen labels are landmarks against twenty-four
 * that read as a ruler. Here there is one column and the screen scrolls anyway,
 * so the hour — the unit anybody names a time in — is the one to draw.
 */

/**
 * How tall an hour is, in pixels.
 *
 * Fixed rather than measured, unlike the desktop's. There the grid has to fit a
 * region of a page that never scrolls, so the hour is whatever a third of that
 * region turns out to be; here the day scrolls under a thumb and the question
 * is not "how much fits" but "how big is a booking" — 80px gives a half-hour
 * service a 40px card, which is a line of name and a line of time.
 */
const HOUR_HEIGHT = 80

export default function MobileDay({
  day,
  onDayChange,
  onBack,
  bookings,
  week,
  services,
  timeZone,
  onSaved,
  onSearch,
  className = '',
}) {
  const t = useT()
  const now = useNow()

  const strip = weekDays(day)
  const letters = weekdayLabels()
  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, index) => START_HOUR + index,
  )

  const key = dayKey(day)
  const blocks = layoutDay((bookings ?? []).filter((b) => b.day === key).sort(byStart))
  const closed = closedRanges(
    // The API counts weekdays from Monday and `getDay()` from Sunday — the same
    // translation every other reader of this row has to make.
    week?.find((row) => row.weekday === (day.getDay() + 6) % 7),
  )

  const isToday = sameDay(day, now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  /**
   * Open on the working day rather than on midnight.
   *
   * Same reasoning as the desktop grid's: a full day opens at 00:00, which is
   * hours of dead night in the one place somebody needs the afternoon. The
   * opening hour rather than the current time, because the current time moves
   * and a grid that followed it would scroll under the reader — except on
   * today, where the current time *is* what you came to see.
   *
   * Once per day shown, so scrolling away and back within a day stays where you
   * left it, while stepping to another day starts it at the top again.
   */
  const scroller = useRef(null)
  useEffect(() => {
    const box = scroller.current
    if (!box) return

    const opens = week
      ?.map((row) => (row.is_24h || !row.opens_at ? null : toMinutes(row.opens_at)))
      .filter((minute) => minute !== null)
    const target = sameDay(day, new Date())
      ? nowMinutes - 60
      : (opens?.length ? Math.min(...opens) : 8 * 60) - 30

    box.scrollTop = Math.max(((target - WINDOW_FROM) / 60) * HOUR_HEIGHT, 0)
    // Keyed on the day only: `nowMinutes` ticks every minute and would drag the
    // grid back under a thumb once a minute if it were in here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, week])

  return (
    <div className={`flex flex-col ${className}`}>
      <MobileToolbar
        leading={
          <button
            type="button"
            onClick={onBack}
            // **`h-12`, which is the pill's height and not the pill's buttons'.**
            // The controls beside this are 40px circles inside a capsule with
            // 4px of padding, so what stands next to this is 48 tall. Matching
            // the 40 would have left the two ends of one row at different
            // heights — the kind of difference that is only visible once seen.
            className="flex h-12 shrink-0 items-center gap-1 rounded-full bg-ink/8 pr-4 pl-3 font-display text-[15px] font-semibold text-ink outline-none transition-colors hover:bg-ink/14 focus-visible:bg-ink/14"
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              size={18}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {monthName(day)}
          </button>
        }
        services={services}
        week={week}
        timeZone={timeZone}
        onDayChange={onDayChange}
        onSaved={onSaved}
        onSearch={onSearch}
      />

      {/* **The week this day sits in, and it is how you get to the next one.**
          Without it the only way to Friday is back out to the calendar and in
          again — two taps and a screen change for the move a day view is most
          often opened to make. */}
      <div className="grid shrink-0 grid-cols-7 px-2 pb-2">
        {strip.map((item, index) => {
          const selected = sameDay(item, day)
          const today = sameDay(item, now)
          const weekend = index >= 5

          return (
            <button
              key={dayKey(item)}
              type="button"
              onClick={() => onDayChange?.(item)}
              aria-pressed={selected}
              aria-current={today ? 'date' : undefined}
              className="grid place-items-center gap-1 py-1 outline-none"
            >
              <span
                className={`text-[11px] font-medium ${weekend ? 'text-muted/70' : 'text-muted'}`}
              >
                {letters[index]}
              </span>
              <span
                className={`grid h-9 w-9 place-items-center rounded-full font-display text-[17px] transition-colors ${
                  selected
                    ? 'bg-now font-semibold text-white'
                    : today
                      ? 'bg-surface-chip font-semibold text-ink'
                      : weekend
                        ? 'font-medium text-muted'
                        : 'font-medium text-ink'
                }`}
              >
                {item.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      {/* The date in words, under a rule — the reference's own arrangement, and
          it earns its line: the strip above says which *weekday*, this says
          which day of which month, and on a screen you arrive at from a year of
          months that is not obvious. */}
      <p className="shrink-0 border-y border-line py-2 text-center font-display text-[15px] font-semibold text-ink">
        {dayLabel(day)}
      </p>

      <div
        ref={scroller}
        // `relative`, so the absolutely-placed bookings and the now-line are
        // measured from the grid rather than from whatever is positioned
        // further up the page — the bug the month scroller's heading had.
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: '56px minmax(0, 1fr)',
            height: (END_HOUR - START_HOUR) * HOUR_HEIGHT,
          }}
        >
          {/* The gutter. Labels sit at the top of the hour they name rather
              than straddling the rule above it, so the first one is not half
              cut off by the top of the scroll box. */}
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute inset-x-0 top-1 text-center text-[12px] text-muted">
                  {fromMinutes(hour * 60)}
                </span>
              </div>
            ))}
          </div>

          <div className="relative border-l border-line">
            {/* **A rule on every hour here, where the desktop draws none.**
                There the gutter sits beside five columns and a line across all
                of them was a grid drawn over a grid; with one column the rule
                is what carries the eye from the time to the hour it names. */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-t border-line first:border-t-0"
                style={{ height: HOUR_HEIGHT }}
              />
            ))}

            {closed.map((range) => (
              <div
                key={`${range.kind}-${range.from}`}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0"
                style={{
                  top: ((range.from - WINDOW_FROM) / 60) * HOUR_HEIGHT,
                  height: ((range.to - range.from) / 60) * HOUR_HEIGHT,
                  backgroundImage: HATCH,
                }}
              />
            ))}

            {blocks.map((block) => (
              <DayBlock
                key={block.id}
                block={block}
                services={services}
                week={week}
                timeZone={timeZone}
                onDayChange={onDayChange}
                onSaved={onSaved}
              />
            ))}

            {/* Only on today, and only the line — the desktop's `--now` again,
                not `danger`: red here means a cancelled booking. */}
            {isToday && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 flex items-center"
                style={{
                  top: ((nowMinutes - WINDOW_FROM) / 60) * HOUR_HEIGHT,
                }}
              >
                <span className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-now" />
                <span className="h-px flex-1 bg-now" />
              </div>
            )}
          </div>
        </div>
      </div>

      {blocks.length === 0 && (
        <p className="sr-only">{t('appointments.nowEmpty')}</p>
      )}
    </div>
  )
}

/**
 * One booking on the day grid.
 *
 * Full width, because there is one column and nothing to share it with until
 * two bookings overlap — then `layoutDay`'s lanes split it, exactly as they do
 * on the desktop. Single tap opens the editor: the grid's double click exists
 * because a single one is being kept back for selecting a booking, and there is
 * no selection on a phone to keep it back for.
 */
function DayBlock({ block, services, week, timeZone, onDayChange, onSaved }) {
  const [open, setOpen] = useState(false)
  const top = ((block.start - WINDOW_FROM) / 60) * HOUR_HEIGHT
  const height = Math.max(((block.end - block.start) / 60) * HOUR_HEIGHT, 34)
  const cancelled = block.status === 'cancelled'

  return (
    <BookingPopover
      asAnchor
      open={open}
      onOpenChange={setOpen}
      booking={block}
      services={services}
      week={week}
      timeZone={timeZone}
      onDayChange={onDayChange}
      onSaved={onSaved}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`absolute flex flex-col gap-0.5 overflow-hidden rounded-lg bg-surface-card px-2.5 py-1.5 text-left outline-none ${
          cancelled ? 'opacity-45' : ''
        }`}
        style={{
          top,
          height,
          left: `calc(${(block.lane / block.lanes) * 100}% + 4px)`,
          width: `calc(${100 / block.lanes}% - 8px)`,
        }}
      >
        <span className="truncate text-[14px] leading-tight font-semibold text-ink">
          {block.client}
        </span>

        {height >= 46 && (
          <span className="truncate text-[12px] leading-tight text-ink">
            {block.service}
          </span>
        )}

        {height >= 68 && (
          <span className="mt-auto flex items-baseline justify-between gap-2 text-[12px] leading-none">
            <span
              className={`flex min-w-0 items-center gap-1.5 font-medium ${statusTone(block.status)}`}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
              />
              <span className="truncate">{statusLabel(block.status)}</span>
            </span>
            <span className="shrink-0 text-muted">{formatPrice(block.price)}</span>
          </span>
        )}
      </button>
    </BookingPopover>
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
