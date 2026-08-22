import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { fromMinutes } from '../../lib/appointments'
import { sameDay, shiftDate, weekDays, weekdayLabels } from '../../lib/dates'
import { useT } from '../../lib/i18n'

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
const WORK_DAYS = 5

// Two views, and both do something — a switcher whose segments are decoration
// is worse than no switcher, which is why the reference's Today/Month/Year are
// not here. `step` is what an arrow moves by in each: one day, or one work week.
const VIEWS = [
  { id: 'day', labelKey: 'appointments.viewDay', step: 'day' },
  { id: 'week', labelKey: 'appointments.viewWeek', step: 'week' },
]

/**
 * One day or one work week, as a timetable.
 *
 * **It draws no bookings yet.** There is no fetch behind it — what exists is
 * the grid they will be positioned in. That is deliberate rather than
 * unfinished-looking: an empty week is also what a real account sees before
 * anyone books anything, so this is the shape either way, and the backend it
 * will read from (`GET /appointments?from=&to=`) is finished and untouched.
 *
 * **The toolbar moves the page's selection, not a copy of it.** The arrows call
 * `onSelect`, which is the same state the calendar above is bound to — so
 * stepping a week here moves the month up there, and clicking a day up there
 * moves the grid down here. Two controls, one answer to "which day".
 *
 * The reference's switcher offers Today/Week/Month/Year; this one offers the
 * two views that exist. A segment that does nothing is worse than a segment
 * that is missing, and Month is already the calendar.
 *
 * The now-line is `accent`, not the reference's red. Red is the usual
 * convention for it, but in this app `danger` means something — a cancelled
 * booking, a failed save — and a permanent red rule across the busiest surface
 * in the product spends that meaning on a clock. Accent is what this palette
 * says "look here" with.
 */
export default function Timetable({ selected, onSelect }) {
  const t = useT()
  const [view, setView] = useState('week')

  const step = VIEWS.find((item) => item.id === view)?.step ?? 'week'
  const days =
    view === 'day' ? [selected] : weekDays(selected).slice(0, WORK_DAYS)
  // `weekdayLabels()` is Monday-first, so a week view can index it directly.
  // A single day has to be looked up by its own weekday instead, and
  // `getDay()` is Sunday-first — hence the shift.
  const labels =
    view === 'day'
      ? [weekdayLabels()[(selected.getDay() + 6) % 7]]
      : weekdayLabels()
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
    <section>
      {/* **Outside the grid's border, above its top rule.** The heading and the
          controls are what you steer the grid *with*, not part of it, so the
          line belongs between them — inside the box the toolbar read as a
          caption trapped under a lid.

          It carries no rule of its own either: the day names below already have
          one, and two lines twelve pixels apart read as a mistake. */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">
          {t('nav.appointments')}
        </h2>

        {/* Arrows and views travel together against the right edge: both answer
            "which days am I looking at", and splitting them across the bar
            would put one of them next to a heading it has nothing to do
            with. */}
        <div className="flex items-center gap-2">
          <StepButton
            label={t('appointments.prev')}
            icon={ArrowLeft01Icon}
            onClick={() => onSelect?.(shiftDate(selected, step, -1))}
          />
          <StepButton
            label={t('appointments.next')}
            icon={ArrowRight01Icon}
            onClick={() => onSelect?.(shiftDate(selected, step, 1))}
          />

          {/* The active segment takes the accent fill the calendar's selected
              day takes, so "this one" looks the same wherever the app says it.
              The track is an ink tint rather than `ground`, which on the dark
              theme is the same black as everything behind it. */}
          <div
            role="group"
            className="flex items-center gap-0.5 rounded-full bg-ink/6 p-0.5"
          >
            {VIEWS.map((item) => {
              const isActive = item.id === view

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  aria-pressed={isActive}
                  className={`rounded-full px-3 py-1 text-[13px] font-medium outline-none transition-colors ${
                    isActive
                      ? 'bg-accent text-surface'
                      : 'text-muted hover:text-ink focus-visible:text-ink'
                  }`}
                >
                  {t(item.labelKey)}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* **Not a card.** No radius, no fill, no box — only the rules above and
          below, running the full width of the column. A rounded white block
          would have made the busiest surface in the product one more thing
          lying on the page; square and edge to edge makes it part of the shell,
          and the top rule reads as the rail's own line turning the corner.

          The scroll lives here and not on the page: thirteen hours is 728px of
          grid, and a page that scrolls the whole screen to reach 19:00 takes
          the calendar and the cards with it. */}
      <div className="max-h-[560px] overflow-y-auto border-y border-line">
        {/* The gutter plus one column per day. `min-w` is what keeps a column
            wide enough to hold a booking on a narrow window — below it the
            grid scrolls sideways instead of squeezing five days into nothing. */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`,
            // Wide enough that a column can hold a booking; below it the grid
            // scrolls sideways rather than squeezing five days into nothing. A
            // single day needs no floor — one column of whatever is left is
            // always wider than one of five.
            minWidth: days.length > 1 ? 56 + days.length * 120 : undefined,
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
              // Spans the gutter and every day column — `+ 2` because grid
              // lines are counted, not tracks: five days plus the gutter is six
              // columns and therefore seven lines.
              style={{ top: nowOffset, gridColumn: `1 / ${days.length + 2}` }}
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

/** One of the two step arrows, the same object the calendar's month arrows are
 *  so the two toolbars read as one family. */
function StepButton({ label, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink/12 text-ink outline-none transition-colors hover:bg-ink/20 focus-visible:bg-ink/20"
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
