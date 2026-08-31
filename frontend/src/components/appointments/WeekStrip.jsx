import { useEffect, useState } from 'react'
import {
  dayKey,
  monthGrid,
  sameDay,
  weekDays,
  weekdayLabels,
} from '../../lib/dates'
import { useT } from '../../lib/i18n'

/**
 * The week a day sits in — and, where the caller allows it, the month around
 * that week.
 *
 * **On both of the phone's day-shaped screens, and therefore written once.**
 * The day grid needs it because otherwise the only way to Friday is back out to
 * the calendar and in again — two taps and a screen change for the move that
 * screen is most often opened to make — and the agenda needs it for the same
 * reason. Two copies of seven cells with three states each is two copies that
 * agree until one of them is restyled.
 *
 * **Unfolding keeps the chosen week where it is.** The rest of the month opens
 * above and below it rather than the week being replaced by a grid, so the row
 * being read does not move under the reader — the behaviour every phone
 * calendar has settled on, and the reason it is built as three pieces (the
 * weeks before, the week itself, the weeks after) rather than as one grid that
 * swaps its row count.
 *
 * **`grid-template-rows: 0fr → 1fr` is what animates it.** The rule here is
 * transform and opacity, never height — but the height of five week rows is not
 * a number this component can know, and the alternative is measuring on every
 * open. The `fr` trick is the one way to animate to *content* without knowing
 * what the content is, and it costs one wrapper with `overflow-hidden`.
 *
 * Without `onToggle` there is no grip and the month never opens: the day grid
 * asks for the week and nothing more.
 */
export default function WeekStrip({
  day,
  onDayChange,
  expanded = false,
  onToggle,
  // Day keys that have something booked on them — see the page, which is the
  // only thing that knows. Absent is a valid answer and means no marks, which
  // is right for any caller that has not fetched a range wide enough to say.
  marked,
  className = '',
}) {
  const t = useT()
  const now = useNow()
  const letters = weekdayLabels()

  // The month as six weeks, and which of them holds the day in play. The other
  // five are what unfolds.
  const weeks = chunk(monthGrid(day), 7)
  const current = weeks.findIndex((week) =>
    week.some((item) => sameDay(item, day)),
  )
  const before = weeks.slice(0, Math.max(current, 0))
  const after = weeks.slice(current + 1)

  const cell = (item) => (
    <Cell
      key={dayKey(item)}
      item={item}
      day={day}
      now={now}
      // Outside the month on show, and only ever visible while the month is
      // open — dimmed rather than blank, because these rows are contiguous and
      // a hole in the middle of a month reads as a bug.
      outside={item.getMonth() !== day.getMonth()}
      onDayChange={onDayChange}
      marked={marked}
    />
  )

  const fold = (rows) => (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      aria-hidden={!expanded}
    >
      <div className="overflow-hidden">
        {rows.map((week) => (
          <div key={dayKey(week[0])} className="grid grid-cols-7">
            {week.map(cell)}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className={`shrink-0 px-2 ${className}`}>
      {/* One row for the whole strip rather than a letter over every date: the
          letters do not change from week to week, and repeated over six rows
          they would be the loudest thing in a block of numbers. */}
      <div className="grid grid-cols-7 pb-1">
        {letters.map((letter, index) => (
          <span
            key={letter}
            className={`text-center text-[11px] font-medium ${
              index >= 5 ? 'text-muted/70' : 'text-muted'
            }`}
          >
            {letter}
          </span>
        ))}
      </div>

      {fold(before)}

      <div className="grid grid-cols-7">
        {weekDays(day).map(cell)}
      </div>

      {fold(after)}

      {/* **A grip, the shape this app already uses for a pull.** The timetable
          raises itself over the cards with the same bar, so the gesture is one
          somebody has already met — and a bar is honest about being draggable
          in a way a chevron is not, even though this one only takes a tap. */}
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={t(
            expanded ? 'appointments.collapse' : 'appointments.expand',
          )}
          className="group grid h-5 w-full place-items-center outline-none"
        >
          <span className="h-1 w-9 rounded-full bg-ink/15 transition-colors group-hover:bg-ink/30 group-focus-visible:bg-ink/30 group-active:bg-ink/40" />
        </button>
      )}
    </div>
  )
}

/**
 * One day.
 *
 * The marks are the calendar's own: `--now` for the day in play, `surface-chip`
 * for today, both as a filled circle rather than a change of text colour — a
 * phone is read at arm's length and in sunlight, where two greys are one grey.
 */
function Cell({ item, day, now, outside, onDayChange, marked }) {
  const selected = sameDay(item, day)
  const today = sameDay(item, now)
  const weekend = item.getDay() === 0 || item.getDay() === 6

  return (
    <button
      type="button"
      onClick={() => onDayChange?.(item)}
      aria-pressed={selected}
      aria-current={today ? 'date' : undefined}
      // The press state sits on the button so the circle inside it comes along;
      // moving the transform onto the span would fight the fill it animates.
      className="flex flex-col items-center gap-1 py-1 outline-none transition-transform duration-[160ms] ease-out active:scale-[0.95]"
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-full font-display text-[17px] transition-colors ${
          selected
            ? 'bg-now font-semibold text-white'
            : today
              ? 'bg-surface-chip font-semibold text-ink'
              : outside
                ? 'font-medium text-muted/50'
                : weekend
                  ? 'font-medium text-muted'
                  : 'font-medium text-ink'
        }`}
      >
        {item.getDate()}
      </span>
      {/* **The mark for a day that has something on it**, under the date rather
          than on it: the circle already says which day is chosen and which is
          today, and a second thing inside it would be two statements in one
          shape.

          Always drawn, and only sometimes coloured. An element that appears and
          disappears would change the strip's height as the week changed, so the
          space is reserved and it is the fill that switches — which also keeps
          every cell's date on one line across the row.

          Grey in every state, including on the selected day: it sits outside
          the orange circle, on the page's own ground, so it needs no second
          colour to stay legible. */}
      <span
        aria-hidden="true"
        className={`h-1 w-1 rounded-full ${
          marked?.has(dayKey(item)) ? 'bg-muted' : 'bg-transparent'
        }`}
      />
    </button>
  )
}

/** `size`-long runs of `list`. Six weeks out of forty-two days. */
function chunk(list, size) {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, index) =>
    list.slice(index * size, index * size + size),
  )
}

/**
 * The current day, ticking once a minute.
 *
 * A minute rather than an hour: what this is used for is which cell wears the
 * "today" mark, which changes exactly once a day — but at midnight, and a clock
 * that only checked hourly would leave yesterday marked until one in the
 * morning.
 */
function useNow() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  return now
}
