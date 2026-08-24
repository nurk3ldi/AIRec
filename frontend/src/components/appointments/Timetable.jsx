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
 * The now-line has **its own colour**, `--now`, and not `danger`. Red is what
 * every calendar reaches for, but in this app red means something — a cancelled
 * booking, a failed save — and a permanent red rule across the busiest surface
 * in the product would spend that meaning on a clock. Orange is close enough to
 * carry the same urgency and is already a hue the project owns.
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
  // **The week, not the five columns drawn from it.** The line spans every
  // column because it marks a time of day rather than a date — so the question
  // it answers is "is the week on screen this week", and asking instead whether
  // today is one of the five *drawn* days hid it every Saturday and Sunday, on
  // a work-week view that by definition never contains them. The day view still
  // asks about the day, because there it is the same question.
  const showNow =
    withinGrid &&
    (view === 'day'
      ? sameDay(selected, now)
      : weekDays(selected).some((day) => sameDay(day, now)))
  const nowOffset = ((nowMinutes - START_HOUR * 60) / 60) * ROW_HEIGHT

  return (
    // **65% of the page, a definite share rather than `flex-1`.** Filling every
    // pixel the column had left made the grid the tallest thing on screen by a
    // long way, and the 35% it gives up is not spare room — it is where the
    // cards above it go. The page element carries a *definite* height, which is
    // the only reason a percentage resolves here at all; see the note on it.
    //
    // `min-h-0` stays: without it the grid inside refuses to shrink below its
    // thirteen 56px hours and the overflow lands on the document instead.
    <section className="flex h-[65%] min-h-0 flex-col">
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
                  className={`grid h-8 place-items-center rounded-full px-4 text-[14px] font-medium outline-none transition-colors ${
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

          **This is the only thing on the page that scrolls**, and its height is
          whatever the page has left after the cards above it — `flex-1` for the
          leftover, `min-h-0` so it may actually take less than its 13 hours of
          content. Without that second class a flex item refuses to shrink below
          what it holds, and the overflow lands on the document instead: the
          page grows past the viewport and Chrome puts a scrollbar down the side
          of the whole app. Scrolling belongs to the grid, not to the screen. */}
      <div className="min-h-0 flex-1 overflow-auto border-y border-line">
        {/* The gutter plus one column per day. `minWidth` keeps a column wide
            enough to hold a booking: below it the grid scrolls sideways rather
            than squeezing five days into nothing. A single day needs no floor —
            one column of whatever is left is always wider than one of five. */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`,
            minWidth: days.length > 1 ? 56 + days.length * 120 : undefined,
          }}
        >
          {/* Sticky, because scrolling to the evening with no idea which
              column is Thursday is scrolling blind — and opaque, because the
              hours pass underneath rather than beside.

              The corner above the gutter carries **no rule**, which is what
              stops it reading as an empty cell: the line under the day names
              belongs to the days, and the gutter is not one of them. It keeps
              the fill regardless — that is the mask the hour labels slide
              under. */}
          <div className="sticky top-0 z-20 bg-ground" />
          {days.map((day, index) => {
            const isToday = sameDay(day, now)

            return (
              <div
                key={day.toISOString()}
                // **Opaque, always.** The rows scroll underneath these, and a
                // translucent heading would let 15:00 show through the word
                // "ЧТ" — which is also why the selected column's tint is
                // marked on the body below rather than up here.
                //
                // **A grey, and only on the cells that carry a day name.** The
                // strip is a different thing from the grid under it, and one
                // flat colour across both left it reading as the first empty
                // row of the day. The gutter corner beside them is deliberately
                // not part of it — nothing is written there, so it stays the
                // page's own colour and the grey begins where the days do.
                //
                // Mixed from `ink` rather than taken as `bg-ink/7`, for the
                // same reason the today tint is mixed: these headings cannot be
                // translucent. 7% lands on a grey in both themes — a step up
                // from black, a step down from white — instead of a value that
                // only reads as grey on one of them.
                //
                // **Today is `--now`, the colour this product already uses for
                // "the present moment"** — the same orange as the line that
                // crosses the grid, so the column and the line say the same
                // thing in the same voice. Not a new hue, and not `danger`: red
                // means a cancelled booking here, and it would say so about
                // every Wednesday.
                //
                // The tint is a `color-mix` rather than `bg-now/12`, because an
                // alpha would be exactly the transparency this heading cannot
                // have — it is mixed into the opaque fill instead, so it stays
                // a solid colour and still tracks both themes. The top rule is
                // an inset shadow, which costs no layout: a real border would
                // make this one cell 2px taller than its neighbours.
                className={`sticky top-0 z-20 flex items-baseline gap-1.5 border-b border-l border-line px-3 py-2 ${
                  isToday
                    ? 'bg-[color-mix(in_oklab,var(--color-now)_12%,var(--color-surface-raised))] shadow-[inset_0_2px_0_var(--color-now)]'
                    : 'bg-[color-mix(in_oklab,var(--color-ink)_7%,var(--color-surface-raised))]'
                }`}
              >
                {/* Weekday and date on one line, aligned left rather than
                    stacked and centred. Stacked, the row was two lines tall for
                    six characters of information and the eye had to travel down
                    a column to read one date; side by side it reads as a label,
                    and the height it gives back goes to the grid — which is the
                    part of this screen that actually needs it.

                    One size for both, so the pair reads as a single label
                    rather than a caption with a heading stuck to it. The
                    hierarchy is carried by weight and colour instead — muted
                    medium against ink semibold — which is enough at this
                    distance and costs no height. Baselines rather than centres
                    all the same: the two faces have different cap heights even
                    at the same size. */}
                <span
                  className={`text-[13px] font-medium tracking-wide ${
                    isToday ? 'text-now' : 'text-muted'
                  }`}
                >
                  {labels[index]}
                </span>
                <span
                  className={`font-display text-[13px] ${
                    isToday ? 'font-bold text-ink' : 'font-semibold text-ink'
                  }`}
                >
                  {String(day.getDate()).padStart(2, '0')}
                </span>
              </div>
            )
          })}

          {/* The hour gutter. Labels sit at the **top of the hour they name**
              rather than straddling the rule above it.

              Straddling reads slightly better mid-grid — the number centres on
              its own line — but it puts the first label half above the grid,
              where the sticky corner paints over it and 08:00 arrives sliced in
              half. Sitting inside the row costs a couple of pixels of precision
              and makes the column start where the times start, which is what
              the gutter is for. */}
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="relative h-14">
                {/* Centred across the gutter rather than pushed against the
                    grid, and at the day headings' 13px — the times are the
                    column's whole content, so hugging one edge of it left the
                    other looking like padding nobody claimed. */}
                <span className="absolute inset-x-0 top-1 text-center text-[13px] text-muted">
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
              {/* The time in the gutter, centred in it exactly as the hours
                  above and below are, so the column reads as one list with one
                  of its entries lit. Orange text rather than a filled chip: a
                  chip is a block among lines and pulls harder than a clock
                  should. */}
              <span className="absolute top-0 left-0 w-14 -translate-y-1/2 text-center text-[13px] font-semibold text-now">
                {fromMinutes(nowMinutes)}
              </span>

              {/* A dot where the line begins. One pixel of rule is easy to lose
                  against the hour rules it crosses; the dot is what makes the
                  eye find the line's height at a glance. */}
              <span className="absolute top-0 left-14 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-now" />

              <div className="ml-14 h-px bg-now" />
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
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/12 text-ink outline-none transition-colors hover:bg-ink/20 focus-visible:bg-ink/20"
    >
      <HugeiconsIcon
        icon={icon}
        size={17}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
    </button>
  )
}
