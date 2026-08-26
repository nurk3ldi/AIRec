import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import {
  BOOKING_STATES,
  byStart,
  formatPrice,
  fromMinutes,
  layoutDay,
  stateOf,
  statusLabel,
} from '../../lib/appointments'
import {
  dayKey,
  dayLabel,
  rangeLabel,
  sameDay,
  shiftDate,
  weekDays,
  weekdayLabels,
} from '../../lib/dates'
import { closedRanges } from '../../lib/schedule'
import BookingPopover from './BookingPopover'
import StatusFilter from './StatusFilter'
import { PANEL_MOTION } from './panel'
import { useT } from '../../lib/i18n'

// The window of the day the grid draws. A guess for now, and an honest one:
// the real answer is the business's own working hours, which `/business`
// already stores and `lib/schedule.js` already knows how to read — this becomes
// `openSpans()` the moment the page fetches them.
const START_HOUR = 8
const END_HOUR = 21
/**
 * **How much of the day is on screen at once — and the hour's height is derived
 * from it, not the other way round.**
 *
 * It was a fixed 56, then 80, then 200, and every one of those was an answer to
 * "how tall should an hour be?", which cannot be answered in pixels: the same
 * number is a cramped grid on a laptop and a wasteful one on a monitor. What
 * can be answered is how much of the day should be readable without scrolling,
 * and three hours is enough to see what is coming while leaving the shortest
 * booking a business can take room to be read.
 *
 * The hour is therefore whatever a third of the visible grid is, measured. A
 * fifteen-minute booking is a twelfth of it, which on an ordinary window is
 * comfortably a card rather than the 20px sliver it was at a fixed 80.
 */
const HOURS_ON_SCREEN = 3

/**
 * How much of the column the grid takes when the cards above it are showing.
 *
 * Written here as well as in the class below because the hour's height is
 * derived from it: raising the grid must not make the *hours* taller, it must
 * reveal **more of them**. Measuring the box and dividing by
 * `HOURS_ON_SCREEN` would do the opposite — the same three hours, stretched —
 * so the sum is always taken against the collapsed height and the extra room
 * goes to the rest of the day.
 */
const GRID_SHARE = 0.65

// Monday to Friday. The week helper hands back seven and this takes the front
// of it, so Saturday and Sunday are dropped rather than reordered — `weekDays`
// is Monday-first for the same reason the backend's `weekday` is, and slicing
// the tail off keeps both agreeing about which day is which.
const WORK_DAYS = 5

/**
 * How wide a booking is in the day view, and the air between two of them.
 *
 * **A fixed width, not a share of the column.** Across five days a booking gets
 * a fifth of the grid whether it wants one or not, which is right — the columns
 * are the days. One day is a different problem: a single booking stretched
 * across the whole screen is a card holding four short lines and a metre of
 * empty space, and two of them are half a screen each for the same reason.
 *
 * 240 is what the four lines actually want — a name, a service, a span and a
 * price, none of them long. What is left over is not padding: it is where the
 * *second* booking at that hour goes, and the third. Past what fits, the grid
 * scrolls sideways rather than making every card narrower, because a column
 * that thins as the day fills is one where a busy hour is the least readable.
 */
const LANE_WIDTH = 240
const LANE_GAP = 8
/**
 * The margin between the column's own rule and the first lane.
 *
 * Without it a booking sits flush against that line and reads as welded to it.
 * **Half the gap, because that is what every other edge on the grid gets:** the
 * divider between two lanes is centred in `LANE_GAP`, so a card clears it by
 * `LANE_GAP / 2` on the right. A full gap here made the left margin twice the
 * right one, which is the kind of asymmetry that is only visible once you have
 * seen it and then cannot be unseen.
 */
const LANE_INSET = LANE_GAP / 2

/**
 * How wide a card has to be before a line is worth drawing in it.
 *
 * **The card already decides what to show by its height; this is the same rule
 * turned ninety degrees, and it was missing.** In the week view a column is
 * split between however many bookings share an hour, so three at 19:00 on a
 * laptop leaves each about 90px — and at 90px every line the card drew came out
 * as an ellipsis. «Активно» became «Актив…», a client became «Nur…», and the
 * span became «19:00 –» with the price pushed off the end. A row of cards
 * saying nothing but that something is there, three times.
 *
 * The thresholds are what the text actually needs, measured the way the height
 * ones were. Under `LABEL`, the status is the coloured dot alone — the colour
 * *is* the status now, so the word is the part that can go, and it stays in the
 * accessibility tree. Under `RANGE`, the footer shows the start time and drops
 * both the dash and the price: a start is the half of a span you scan for, and
 * a truncated end time is worse than none.
 *
 * The name is never dropped. A card that cannot say who is coming has stopped
 * being a booking, and at that point the honest answer is the day view, which
 * is a switch away and gives every one of them 240px.
 */
const CARD_WIDTH = {
  LABEL: 132,
  RANGE: 108,
}

/**
 * What colour a booking's status is said in.
 *
 * **The word takes the colour, the card does not.** Tinting the whole fill was
 * tried and taken back out: a week of coloured blocks is a week that looks like
 * something is happening, and it is also what forces every other line on the
 * card to be re-checked for contrast against three different grounds. One
 * 12px label carries the same information and costs the grid nothing.
 *
 * **Three of the four get a colour and `cancelled` is the grey one.** That is
 * the exception on purpose: it gave its hour back — see `BLOCKING_STATUSES` —
 * so it is the one row on the grid that is not an appointment any more, and the
 * card already fades to 45% to say so. Colouring it would be pointing at the
 * one booking nobody has to look at.
 *
 * None of the three is a new hue. `completed` is `ok`, the green this project
 * already means "done" with; `no_show` is `danger`, the red it already means
 * "this went wrong" with; `confirmed` is `--now`, the orange that already means
 * "the present moment" here — it is the live booking, the one the day is
 * actually made of, and the same colour crosses the grid as the now-line and
 * tints today's column.
 */
const STATUS_TONE = {
  confirmed: 'text-now',
  completed: 'text-ok',
  no_show: 'text-danger',
}

/**
 * The diagonal hatch a closed stretch wears.
 *
 * **A pattern rather than a flat grey, because a flat grey is a colour and this
 * has to read as "nothing happens here".** A tint says the hour is *some* other
 * kind of hour; hatching says it is struck out. It is also the one thing that
 * survives a booking being drawn on top of it, which a fill would not.
 *
 * 6px on, 6px off at 135° — the reference's own period, measured off it. The
 * contrast is deliberately tiny: this is the background of the grid, and a
 * visible stripe across a fifth of the screen is a texture nobody asked to
 * look at. `color-mix` rather than an alpha stop so the stripes track `ink`
 * through a theme change.
 */
const HATCH =
  'repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklab, var(--color-ink) 5%, transparent) 6px 12px)'

/** The slice of the day the grid draws, in minutes. */
const WINDOW_FROM = START_HOUR * 60
const WINDOW_TO = END_HOUR * 60

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
export default function Timetable({
  selected,
  onSelect,
  week,
  bookings,
  services,
  timeZone,
  onSaved,
  expanded,
  onToggleExpanded,
}) {
  const t = useT()
  const [view, setView] = useState('week')
  // Empty means "everything", not "nothing" — see the note on `StatusFilter`.
  const [statuses, setStatuses] = useState(() => new Set())
  // **Which way the last step went**, so the days can arrive from the side they
  // came from. A week that simply replaces the one before it says the date
  // changed; a week that slides in from the right says you went *forward*,
  // which is the whole of what the two arrows mean.
  const [direction, setDirection] = useState(0)
  const reduce = useReducedMotion()

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
    (_, index) => START_HOUR + index,
  )

  /**
   * The stretches of `day` the business is shut, clipped to the hours on
   * screen.
   *
   * `(getDay() + 6) % 7` because the API counts weekdays from Monday — the same
   * translation the day headings need, and the only place the two calendars
   * disagree. A week that has not arrived yet shades nothing.
   */
  const closedFor = (day) => {
    const row = week?.find((item) => item.weekday === (day.getDay() + 6) % 7)
    return closedRanges(row)
      .map((range) => ({
        ...range,
        from: Math.max(range.from, WINDOW_FROM),
        to: Math.min(range.to, WINDOW_TO),
      }))
      .filter((range) => range.to > range.from)
  }

  /**
   * What is booked on `day`, positioned.
   *
   * **Every card is the same grey.** `BOOKING_COLORS` gave each booking of a
   * day its own hue so one could be told from another at a glance, which is a
   * real argument and lost to a plainer one: a week of coloured blocks is a
   * week that looks like something is happening, and nothing here needs a
   * colour to mean anything yet. When something does — a status worth spotting
   * from across the room — it will have the whole surface to say it on.
   *
   * `byStart` still sorts, because `layoutDay` needs a *total* order: it breaks
   * a tie on the id, so two bookings starting the same minute cannot swap lanes
   * between renders.
   *
   * `layoutDay` is what makes two bookings at the same hour sit side by side
   * rather than one behind the other. A business with `capacity` above one is
   * expected to have them, and hiding the second would make the day look
   * emptier than it is.
   */
  const bookingsFor = (day) => {
    const key = dayKey(day)
    const sorted = (bookings ?? [])
      .filter(
        (b) =>
          b.day === key &&
          (statuses.size === 0 || statuses.has(stateOf(b.status))),
      )
      .sort(byStart)
    return layoutDay(sorted)
  }

  /**
   * The hour's height in pixels, measured rather than chosen.
   *
   * The grid's own box minus the day names sticking to its top — that strip
   * scrolls over the hours rather than beside them, so counting it would make
   * the four hours slightly less than four. A `ResizeObserver` because this
   * changes with the window, with the `xl` breakpoint that restacks the page,
   * and with the panel beside it; a one-off measurement would be right until
   * the first time anything moved.
   *
   * **It starts at a real number, not at 0.** Everything on the grid is
   * positioned by this, so a zero collapses the hour rows to nothing, stacks
   * the gutter's labels on top of each other and leaves the columns blank — a
   * grid that renders and then appears to vanish. That is the state between
   * mount and the observer's first callback, and it is also what is left if the
   * measurement never lands: a box that is not laid out yet, a browser without
   * `ResizeObserver`. 120 is a plausible hour, so the worst case is a grid at
   * the wrong scale rather than no grid at all.
   *
   * It is also why the rows below take this same value as a style rather than a
   * class: were they `h-20` and this a measured number, the two would disagree
   * on the first frame and on every frame after it.
   */
  const scroller = useRef(null)
  const heading = useRef(null)
  const [rowHeight, setRowHeight] = useState(120)
  /**
   * How wide one day's column is, in pixels.
   *
   * Measured for the same reason the hour is: a week column is `1fr` of
   * whatever is left after the gutter, so its width is a fact about the window
   * rather than a number anyone can write down. The cards need it because what
   * a card can *say* depends on how wide it is — see `BookingBlock` — and a
   * percentage cannot be compared against the width of a word.
   *
   * It starts at `LANE_WIDTH` so the first frame assumes a comfortable column
   * rather than a cramped one: guessing wide shows a card with too much in it
   * for one frame, guessing narrow blanks every card until the observer lands.
   */
  const [columnWidth, setColumnWidth] = useState(LANE_WIDTH)

  useEffect(() => {
    const box = scroller.current
    if (!box) return

    const measure = () => {
      const head = heading.current?.offsetHeight ?? 0
      const usable = box.clientHeight - head
      // The gutter is a fixed track and is not one of the days.
      const columns = (box.clientWidth - 56) / Math.max(days.length, 1)
      if (columns > 0) setColumnWidth(columns)
      // Against the *collapsed* height, never the current one — see the note
      // on `GRID_SHARE`. Raised, the box is bigger and the hour is not, so what
      // the extra room buys is more of the day rather than a taller morning.
      const collapsed = expanded ? usable * GRID_SHARE : usable
      if (collapsed > 0) setRowHeight(collapsed / HOURS_ON_SCREEN)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
    // Re-measured when the grid is raised or lowered: the share it is taken
    // against has changed, and the observer alone would not know that. And on
    // a view switch, because one day and five split the same box very
    // differently and the observer sees no resize when only the count changes.
  }, [expanded, days.length])

  /**
   * What a day column actually draws: single cards, and clusters gathered into
   * one where the column cannot hold them apart.
   *
   * **A card that has to be read is worth more than three that cannot be.**
   * Below `CARD_WIDTH.RANGE` a lane has room for a name and nothing else — no
   * span, no price, no status — so three bookings at 19:00 in a week column
   * become three boxes whose only message is that something is there, said
   * three times. One box saying "three bookings, 19:00–20:30" is the same
   * message once, and it is the truthful one for a view whose job is scanning.
   *
   * It is decided on the *measured* lane rather than on the count: two
   * bookings on a wide monitor are perfectly readable side by side, and
   * collapsing them there would hide what the screen had room for. The day view
   * never groups — its lanes are a fixed 240px and it scrolls sideways instead,
   * which is the other way to answer the same question.
   */
  const drawFor = (day) => {
    const blocks = bookingsFor(day)
    const single = []
    const groups = new Map()

    for (const block of blocks) {
      const lane = columnWidth / block.lanes - LANE_INSET * 2
      if (view === 'day' || block.lanes === 1 || lane >= CARD_WIDTH.RANGE) {
        single.push(block)
        continue
      }
      const found = groups.get(block.cluster)
      if (found) found.push(block)
      else groups.set(block.cluster, [block])
    }

    return {
      single,
      groups: [...groups.values()].map((list) => list.sort(byStart)),
    }
  }

  // The widest cluster of the day, which is how many lanes the column has to
  // be able to hold. Only the day view asks: the week view sizes its columns by
  // the days, not by what is in them.
  const dayLanes =
    view === 'day'
      ? bookingsFor(selected).reduce(
          (most, block) => Math.max(most, block.lanes),
          1,
        )
      : 1

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
  const nowOffset = ((nowMinutes - START_HOUR * 60) / 60) * rowHeight

  return (
    // **65% of the page, a definite share rather than `flex-1`.** Filling every
    // pixel the column had left made the grid the tallest thing on screen by a
    // long way, and the 35% it gives up is not spare room — it is where the
    // cards above it go. The page element carries a *definite* height, which is
    // the only reason a percentage resolves here at all; see the note on it.
    //
    // `min-h-0` stays: without it the grid inside refuses to shrink below its
    // thirteen 56px hours and the overflow lands on the document instead.
    <section
      // `h-[65%]` → `h-full`, both percentages of a definite height, which is
      // what makes the change animatable at all. The curve is the one the
      // profile sheet uses — this is the same gesture, a panel sliding over
      // what was there.
      className={`flex min-h-0 flex-col transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
        expanded ? 'h-full' : 'h-[65%]'
      }`}
    >
      {/* **The pull.** A strip the full width of the grid with a grip in the
          middle of it, which is what a blind looks like when it is down. It is
          a button rather than a drag target: dragging would have to decide what
          a half-pulled curtain means, and there are only two answers worth
          having. Clicking anywhere along it works, so it is a large target for
          a small mark. */}
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        aria-label={t(
          expanded ? 'appointments.collapse' : 'appointments.expand',
        )}
        className="group grid h-4 shrink-0 place-items-center outline-none"
      >
        <span className="h-1 w-9 rounded-full bg-ink/15 transition-colors group-hover:bg-ink/30 group-focus-visible:bg-ink/30" />
      </button>
      {/* **Outside the grid's border, above its top rule.** The heading and the
          controls are what you steer the grid *with*, not part of it, so the
          line belongs between them — inside the box the toolbar read as a
          caption trapped under a lid.

          It carries no rule of its own either: the day names below already have
          one, and two lines twelve pixels apart read as a mistake. */}
      {/* No padding at the top at all: the grip's own 16px box already centres
          a 4px bar, so it carries 6px of air under it and any more here was
          that gap twice. `pb-3` stays — below the toolbar is the grid, and that
          side has nothing else supplying the space. */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-0 pb-3">
        {/* **The days on screen, not the word «Записи».** That word is the
            page's title forty pixels above this, so writing it again was the
            same label twice at two adjacent sizes — the one pairing this
            project's type scale rules out by name.

            What was missing is what this says now. Three controls on the right
            change *which days are showing* and the calendar changes it from the
            other side of the page, and nothing put the answer into words: you
            read it off the column headings, or counted.

            17px, not the 22 the heading was. It is no longer the page's title
            and should not be its loudest line; it is the toolbar's anchor, and
            a real step down from the 24 above it rather than the near-miss that
            was there before. */}
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 truncate font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
            {view === 'day'
              ? dayLabel(days[0])
              : rangeLabel(days[0], days[days.length - 1])}
          </h2>
          <StatusFilter value={statuses} onChange={setStatuses} />
        </div>

        {/* Arrows and views travel together against the right edge: both answer
            "which days am I looking at", and splitting them across the bar
            would put one of them next to a heading it has nothing to do
            with. */}
        <div className="flex items-center gap-2">
          <StepButton
            label={t('appointments.prev')}
            icon={ArrowLeft01Icon}
            onClick={() => {
              setDirection(-1)
              onSelect?.(shiftDate(selected, step, -1))
            }}
          />
          <StepButton
            label={t('appointments.next')}
            icon={ArrowRight01Icon}
            onClick={() => {
              setDirection(1)
              onSelect?.(shiftDate(selected, step, 1))
            }}
          />

          {/* **The chosen segment is a raised chip, not the accent.** The
              accent is pure white on the dark theme, so marking the current
              view with it put a solid white block in the middle of a black
              toolbar — the loudest thing on the page, for a switch that only
              says how many days are on screen. A switch is not an action.

              `surface-chip` is a step *up* from the track in either theme —
              white on the light one, `#2a2a2a` on the dark — which is how a
              segmented control has always shown its choice: the pill lifts, it
              does not light up. The track stays an ink tint rather than
              `ground`, which on the dark theme is the same black as everything
              behind it. */}
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
                      ? 'bg-surface-chip text-ink'
                      : 'text-muted hover:text-ink focus-visible:text-ink'
                  }`}
                >
                  {t(item.labelKey)}
                </button>
              )
            })}
          </div>

          {/* **32px, matching the filled pill beside it rather than the box
              around it.** The track next door is 36px, but 2px of it is gutter
              on each side and what you actually see is a 32px pill — so a 36px
              button here sat a step taller than the only other filled shape in
              the row, which is the comparison the eye makes. The circles on the
              far side are 36 and stay so; a circle and a pill are not read
              against each other the way two pills are.

              What is kept short is the word: «Добавить», not «Новая запись»,
              because the object is already named by the heading at the other
              end of this bar and a button does not have to repeat the noun to
              say what it does.

              **`surface-chip`, the same lift the chosen segment takes**, not
              the accent it wore before. On the dark theme the accent is pure
              white, and a solid white pill in a black toolbar was the loudest
              thing on the page — bright enough to read as a warning rather than
              as an invitation. The chip is a step up from the bar in either
              theme, which is enough to say "this is pressable" without
              shouting it.

              It gives up being visibly the *primary* action, which the accent
              was doing. That is a fair trade here: there is one button in this
              bar that adds anything, it carries a plus, and nothing else in the
              row is competing to be pressed.

              Below `sm` the glyph carries it alone — three words in a bar that
              also holds a heading, two arrows and a two-way switch is a bar
              that wraps. */}
          {/* The panel is anchored to this button and rendered from here for
              that reason: Radix positions and traps focus against the element
              that opened it, so the trigger and its popover cannot live in
              different components. The day it writes for is `selected` — the
              same state the calendar and these arrows share. */}
          <BookingPopover
            // The panel starts with an empty date and reports the one that is
            // chosen, so the page follows it rather than seeding it: a booking
            // written for Thursday from a screen showing Monday would otherwise
            // not appear anywhere, since the grid reloads the week around the
            // page's own selection.
            onDayChange={onSelect}
            services={services}
            timeZone={timeZone}
            onSaved={onSaved}
          >
            <button
              type="button"
              aria-label={t('appointments.create')}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-surface-chip pr-4 pl-3 text-[14px] font-medium text-ink outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85 max-sm:w-8 max-sm:justify-center max-sm:px-0"
            >
              <HugeiconsIcon
                icon={Add01Icon}
                size={17}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
              />
              <span className="max-sm:sr-only">{t('appointments.create')}</span>
            </button>
          </BookingPopover>
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
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-auto border-y border-line"
      >
        {/* The gutter plus one column per day. `minWidth` keeps a column wide
            enough to hold a booking: below it the grid scrolls sideways rather
            than squeezing five days into nothing. A single day needs no floor —
            one column of whatever is left is always wider than one of five. */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`,
            // A week needs room for five readable columns; a day needs room
            // for however many bookings share its busiest hour. Either way the
            // grid scrolls sideways rather than squeezing.
            minWidth:
              view === 'day'
                ? 56 + LANE_INSET + dayLanes * (LANE_WIDTH + LANE_GAP)
                : 56 + days.length * 120,
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
          <div ref={heading} className="sticky top-0 z-20 bg-ground" />
          {days.map((day, index) => {
            const isToday = sameDay(day, now)

            return (
              // **Keyed on the day, and entering only.** Changing the key
              // remounts the heading, so React swaps the old for the new in one
              // frame and the arriving one animates in from the direction of
              // travel. No exit, and no `AnimatePresence`: these are cells of a
              // CSS grid, and a leaving heading would sit in the grid beside
              // its replacement until it finished — ten columns where there are
              // five, for the length of the animation.
              //
              // The bookings underneath already fade in on their own, since
              // their keys change with the week too. Between the two, the whole
              // grid reads as arriving.
              <m.div
                key={day.toISOString()}
                initial={
                  reduce || !direction
                    ? false
                    : { opacity: 0, x: direction * 12 }
                }
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: reduce ? 0 : 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
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
              </m.div>
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
              // Height from the constant, not from a class: every booking
              // and the now-line are positioned by `rowHeight`, so a row of a
              // different size puts the whole grid out by however much they
              // differ. They were `h-14` and the constant was 56, which agreed
              // only until one of them was changed.
              <div
                key={hour}
                className="relative"
                style={{ height: rowHeight }}
              >
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

          {days.map((day) => {
            // Once per day, not once per list: `drawFor` walks the day's
            // bookings and buckets them, and calling it twice in the JSX below
            // would do that walk twice for one answer.
            const draw = drawFor(day)

            return (
              <div
                key={day.toISOString()}
                className={`relative border-l border-line ${
                  sameDay(day, selected) ? 'bg-ink/[0.04]' : ''
                }`}
              >
                {hours.map((hour) => (
                  // **No rule across the hour.** The gutter down the left says
                  // what time it is and the columns say which day; a line every
                  // eighty pixels across five columns was a grid drawn over a
                  // grid, and the cards on it have edges of their own to be read
                  // against. The rows stay — they are what gives the column its
                  // height — they simply draw nothing.
                  <div key={hour} style={{ height: rowHeight }} />
                ))}

                {/* **Lane rules, in the day view only.** With one column and
                  fixed-width lanes, two bookings at the same hour sit side by
                  side with nothing but 8px of gap between them — which reads as
                  one wide card that happens to have a seam. A rule says they
                  are two, and it runs the whole height because a lane is a lane
                  all day, not only during the hour that filled it.

                  `dayLanes - 1` of them: lines go *between* lanes, so a day
                  that never doubles up draws none. Centred in the gap, drawn
                  before everything else so the cards paint over them. */}
                {view === 'day' &&
                  Array.from({ length: dayLanes - 1 }, (_, index) => (
                    <div
                      key={`lane-${index}`}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 w-px bg-line"
                      style={{
                        left:
                          LANE_INSET +
                          (index + 1) * (LANE_WIDTH + LANE_GAP) -
                          LANE_GAP / 2,
                      }}
                    />
                  ))}

                {/* Drawn after the hour rules so it lies over them, and before
                  the now-line, which is a later child of the grid and so still
                  crosses it. Bookings will land on top of both. */}
                {closedFor(day).map((range) => (
                  <ClosedSpan
                    key={`${range.kind}-${range.from}`}
                    range={range}
                    rowHeight={rowHeight}
                    label={
                      range.kind === 'off'
                        ? t('appointments.dayOff')
                        : range.kind === 'break'
                          ? t('appointments.break')
                          : null
                    }
                  />
                ))}

                {/* **The one animated thing on this screen, and it answers a
                  question.** Save a booking and the panel closes; without this
                  the card simply exists a frame later, which reads as the grid
                  having always had it. Fading and scaling in says *this is what
                  you just made*, and the same in reverse says a deleted one is
                  gone rather than never having been.

                  It fires on a date change too, when every card is new — twenty
                  elements moving at once, which would normally break the rule
                  about one or two moving things. It does not here because they
                  move together and identically: what the eye sees is the grid
                  refreshing, one object, not twenty. */}
                <AnimatePresence initial={false}>
                  {draw.single.map((block) => (
                    <BookingBlock
                      key={block.id}
                      block={block}
                      rowHeight={rowHeight}
                      laneWidth={view === 'day' ? LANE_WIDTH : null}
                      columnWidth={columnWidth}
                      services={services}
                      timeZone={timeZone}
                      onDayChange={onSelect}
                      onSaved={onSaved}
                    />
                  ))}
                  {draw.groups.map((group) => (
                    <GroupBlock
                      key={`group-${group[0].id}`}
                      group={group}
                      rowHeight={rowHeight}
                      services={services}
                      timeZone={timeZone}
                      onDayChange={onSelect}
                      onSaved={onSaved}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )
          })}

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

/**
 * One booking, drawn where it sits.
 *
 * **Every card is the same grey, and the only colour on it is the status
 * word** — see `STATUS_TONE`. Three answers to "what should a booking be
 * coloured by" have been switched off to get here: a hue per booking of the
 * day, a mark the owner picked, and the status painted across the whole fill.
 * The first two said *which* booking it was rather than anything about it; the
 * third said something true but said it in a week of coloured blocks, which is
 * a week that looks like something is happening.
 *
 * A cancelled booking fades rather than disappearing: it gave its hour back —
 * `BLOCKING_STATUSES` — but it is still what happened there, and the assistant
 * has already spoken to that client about that time.
 */
function BookingBlock({
  block,
  rowHeight,
  laneWidth,
  columnWidth,
  services,
  timeZone,
  onDayChange,
  onSaved,
}) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const top = ((block.start - WINDOW_FROM) / 60) * rowHeight
  // A floor, so a fifteen-minute service is still a block you can read a name
  // out of rather than a coloured line.
  // A floor for the case where the grid is briefly too short to give a quarter
  // hour any height at all — a narrow window, or the first frame before the
  // measurement lands. A card below this is a coloured line, not a card.
  const height = Math.max(((block.end - block.start) / 60) * rowHeight, 34)
  const state = stateOf(block.status)
  const cancelled = state === 'cancelled'
  // What this card is actually going to be, in pixels — the fixed lane in the
  // day view, and in the week view the share of a measured column that is left
  // after the insets and the gaps between lanes. It mirrors the `width` written
  // into the style below; the two are the same sum, one for the browser to lay
  // out with and one to decide what will fit inside it.
  const width =
    laneWidth ?? Math.max(columnWidth / block.lanes - LANE_INSET * 2, 0)

  return (
    // **Double click, not click.** A single click on a booking will eventually
    // select it — the grid needs a lighter gesture for "look at this one" — and
    // spending it on opening a form would leave nothing for that. Double click
    // is also what every calendar on a desktop uses to open an event, so it is
    // a habit rather than a thing to learn. `select-none` because a double
    // click on text selects a word first, and a highlighted name behind an open
    // panel looks like a bug.
    <BookingPopover
      asAnchor
      open={open}
      onOpenChange={setOpen}
      booking={block}
      onDayChange={onDayChange}
      services={services}
      timeZone={timeZone}
      onSaved={onSaved}
    >
      <m.div
        // Opacity and a hair of scale, nothing that moves the card off where it
        // belongs: a booking's position *is* its meaning here, and sliding one
        // in from anywhere would be drawing it at a time it is not.
        //
        // 180ms out of nothing and 120ms back into it — arriving is the half
        // worth watching, leaving is the half you have already decided about.
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        transition={{
          duration: reduce ? 0 : 0.18,
          ease: [0.16, 1, 0.3, 1],
        }}
        onDoubleClick={() => setOpen(true)}
        // **`surface-card`, its own fill, and it took three tries to land on
        // one.** `surface-chip` was too loud — `#2a2a2a` on a black grid is a
        // light grey box, and it is also what this app marks *the chosen thing*
        // with, so spending it on every booking would leave nothing to say "this
        // one" with when the grid finally has a selection. `surface-raised` was
        // the other way: at `#0e0e0e` on a pure black ground it reads as no fill
        // at all, which is right for a card sitting on the page and wrong for one
        // sitting on the grid.
        //
        // A booking is drawn *on* something, and that is the difference the token
        // records.
        //
        // **No border.** The fill is doing that job on its own now, and the
        // hairline was doing it a second time — a stroked box on a grid that
        // already has a rule down every column edge is an outline inside an
        // outline. It also made the card read as a control rather than as a
        // record, which is the wrong noun for something you look at rather than
        // press.
        // **The padding narrows with the card.** 10px a side is 22% of a
        // 90px lane, which is a fifth of the width spent on air in the one
        // place there is none to spare — and the name is what pays for it.
        className={`absolute flex cursor-pointer flex-col gap-1.5 overflow-hidden rounded-lg py-2 select-none ${
          width >= CARD_WIDTH.LABEL ? 'px-2.5' : 'px-2'
        } ${cancelled ? 'opacity-45' : ''}`}
        style={{
          // **Every card is the same grey**, whatever its status — see
          // `STATUS_TONE` for where the status is said instead. The owner's own
          // `color` mark is still stored on the row and still ignored here; the
          // picker for it is out of the panel for now.
          backgroundColor: 'var(--color-surface-card)',
          top,
          height,
          // **Fixed lanes in the day view, shares of the column in the week.**
          // A day has one column and as much of it as the bookings need; a week
          // has five, and a booking belongs to the width of its own day.
          //
          // The week view uses the same `LANE_INSET` on each side, so a booking
          // clears its column's rule by exactly what a day-view one does. It was
          // 2px, which was symmetric but half the day view's — the two screens
          // are the same grid seen at two widths and should not disagree about
          // how far a card sits from an edge.
          ...(laneWidth
            ? {
                left: LANE_INSET + block.lane * (laneWidth + LANE_GAP),
                width: laneWidth,
              }
            : {
                left: `calc(${(block.lane / block.lanes) * 100}% + ${LANE_INSET}px)`,
                width: `calc(${100 / block.lanes}% - ${LANE_INSET * 2}px)`,
              }),
        }}
      >
        {/* **What is shown depends on how tall the booking is**, and the order is
          what matters: the name first, because that is what the owner scans
          for; then what they are here for; then the arithmetic. A card that
          dropped the name to keep the price would be sorted the wrong way
          round.

          The thresholds are what actually fits, measured against the line
          heights below rather than guessed — 28px holds the name, 54 holds the
          service under it, 78 adds the footer and 104 the status strip. They
          move with the type and with the padding; a threshold left behind a
          size change is a card that clips the line it just decided to draw. */}
        {height >= 104 && (
          // The muted grey is the fallback rather than a fourth entry: it is
          // what `cancelled` takes, and it is also what a status this map has
          // never heard of should look like.
          <p
            className={`flex items-center gap-1.5 truncate text-[12px] leading-none font-medium ${
              STATUS_TONE[state] ?? 'text-muted'
            }`}
          >
            {/* `currentColor`, so the dot and the word are the same statement
              rather than two things that have to be kept in step. */}
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
            />
            {/* Narrow, the dot says it on its own — but only to someone who can
              see it, which is why the word goes to `sr-only` rather than
              away. */}
            <span className={width >= CARD_WIDTH.LABEL ? '' : 'sr-only'}>
              {statusLabel(block.status)}
            </span>
          </p>
        )}

        {/* **The one line that is never dropped**, and the one that steps
          down instead. At 15px a narrow lane cuts an ordinary first name in
          half — «Nurkeldi» wants about 68px and a 90px card offers 70 before
          its padding — where 13px fits it whole. A name shown smaller is still
          the name; a name shown as «Nur…» is not. */}
        <p
          className={`truncate leading-tight font-semibold text-ink ${
            width >= CARD_WIDTH.LABEL ? 'text-[15px]' : 'text-[13px]'
          }`}
        >
          {block.client}
        </p>

        {height >= 54 && (
          // `ink`, not `muted`: on a grey card the muted grey was a second grey
          // and the line disappeared into its own background. The hierarchy is
          // carried by weight instead — the name is semibold, this is not — which
          // survives being read at arm's length where a difference of two greys
          // does not.
          <p className="truncate text-[13px] leading-tight text-ink">
            {block.service}
          </p>
        )}

        {height >= 78 && (
          // Pushed to the bottom edge: the head of the card is what it is, the
          // foot is what it costs, and on a booking that runs three hours the
          // two should not both be huddled at the top.
          <p className="mt-auto flex items-center justify-between gap-2 truncate pt-2 text-[12px] leading-none">
            <span className="font-display font-medium text-ink">
              {width >= CARD_WIDTH.RANGE ? block.range : block.from}
            </span>
            {width >= CARD_WIDTH.LABEL && (
              <span className="shrink-0 text-muted">
                {formatPrice(block.price)}
              </span>
            )}
          </p>
        )}
      </m.div>
    </BookingPopover>
  )
}

/**
 * A cluster of overlapping bookings the column cannot hold apart, as one card.
 *
 * **The week view's job is to say what is happening, and three unreadable
 * boxes do not say it.** Below `CARD_WIDTH.RANGE` a lane has room for a name
 * and nothing else, so a busy hour turned into a row of ellipses — the least
 * legible part of the screen was the part with the most in it. Gathered, the
 * same hour reads as one statement: how many, and from when to when.
 *
 * **Clicking opens the full detail, because the card no longer carries it.**
 * That is the trade and it has to be paid: a group card is a summary, and a
 * summary the reader cannot open is information taken away. The panel lists
 * every booking whole — status, client, service, span, price — and a row opens
 * the ordinary editor anchored to itself, so nothing under it is a second
 * implementation of anything.
 *
 * Single click here, not the grid's double click. On the grid a single click is
 * being kept back for selecting a booking; inside a list there is nothing to
 * keep it back for, and a list row that needs two clicks is a list row people
 * click twice by accident and once in vain.
 */
function GroupBlock({
  group,
  rowHeight,
  services,
  timeZone,
  onDayChange,
  onSaved,
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()

  const start = Math.min(...group.map((block) => block.start))
  const end = Math.max(...group.map((block) => block.end))
  const top = ((start - WINDOW_FROM) / 60) * rowHeight
  const height = Math.max(((end - start) / 60) * rowHeight, 34)
  // Every state present in the cluster, once each and in the order the four are
  // defined — so the dots read as a legend rather than as a tally, and two
  // groups with the same mix look the same.
  const states = BOOKING_STATES.map((state) => state.id).filter((id) =>
    group.some((block) => stateOf(block.status) === id),
  )

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <m.button
          type="button"
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          transition={{ duration: reduce ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setOpen(true)}
          aria-label={t('appointments.groupCount', { count: group.length })}
          // **A dashed edge, which is the one thing on this grid that is
          // stroked.** A booking is a solid card; this is not a booking, it is
          // a stack of them, and the broken line is what says "there is more
          // inside" without a word or an icon spent on it.
          className="absolute flex flex-col gap-1 overflow-hidden rounded-lg border border-dashed border-line bg-surface-card px-2 py-2 text-left outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong"
          style={{
            top,
            height,
            left: LANE_INSET,
            width: `calc(100% - ${LANE_INSET * 2}px)`,
          }}
        >
          <span className="flex shrink-0 items-center gap-1">
            {states.map((id) => (
              <span
                key={id}
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${
                  STATUS_TONE[id] ?? 'text-muted'
                }`}
              />
            ))}
          </span>

          <span className="truncate text-[13px] leading-tight font-semibold text-ink">
            {t('appointments.groupCount', { count: group.length })}
          </span>

          {height >= 60 && (
            <span className="mt-auto truncate font-display text-[12px] leading-none font-medium text-ink">
              {fromMinutes(start)} – {fromMinutes(end)}
            </span>
          )}
        </m.button>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          side="left"
          align="center"
          sideOffset={10}
          // The visible heading is the span, which is what identifies this
          // group on a grid full of them; the panel still needs saying what it
          // *is*, and that belongs in the accessibility tree rather than as a
          // second line of chrome over a four-row list.
          aria-label={t('appointments.groupTitle')}
          // The 68px header plus the usual 12, exactly as the booking panel
          // does it: this is `z-[60]` and the header `z-40`, so nothing else
          // stops it painting over the page title.
          collisionPadding={{ top: 80, right: 12, bottom: 12, left: 12 }}
          className={`z-[60] flex max-h-[min(480px,var(--radix-popover-content-available-height))] w-[min(320px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] outline-none ${PANEL_MOTION}`}
        >
          <p className="shrink-0 px-4 pt-4 pb-2 font-display text-[15px] font-semibold text-ink">
            {fromMinutes(start)} – {fromMinutes(end)}
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {group.map((block) => (
              <GroupRow
                key={block.id}
                block={block}
                services={services}
                timeZone={timeZone}
                onDayChange={onDayChange}
                onSaved={onSaved}
              />
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** One booking inside a group panel: everything the collapsed card had to drop,
 *  and a click that opens the same editor the grid opens. */
function GroupRow({ block, services, timeZone, onDayChange, onSaved }) {
  const [open, setOpen] = useState(false)
  const state = stateOf(block.status)

  return (
    <BookingPopover
      asAnchor
      open={open}
      onOpenChange={setOpen}
      booking={block}
      onDayChange={onDayChange}
      services={services}
      timeZone={timeZone}
      onSaved={onSaved}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full flex-col gap-0.5 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-ink/6 focus-visible:bg-ink/6 ${
          state === 'cancelled' ? 'opacity-45' : ''
        }`}
      >
        <span
          className={`flex items-center gap-1.5 text-[12px] leading-none font-medium ${
            STATUS_TONE[state] ?? 'text-muted'
          }`}
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
          />
          {statusLabel(block.status)}
        </span>

        <span className="truncate text-[14px] leading-tight font-semibold text-ink">
          {block.client}
        </span>

        <span className="truncate text-[13px] leading-tight text-ink">
          {block.service}
        </span>

        <span className="flex items-center justify-between gap-2 pt-0.5 text-[12px] leading-none">
          <span className="font-display font-medium text-ink">
            {block.range}
          </span>
          <span className="shrink-0 text-muted">
            {formatPrice(block.price)}
          </span>
        </span>
      </button>
    </BookingPopover>
  )
}

/**
 * An hour the business is shut — a day off, a break, or the time either side of
 * opening hours.
 *
 * **Struck out rather than filled, and labelled only where the label says
 * something.** "Выходной" and "Перерыв" are facts about the business; the
 * stretch before 10:00 is not, it is simply outside the day, and writing
 * "закрыто" across the top of every column would be the grid telling you what
 * it has already shown you.
 *
 * `pointer-events-none`, so a closed hour stays a place a booking can be put
 * later — the owner writing down someone who came at lunch is an ordinary
 * thing to do, and the shading is information, not a wall.
 *
 * The label hides on a short span: a word in a 15-minute block is a word
 * clipped by its own box. Where it shows, it is centred down the span with a
 * dot before it, the way the reference tags its own blocks.
 */
function ClosedSpan({ range, label, rowHeight }) {
  const top = ((range.from - WINDOW_FROM) / 60) * rowHeight
  const height = ((range.to - range.from) / 60) * rowHeight

  return (
    <div
      className="pointer-events-none absolute inset-x-0 overflow-hidden bg-ink/[0.03]"
      style={{ top, height, backgroundImage: HATCH }}
    >
      {label && height >= 28 && (
        // **Centred down the block, not pinned to its top.** A word at the top
        // edge belongs to the line above it — the hour rule — where one in the
        // middle belongs to the span, which is the thing being named. The dot
        // is the reference's own: it marks the label as a *tag on a block*
        // rather than a stray word floating on the grid, which is exactly what
        // it read as without it.
        <span className="absolute inset-y-0 left-2 flex items-center gap-2 text-[12px] text-muted">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted"
            aria-hidden="true"
          />
          {label}
        </span>
      )}
    </div>
  )
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
