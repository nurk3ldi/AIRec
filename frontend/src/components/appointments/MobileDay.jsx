import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { m, useReducedMotion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import {
  byStart,
  endOf,
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
  shiftDate,
} from '../../lib/dates'
import { closedRanges, toMinutes } from '../../lib/schedule'
import { project, velocityFrom, VELOCITY_WINDOW } from '../../lib/motion'
import { useT } from '../../lib/i18n'
import BookingDetail from './BookingDetail'
import MobileToolbar from './MobileToolbar'
import WeekStrip from './WeekStrip'
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

/** The gutter the hours are written in. */
const GUTTER = 56

/**
 * How far a sideways throw has to be *heading* before it steps a day.
 *
 * Asked of the projected endpoint rather than of where the finger stopped, so a
 * quick 40px flick — which is how anybody actually turns a page — commits, while
 * a slow 50px drag by somebody who changed their mind does not.
 */
const COMMIT_PX = 60

/**
 * How far off-centre the arriving day starts.
 *
 * It was 24 while the gesture itself was invisible. Now that the finger has
 * already moved the grid a real distance, 24px reads as a smaller movement than
 * the one that caused it — the day appears to arrive from nearer than it was
 * thrown from.
 */
const ENTER_OFFSET = 48

/**
 * How many bookings at the same hour fit before the grid starts scrolling
 * sideways.
 *
 * **Three, and the width follows from it rather than the other way round.** A
 * booking used to take the whole column when it was alone and a share of it
 * when it was not, which meant a single booking was a card the width of the
 * screen holding four short lines — and three of them were 110px each, too
 * narrow to read a name in. Sizing every lane to a third of the column fixes
 * both ends: one booking is a third of the screen and looks like a booking, and
 * three fit without any of them shrinking.
 *
 * Past three the grid scrolls rather than dividing further, which is the same
 * answer the desktop day view gives — a column that thins as the hour fills is
 * one where the busiest hour is the least readable.
 */
const VISIBLE_LANES = 3

/** The air between two lanes, and half of it at each edge — the desktop grid's
 *  own numbers, so the two screens do not disagree about how far a card sits
 *  from a rule. */
const LANE_GAP = 8
const LANE_INSET = LANE_GAP / 2

export default function MobileDay({
  day,
  onDayChange,
  onBack,
  marked,
  bookings,
  week,
  services,
  timeZone,
  onSaved,
  onSearch,
  view,
  onViewChange,
  className = '',
}) {
  const t = useT()
  const now = useNow()

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
   * Swiping sideways to step a day.
   *
   * **The gesture has to be told apart from a scroll before it can be
   * answered.** The grid under the finger scrolls vertically, so the first few
   * pixels decide which of the two this is: whichever axis moves further first
   * wins, and once it is the vertical one the swipe is abandoned for the rest
   * of the press. Deciding once rather than continuously is what stops a
   * diagonal drag from flipping between scrolling and stepping.
   *
   * `touch-action: pan-y` on the box below is the other half. Without it the
   * browser owns the horizontal pan and the pointer events arrive already
   * cancelled; with it, vertical scrolling is still the browser's and sideways
   * is ours.
   *
   * **The grid moves with the finger the whole way.** It used to compute `dx`
   * only to latch an axis and then throw it away, so nothing on screen changed
   * until the press ended and the day simply teleported. Touch and content have
   * to move together, or the gesture is undiscoverable — a 55px swipe that does
   * nothing is indistinguishable from one the app failed to notice.
   *
   * The direction is the one the *finger* went: dragging the day to the left
   * brings the next one in from the right, the way a stack of cards behaves.
   * And it commits on where the throw was *heading* rather than where the
   * finger stopped, so a quick short flick steps the day and a slow small drag
   * does not.
   */
  const swipe = useRef(null)
  const trail = useRef([])
  const track = useRef(null)
  const [direction, setDirection] = useState(0)
  const reduce = useReducedMotion()

  /** The drag, written straight to the node — through state this would be a
   *  render of the whole day per `pointermove`, which is once a frame. */
  const slide = (x, animated) => {
    const node = track.current
    if (!node) return
    node.style.transition = animated
      ? 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)'
      : 'none'
    node.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
  }

  const startSwipe = (event) => {
    swipe.current = { x: event.clientX, y: event.clientY, axis: null }
    trail.current = [{ at: performance.now(), value: 0 }]
  }

  const moveSwipe = (event) => {
    const from = swipe.current
    if (!from || from.axis === 'y') return

    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    if (from.axis === null && Math.abs(dx) + Math.abs(dy) > 8) {
      from.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      // **Captured only once the axis is known to be horizontal.** Claiming the
      // pointer at `pointerdown` would take it before it is clear whether this
      // is a scroll, and the browser's vertical pan is the one thing here that
      // must not be interfered with.
      if (from.axis === 'x') {
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }
    }
    if (from.axis !== 'x') return

    const at = performance.now()
    trail.current.push({ at, value: dx })
    while (
      trail.current.length > 2 &&
      at - trail.current[1].at > VELOCITY_WINDOW
    ) {
      trail.current.shift()
    }

    slide(dx, false)
  }

  const endSwipe = (event) => {
    const from = swipe.current
    swipe.current = null
    if (!from || from.axis !== 'x') return

    const dx = event.clientX - from.x
    const projected = dx + project(velocityFrom(trail.current))
    trail.current = []

    if (Math.abs(projected) < COMMIT_PX) {
      // Under the threshold it goes back where it was, on the curve every other
      // settle in this project rides.
      slide(0, true)
      return
    }

    // Cleared *without* a transition, in the same commit as the day change:
    // React batches the two, so the browser paints one frame — the new day
    // already at its entry offset. A transition here would animate the day just
    // left back to centre underneath the one arriving.
    slide(0, false)
    setDirection(projected < 0 ? 1 : -1)
    onDayChange?.(shiftDate(day, 'day', projected < 0 ? 1 : -1))
  }

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
  /**
   * How wide the scroll box is, so a lane can be a third of it.
   *
   * Measured for the same reason the desktop's hour height is: a phone is
   * whatever width it is, and a lane written in pixels would be a third of some
   * other phone. A `ResizeObserver` rather than one reading, because this
   * changes when the device is turned.
   *
   * **`useLayoutEffect`, not `useEffect`.** Everything in the column is placed
   * from this number, so measuring after the paint means one frame with every
   * lane a pixel wide and every card on top of the last — a grid that flickers
   * into place. Measuring before it means there is no such frame.
   */
  const [boxWidth, setBoxWidth] = useState(0)
  const scroller = useRef(null)

  useLayoutEffect(() => {
    const box = scroller.current
    if (!box) return

    const measure = () => setBoxWidth(box.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

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

  // The widest cluster of the day is how many lanes the column has to hold; a
  // day with nothing in it still has one, so the column is never zero wide.
  const laneCount = blocks.reduce((most, block) => Math.max(most, block.lanes), 1)
  const laneWidth = boxWidth ? (boxWidth - GUTTER) / VISIBLE_LANES : 0
  const columnWidth = Math.max(boxWidth - GUTTER, laneCount * laneWidth)
  // Past three lanes the horizontal axis belongs to the content, so the swipe
  // gives it up: a day that scrolls sideways cannot also be stepped sideways
  // without one gesture meaning two things.
  const scrolls = laneCount > VISIBLE_LANES

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
            className="flex h-12 shrink-0 items-center gap-1 rounded-full bg-ink/8 pr-4 pl-3 font-display text-[15px] font-semibold text-ink outline-none transition-[color,background-color,border-color,scale] hover:bg-ink/14 focus-visible:bg-ink/14 active:scale-[0.97]"
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
        view={view}
        onViewChange={onViewChange}
      />

      {/* **The week this day sits in, and it is how you get to the next one.**
          Without it the only way to Friday is back out to the calendar and in
          again — two taps and a screen change for the move a day view is most
          often opened to make. Shared with the agenda; see `WeekStrip`.

          No `onToggle`, so no grip and no month: this screen already gives its
          whole height to twenty-four hours, and five more rows of dates over
          them would be a calendar sitting on the thing you opened the calendar
          to look at.

          The direction is cleared first, so a day picked here arrives without
          motion: the direction belongs to the swipe that set it, and a tap two
          gestures later is not that swipe. */}
      <WeekStrip
        day={day}
        marked={marked}
        onDayChange={(item) => {
          setDirection(0)
          onDayChange?.(item)
        }}
        className="pb-2"
      />

      {/* The date in words, under a rule — the reference's own arrangement, and
          it earns its line: the strip above says which *weekday*, this says
          which day of which month, and on a screen you arrive at from a year of
          months that is not obvious. */}
      <p className="shrink-0 border-y border-line py-2 text-center font-display text-[15px] font-semibold text-ink">
        {dayLabel(day)}
      </p>

      <div
        ref={scroller}
        onPointerDown={scrolls ? undefined : startSwipe}
        onPointerMove={scrolls ? undefined : moveSwipe}
        onPointerUp={scrolls ? undefined : endSwipe}
        onPointerCancel={scrolls ? undefined : endSwipe}
        // `relative`, so the absolutely-placed bookings and the now-line are
        // measured from the grid rather than from whatever is positioned
        // further up the page — the bug the month scroller's heading had.
        //
        // `touch-pan-y`: vertical scrolling stays the browser's, sideways
        // becomes ours — see `startSwipe`. On a day with more lanes than fit,
        // sideways is the content's instead and both axes go back to the
        // browser.
        //
        // `overflow-x-hidden` on the non-scrolling branch is not decoration:
        // `overflow-y: auto` computes the other axis to `auto` too, so the
        // sideways drag below would raise a horizontal scrollbar for the length
        // of every swipe.
        className={`relative min-h-0 flex-1 overflow-y-auto overscroll-contain ${
          scrolls ? 'overflow-x-auto' : 'touch-pan-y overflow-x-hidden'
        }`}
      >
        {/* **The drag lives on this wrapper, not on the `m.div` inside it.**
            That element's transform belongs to Motion's entry animation, and
            two owners of one property is one of them losing. Nested, the two
            compose: the wrapper carries where the finger is, the grid inside
            carries where it arrived from. */}
        <div ref={track} className="will-change-transform">
          {/* **Keyed on the day, and entering only.** Changing the key remounts
              the grid, so React swaps the old for the new in one frame and the
              arriving one comes in from the side the finger sent it. No
              `AnimatePresence`: a leaving grid would sit beside its replacement
              for the length of the animation, two days of hours in one column.

              `direction` is 0 until something steps, so tapping a date in the
              strip or arriving from the calendar simply appears.

              Under `prefers-reduced-motion` the *entrance* goes and the drag
              stays. They are not the same thing: a screenful of content
              travelling on its own is what the setting is about, where content
              sitting under a finger that is moving it is the only feedback the
              gesture has. */}
          <m.div
            key={key}
            initial={
              reduce || !direction
                ? false
                : { opacity: 0, x: direction * ENTER_OFFSET }
            }
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            // `--column-bg` is what the cards below read to cut themselves out
            // of the hatch — see `BookingCard`. Declared here rather than
            // assumed, so the two grids in this app answer it the same way.
            className="relative grid bg-[var(--column-bg)] [--column-bg:var(--color-ground)]"
            style={{
              gridTemplateColumns: `${GUTTER}px ${columnWidth || 1}px`,
              height: (END_HOUR - START_HOUR) * HOUR_HEIGHT,
            }}
          >
            {/* The gutter. Labels sit at the top of the hour they name rather
                than straddling the rule above it, so the first one is not half
                cut off by the top of the scroll box. */}
            {/* **Sticky, so the times survive scrolling to the fourth lane.** The
                desktop lets its gutter scroll away with the columns, which is
                affordable on a screen wide enough to hold the whole day; here
                losing it means reading a card with no idea what hour it is in. */}
            <div className="sticky left-0 z-10 bg-ground">
              {hours.map((hour) => (
                <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute inset-x-0 top-1 text-center text-[12px] text-muted">
                    {fromMinutes(hour * 60)}
                  </span>
                </div>
              ))}

              {/* **The clock, on the line, in the gutter.** The line alone says
                  *where* now is on the grid and leaves you to work out what time
                  that is by reading the two hour labels it sits between. The pill
                  says it outright, and it belongs in the gutter because that is
                  the column times are written in — put on the grid it would be a
                  label floating over whatever booking happened to be behind it.
                  It follows the line because both are placed from the same
                  minute, and `useNow` ticks that minute.

                  Filled rather than coloured text: it sits over the hour label it
                  is nearest to, and two sets of digits an inch apart need one of
                  them to be plainly on top. `text-white` and not `text-surface` —
                  `--now` is a real colour in both themes, so what goes on it does
                  not flip with them. */}
              {isToday && (
                <span
                  className="absolute right-1 z-10 -translate-y-1/2 rounded-full bg-now px-1.5 py-0.5 font-display text-[11px] leading-none font-semibold text-white tabular-nums"
                  style={{ top: ((nowMinutes - WINDOW_FROM) / 60) * HOUR_HEIGHT }}
                >
                  {fromMinutes(nowMinutes)}
                </span>
              )}
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

              {/* **A rule between lanes, and only where there is more than one.**
                  Two cards 8px apart read as one wide card with a seam in it; a
                  line says they are two. It runs the whole height because a lane
                  is a lane all day, not only where a booking happens to sit. */}
              {Array.from({ length: laneCount - 1 }, (_, index) => (
                <div
                  key={`lane-${index}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 w-px bg-line"
                  style={{ left: (index + 1) * laneWidth }}
                />
              ))}

              {closed.map((range) => {
                const height = ((range.to - range.from) / 60) * HOUR_HEIGHT
                // **A day off and a break are named; the hours before opening are
                // not.** The first two are facts about the business and the hatch
                // alone leaves you guessing which of them this is — that is what
                // made the lunch hour unreadable. The stretch before 10:00 is not
                // a fact, it is simply outside the day, and writing "closed"
                // across the top of the column would be the grid telling you what
                // it has already shown you.
                const label =
                  range.kind === 'off'
                    ? t('appointments.dayOff')
                    : range.kind === 'break'
                      ? t('appointments.break')
                      : null

                return (
                  <div
                    key={`${range.kind}-${range.from}`}
                    className="pointer-events-none absolute inset-x-0 overflow-hidden"
                    style={{
                      top: ((range.from - WINDOW_FROM) / 60) * HOUR_HEIGHT,
                      height,
                      backgroundImage: HATCH,
                    }}
                  >
                    {/* Centred down the block rather than pinned to its top: a
                        word at the top edge belongs to the hour rule above it,
                        where one in the middle belongs to the span, which is the
                        thing being named. Hidden on a short span — a word in a
                        quarter-hour block is a word clipped by its own box. */}
                    {label && height >= 28 && (
                      <span className="absolute inset-y-0 left-2 flex items-center gap-1.5 text-[12px] text-muted">
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted"
                        />
                        {label}
                      </span>
                    )}
                  </div>
                )
              })}

              {blocks.map((block) => (
                <DayBlock
                  key={block.id}
                  block={block}
                  laneWidth={laneWidth}
                  services={services}
                  week={week}
                  timeZone={timeZone}
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
                  {/* No dot at the head any more: the pill in the gutter is the
                      head, and a second mark two pixels from it was the same
                      statement made twice. */}
                  <span className="h-px flex-1 bg-now" />
                </div>
              )}
            </div>
          </m.div>
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
 * A third of the column wide — see `VISIBLE_LANES`. Single tap opens the
 * *detail*, not the editor: the grid's double click exists because a single one
 * is being kept back for selecting a booking, and there is no selection on a
 * phone to keep it back for — but a tap is also the lightest gesture there is,
 * so what it opens has to be the thing you can read rather than the thing you
 * can change. See `BookingDetail`.
 */
function DayBlock({ block, laneWidth, services, week, timeZone, onSaved }) {
  const [open, setOpen] = useState(false)
  const top = ((block.start - WINDOW_FROM) / 60) * HOUR_HEIGHT
  const height = Math.max(((endOf(block) - block.start) / 60) * HOUR_HEIGHT, 34)
  const cancelled = block.status === 'cancelled'

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        // **The booking cuts itself out of the hatch**, the same way the
        // desktop grid's cards do: a 3px ring in the column's own fill, so a
        // card written over a break or a day off has the stripes stopping a
        // little short of it and carrying on beyond. Running the hatch into the
        // card's edge made the two read as one striped block with a rectangle
        // punched out, rather than as a booking sitting *on* a closed hour.
        //
        // `--column-bg` is published by the grid above. Here there is only ever
        // one column and no selected-day tint, so it is the page's ground — but
        // it is read through the variable anyway, or the two screens would
        // answer the same question in two different ways.
        className={`absolute flex flex-col gap-0.5 overflow-hidden rounded-lg bg-surface-card px-2.5 py-1.5 text-left shadow-[0_0_0_3px_var(--column-bg)] outline-none transition-transform duration-150 ease-out active:scale-[0.98] ${
          block.open
            ? // No end, so no bottom edge — the drawn length is `OPEN_MINUTES`
              // and nobody stated it. See the same mask on the desktop grid.
              '[mask-image:linear-gradient(to_bottom,#000_calc(100%-12px),transparent)]'
            : ''
        } ${cancelled ? 'opacity-45' : ''}`}
        style={{
          top,
          height,
          // Fixed lanes, not a share of the column — see `VISIBLE_LANES`. A
          // booking is a third of the screen whether it is alone at that hour
          // or one of four.
          left: block.lane * laneWidth + LANE_INSET,
          width: Math.max(laneWidth - LANE_GAP, 0),
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
    </BookingDetail>
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
