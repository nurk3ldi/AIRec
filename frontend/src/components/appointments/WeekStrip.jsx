import { useEffect, useState } from 'react'
import { dayKey, sameDay, weekDays, weekdayLabels } from '../../lib/dates'

/**
 * The week a day sits in, as seven taps.
 *
 * **On both of the phone's day-shaped screens, and therefore written once.**
 * The day grid needs it because otherwise the only way to Friday is back out to
 * the calendar and in again — two taps and a screen change for the move that
 * screen is most often opened to make — and the agenda needs it for exactly the
 * same reason. Two copies of seven cells with three states each is two copies
 * that agree until one of them is restyled.
 *
 * The marks are the calendar's own: `--now` for the day in play, `surface-chip`
 * for today, both as a filled circle rather than a change of text colour —
 * a phone is read at arm's length and in sunlight, where two greys are one grey.
 */
export default function WeekStrip({ day, onDayChange, className = '' }) {
  const now = useNow()
  const days = weekDays(day)
  const letters = weekdayLabels()

  return (
    <div className={`grid shrink-0 grid-cols-7 px-2 ${className}`}>
      {days.map((item, index) => {
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
  )
}

/**
 * The current day, ticking once a minute.
 *
 * A minute rather than an hour: what this is used for is which cell wears the
 * "today" mark, which changes exactly once a day — but at midnight, and a clock
 * that only checks hourly would leave yesterday marked until one in the
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
