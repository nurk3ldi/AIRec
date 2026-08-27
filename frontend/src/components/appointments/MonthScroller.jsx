import { useEffect, useRef, useState } from 'react'
import {
  dayKey,
  monthGrid,
  monthIndex,
  monthLabel,
  sameDay,
  weekdayLabels,
} from '../../lib/dates'
import { useT } from '../../lib/i18n'
import { CONTROLS_HEIGHT } from './grid'

/**
 * The whole calendar on a phone: months stacked and scrolled through, not
 * stepped between.
 *
 * **A different control from `MonthCalendar`, deliberately.** That one is a
 * 300px card with two arrows, which is the right shape beside a timetable: it
 * is a *picker* sitting next to the thing it steers. On a phone there is no
 * timetable beside it — the calendar is the screen — and a picker that shows
 * one month at a time makes "is the 3rd of next month free" into two taps and a
 * wait. Scrolling is what a phone does, so the months are laid end to end and
 * you fall through them.
 *
 * **The month's name is said twice, at two sizes, and neither repeats the
 * other.** The big one is fixed above the grid and answers "where am I" — it
 * never travels and never scrolls away, it simply *changes* as a new month
 * reaches the top. The small ones live in the flow and answer "where does the
 * next one begin", which is a different question and belongs where the boundary
 * actually is. 28 against 17: two steps apart, which the type scale asks for,
 * since adjacent sizes side by side read as a mistake.
 *
 * The first month in the run carries no small heading — there is no boundary
 * above it to mark, and the big one is already naming it.
 *
 * **A year, not an infinite list.** `MONTHS_BACK` / `MONTHS_FORWARD` bound it,
 * because an endless one needs a windowing scheme to stay cheap and nobody
 * books a haircut in 2031. Thirteen months of 42 cells is 546 elements, which
 * renders in one frame and scrolls without any of that machinery.
 *
 * **The days carry marks now, and the fetch is what made that honest.** Dots
 * over a week's worth of data would have appeared on seven days and nowhere
 * else — a calendar that looks broken rather than one that looks empty — so the
 * page reads the whole visible month and `marked` is the answer for exactly
 * that range. Months outside it carry no marks, which is why the page refetches
 * as the selection moves.
 */

// One behind so the month you are in is not against the top edge, and a year
// ahead, which is further than anyone books.
const MONTHS_BACK = 1
const MONTHS_FORWARD = 11


export default function MonthScroller({
  value,
  onChange,
  controls,
  // Day keys with something booked on them. Absent means no marks — a caller
  // that has not fetched a wide enough range should show none rather than
  // showing an empty month as though it were empty.
  marked,
  className = '',
}) {
  const t = useT()
  const today = new Date()
  const selected = value ?? today

  const first = new Date(today.getFullYear(), today.getMonth() - MONTHS_BACK, 1)
  const months = Array.from(
    { length: MONTHS_BACK + 1 + MONTHS_FORWARD },
    (_, index) => new Date(first.getFullYear(), first.getMonth() + index, 1),
  )

  const scroller = useRef(null)
  const blocks = useRef([])
  // Which month the big heading names. It starts on the selection because that
  // is the month the list opens at — see the effect below — so the two agree on
  // the first frame instead of the heading correcting itself after it.
  const [top, setTop] = useState(() => monthIndex(selected))

  /**
   * Which month is at the top of the scroll box, read on every scroll.
   *
   * **From `offsetTop` rather than an `IntersectionObserver`.** The observer
   * answers "is this on screen", which is not the question: with two months
   * visible at once both are, and the one that matters is the one whose weeks
   * the top edge is currently in. That is a comparison against `scrollTop`, and
   * thirteen of them costs less than the observer's own bookkeeping.
   *
   * `+ 1` so a month sitting exactly on the edge counts as arrived rather than
   * flickering between itself and the one above it on sub-pixel scrolling.
   *
   * **The scroll box has to be `relative` for any of this to be true.**
   * `offsetTop` is measured from the nearest *positioned* ancestor, not from
   * the nearest scrolling one — so without it the blocks were reported against
   * something further up the page and every offset was too large by the height
   * of everything above the grid. The heading named the month before the one on
   * screen, which is exactly the size of that error.
   */
  const trackTop = () => {
    const box = scroller.current
    if (!box) return

    let found = 0
    blocks.current.forEach((node, index) => {
      if (node && node.offsetTop <= box.scrollTop + 1) found = index
    })
    const next = monthIndex(months[found])
    setTop((was) => (was === next ? was : next))
  }

  /**
   * Open on the month in play, without animating there.
   *
   * `scrollIntoView` rather than arithmetic on `scrollTop`: the blocks are not
   * all the same height — the first one has no heading — so a computed offset
   * would be right for some and wrong for the rest.
   *
   * Once per mount, and instant: a calendar that slides on open is one you have
   * to wait for before you can read it. Tapping a day in December must not haul
   * the list back to August either — which is what the ref guards, rather than
   * an empty dependency list: `months` is a fresh array every render, so the
   * honest list is the full one and the ref is what makes it happen once.
   */
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    const index = months.findIndex(
      (month) => monthIndex(month) === monthIndex(selected),
    )
    blocks.current[index < 0 ? MONTHS_BACK : index]?.scrollIntoView({
      block: 'start',
    })
    opened.current = true
  }, [months, selected])

  const letters = weekdayLabels()
  const heading =
    months.find((month) => monthIndex(month) === top) ?? selected

  return (
    <div
      className={`flex flex-col ${className}`}
      aria-label={t('nav.appointments')}
    >
      {/* The room is this component's — it is what the calendar lays itself
          out around — but what goes in it is not: the caller has the services,
          the week and the zone the controls need, where this only knows about
          months. The controls carry the height themselves, so what is left here
          is the empty case. See `CONTROLS_HEIGHT`. */}
      {controls ?? (
        <div style={{ height: CONTROLS_HEIGHT }} className="shrink-0" />
      )}

      {/* **Fixed, and it changes rather than travelling.** Every month used to
          carry its own `sticky` heading, so an arriving month pushed the
          departing one up and off the screen — a piece of motion that says
          "this label is leaving" about a label that is not going anywhere. One
          heading in one place, swapping its text, says the same thing without
          moving: what changed is the month, not where its name lives. */}
      <h2
        className="shrink-0 px-4 pb-2 font-display text-[28px] font-bold tracking-[-0.02em] text-ink"
        aria-live="polite"
      >
        {monthLabel(heading)}
      </h2>

      {/* One row for the whole calendar rather than one per month: the letters
          do not change from August to September, and a copy above every grid is
          the same seven characters printed thirteen times. */}
      <div className="grid shrink-0 grid-cols-7 border-b border-line px-2 pb-2">
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

      <div
        ref={scroller}
        onScroll={trackTop}
        // `overscroll-contain`, so reaching the end of a year does not hand the
        // scroll to the page behind — which on this screen would be a bounce
        // with nothing under it, since the page itself never scrolls.
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {months.map((month, index) => (
          <div
            key={monthIndex(month)}
            ref={(node) => {
              blocks.current[index] = node
            }}
          >
            {index > 0 && (
              <h3 className="px-4 pt-5 pb-2 font-display text-[17px] font-semibold text-ink">
                {monthLabel(month)}
              </h3>
            )}

            <div className="grid grid-cols-7 px-2">
              {monthGrid(month).map((day) => {
                // The 42-cell grid always spills into the months either side —
                // that is what keeps every month six rows tall. Those days
                // belong to their own month's block, so here they are blank
                // space rather than dimmed numbers: a stacked run would
                // otherwise show the 1st of September twice, once at the foot
                // of August and once at its own head.
                if (day.getMonth() !== month.getMonth())
                  return <span key={dayKey(day)} className="h-12" />

                const isToday = sameDay(day, today)
                const isSelected = sameDay(day, selected)
                const weekend = day.getDay() === 0 || day.getDay() === 6

                return (
                  <button
                    key={dayKey(day)}
                    type="button"
                    onClick={() => onChange?.(day)}
                    aria-pressed={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={day.toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                    // The press state, on the button rather than on the circle
                    // inside it: the circle animates its own fill, and two
                    // owners of one transition is one of them lost.
                    className="relative grid h-12 place-items-center outline-none transition-transform duration-[160ms] ease-out active:scale-[0.95]"
                  >
                    {/* **The mark is a circle behind the number, not a change
                        of colour on it.** A phone is read at arm's length and
                        in sunlight, where two greys are one grey — a filled
                        shape survives both. 36px, the square every other
                        control on this screen is.

                        `--now` for the selection and `surface-chip` for today,
                        the same two marks the desktop calendar uses: they are
                        the same statement said on two screens. */}
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-full font-display text-[17px] transition-colors ${
                        isSelected
                          ? 'bg-now font-semibold text-white'
                          : isToday
                            ? 'bg-surface-chip font-semibold text-ink'
                            : weekend
                              ? 'font-medium text-muted'
                              : 'font-medium text-ink'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {/* **Under the circle, not inside it.** The circle is
                        already saying which day is chosen and which is today,
                        and the button's 48px leaves exactly the room for a mark
                        below it — so unlike the desktop calendar's, this one
                        never lands on the orange and needs no second colour. */}
                    {marked?.has(dayKey(day)) && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-muted"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
