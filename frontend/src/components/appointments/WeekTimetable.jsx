import { useEffect, useState } from 'react'
import { fromMinutes } from '../../lib/appointments'
import { sameDay, weekDays, weekdayLabels } from '../../lib/dates'
import { getLocale, useT } from '../../lib/i18n'

// The window of the day the grid draws. A guess for now, and an honest one:
// the real answer is the business's own working hours, which `/business`
// already stores and `lib/schedule.js` already knows how to read — this becomes
// `openSpans()` the moment the page fetches them.
const START_HOUR = 8
const END_HOUR = 21
const ROW_HEIGHT = 56

// Monday to Friday. The week helper hands back seven and this takes the front
// of it, so Saturday and Sunday are dropped rather than reordered — `weekDays`
// is Monday-first for the same reason the backend's `weekday` is, and slicing
// the tail off keeps both agreeing about which day is which.
//
// One number, because it is the only thing that decides the shape: the grid's
// column count, the now-line's span and the range label all read it.
const DAYS_SHOWN = 5

/**
 * The week the selected day falls in, as a timetable.
 *
 * **It draws no bookings yet.** There is no fetch behind it — what exists is
 * the grid they will be positioned in. That is deliberate rather than
 * unfinished-looking: an empty week is also what a real account sees before
 * anyone books anything, so this is the shape either way, and the backend it
 * will read from (`GET /appointments?from=&to=`) is finished and untouched.
 *
 * **The calendar above is its navigation.** There is no Today/Week/Month/Year
 * switcher of the kind the reference carries, because three of those four
 * segments would do nothing — and a segmented control where most segments are
 * dead is worse than none. Picking a day upstairs moves the week down here,
 * which is one control doing one job instead of two competing for it.
 *
 * The now-line is `accent`, not the reference's red. Red is the usual
 * convention for it, but in this app `danger` means something — a cancelled
 * booking, a failed save — and a permanent red rule across the busiest surface
 * in the product spends that meaning on a clock. Accent is what this palette
 * says "look here" with.
 */
export default function WeekTimetable({ selected }) {
  const t = useT()
  const days = weekDays(selected).slice(0, DAYS_SHOWN)
  const labels = weekdayLabels()
  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, index) => START_HOUR + index
  )

  const now = useNow()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const withinGrid = nowMinutes >= START_HOUR * 60 && nowMinutes < END_HOUR * 60
  const showNow = withinGrid && days.some((day) => sameDay(day, now))
  const nowOffset = ((nowMinutes - START_HOUR * 60) / 60) * ROW_HEIGHT

  return (
    // **Not a card.** No radius, no fill, no box drawn around it — only the
    // rules above and below, running the full width of its column. A rounded
    // white block would have made the busiest surface in the product one more
    // thing lying on the page; square and edge to edge makes it part of the
    // shell, and its top rule reads as the rail's own line turning the corner.
    <section className="border-y border-line">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="font-display text-[15px] font-semibold text-ink">
          {t('appointments.week')}
        </h2>
        <span className="text-[13px] text-muted">{weekRange(days)}</span>
      </header>

      {/* The scroll lives here and not on the page: thirteen hours is 728px of
          grid, and a page that scrolls the whole screen to reach 19:00 takes
          the calendar and the cards with it. */}
      <div className="max-h-[560px] overflow-y-auto">
        {/* The gutter plus one column per day. `min-w` is what keeps a column
            wide enough to hold a booking on a narrow window — below it the
            grid scrolls sideways instead of squeezing five days into nothing. */}
        <div
          className="grid min-w-[640px]"
          style={{
            gridTemplateColumns: `56px repeat(${DAYS_SHOWN}, minmax(0, 1fr))`,
          }}
        >
          {/* Column headings. Sticky, because scrolling to the evening with no
              idea which column is Thursday is scrolling blind. */}
          <div className="sticky top-0 z-20 border-b border-line bg-ground" />
          {days.map((day, index) => {
            const isToday = sameDay(day, now)

            return (
              <div
                key={day.toISOString()}
                // **Opaque, always**, and `ground` rather than `surface`: the
                // section has no fill of its own now, so the page's own colour
                // is what sits behind these. The grid scrolls underneath them,
                // and a translucent heading would let 15:00 show through the
                // word "THU" — which is also why the selected column's tint is
                // marked on the body below rather than up here.
                className="sticky top-0 z-20 border-b border-l border-line bg-ground px-2 py-2.5 text-center"
              >
                <span
                  className={`block text-[11px] font-medium tracking-wide ${
                    isToday ? 'text-ink' : 'text-muted'
                  }`}
                >
                  {labels[index]}
                </span>
                <span
                  className={`mt-0.5 block font-display text-[15px] ${
                    isToday ? 'font-bold text-ink' : 'font-medium text-ink'
                  }`}
                >
                  {String(day.getDate()).padStart(2, '0')}
                </span>
              </div>
            )
          })}

          {/* The hour gutter. Labels sit *on* the line they name rather than
              inside the row below it, so the eye reads "this line is 10:00"
              instead of guessing which edge the number belongs to — which is
              why they are nudged up by half their own height. */}
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="relative h-14">
                <span className="absolute -top-2 right-2 text-[11px] text-muted">
                  {fromMinutes(hour * 60)}
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`relative border-l border-line ${
                sameDay(day, selected) ? 'bg-ink/[0.04]' : ''
              }`}
            >
              {hours.map((hour) => (
                <div key={hour} className="h-14 border-t border-line" />
              ))}
            </div>
          ))}

          {/* Spans every column, so the current time can be read against any
              day rather than only against today's. Which column *is* today is
              said by the bold heading above it. */}
          {showNow && (
            <div
              className="pointer-events-none relative row-start-2 h-0"
              // Spans the gutter and every day column — `DAYS_SHOWN + 2` because
              // grid lines are counted, not tracks: five days plus the gutter is
              // six columns and therefore seven lines.
              style={{ top: nowOffset, gridColumn: `1 / ${DAYS_SHOWN + 2}` }}
            >
              <div className="ml-14 h-px bg-accent" />
              <span className="absolute top-0 left-0 -translate-y-1/2 rounded bg-accent px-1 py-px font-display text-[10px] font-semibold text-surface">
                {fromMinutes(nowMinutes)}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/** "18 — 22 августа" — the span the grid is showing, in the interface language. */
function weekRange(days) {
  const locale = getLocale()
  const first = days[0]
  const last = days[days.length - 1]
  const sameMonth = first.getMonth() === last.getMonth()

  const day = (date) => date.toLocaleDateString(locale, { day: 'numeric' })
  const dayMonth = (date) =>
    date.toLocaleDateString(locale, { day: 'numeric', month: 'long' })

  return sameMonth
    ? `${day(first)} — ${dayMonth(last)}`
    : `${dayMonth(first)} — ${dayMonth(last)}`
}

/**
 * The current time, refreshed on the minute.
 *
 * On the minute rather than every second: the line moves by a pixel a minute at
 * this row height, so a per-second tick would be 59 re-renders of the whole
 * grid that change nothing on screen.
 */
function useNow() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    // Line up with the wall clock first, then settle into a steady minute, so
    // the line moves when the minute changes rather than 40 seconds after it.
    const toNextMinute = 60_000 - (Date.now() % 60_000)
    let interval
    const timeout = setTimeout(() => {
      tick()
      interval = setInterval(tick, 60_000)
    }, toNextMinute)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [])

  return now
}
