import { useEffect, useRef } from 'react'
import {
  dayKey,
  monthGrid,
  monthIndex,
  monthLabel,
  sameDay,
  weekdayLabels,
} from '../../lib/dates'
import { useT } from '../../lib/i18n'

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
 * The shape is the one every phone calendar has settled on and there is no
 * reason to be different: the month's name, the seven letters, then the weeks,
 * with a rule under each so the eye can travel along a row without drifting.
 *
 * **A year, not an infinite list.** `MONTHS_BACK` / `MONTHS_FORWARD` bound it,
 * because an endless one needs a windowing scheme to stay cheap and nobody
 * books a haircut in 2031. Thirteen months of 42 cells is 546 elements, which
 * renders in one frame and scrolls without any of that machinery.
 *
 * **There are no markers on the days yet, and that is not an oversight.** The
 * page fetches one week of bookings at a time, so dots here would appear on
 * seven days and nowhere else — a calendar that looks broken rather than one
 * that looks empty. They arrive together with a wider fetch.
 */

// One behind so the month you are in is not against the top edge, and a year
// ahead, which is further than anyone books.
const MONTHS_BACK = 1
const MONTHS_FORWARD = 11

export default function MonthScroller({ value, onChange, className = '' }) {
  const t = useT()
  const today = new Date()
  const selected = value ?? today

  const first = new Date(today.getFullYear(), today.getMonth() - MONTHS_BACK, 1)
  const months = Array.from(
    { length: MONTHS_BACK + 1 + MONTHS_FORWARD },
    (_, index) => new Date(first.getFullYear(), first.getMonth() + index, 1),
  )

  /**
   * Open on the month in play, without animating there.
   *
   * `scrollIntoView` rather than arithmetic on `scrollTop`: the months are not
   * all the same height — a 42-cell grid is, but the headings are not always
   * one line — so a computed offset would be right for some months and wrong
   * for the rest.
   *
   * Once per mount, and instant: a calendar that slides on open is a calendar
   * you have to wait for before you can read it.
   */
  const current = useRef(null)
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'start' })
    // Deliberately empty: this is where the calendar *opens*, not something
    // that should chase the selection afterwards. Tapping a day in December
    // must not haul the list back to August.
  }, [])

  const letters = weekdayLabels()

  return (
    <section
      // `overscroll-contain`, so reaching the end of a year does not hand the
      // scroll to the page behind — which on this screen would be a bounce with
      // nothing under it, since the page itself never scrolls.
      className={`overflow-y-auto overscroll-contain ${className}`}
      aria-label={t('nav.appointments')}
    >
      {months.map((month) => (
        <div
          key={monthIndex(month)}
          ref={
            monthIndex(month) === monthIndex(selected) ? current : undefined
          }
          className="pb-6"
        >
          {/* Sticky, because a run of months with no anchor is a wall of
              numbers: scroll far enough and the only thing that says which
              month you are in has left the screen. Opaque `bg-ground` for the
              same reason the timetable's day strip is — the rows pass
              underneath it. */}
          <div className="sticky top-0 z-10 bg-ground pt-4 pb-2">
            <h2 className="px-4 font-display text-[26px] font-bold tracking-[-0.02em] text-ink">
              {monthLabel(month)}
            </h2>

            {/* The seven letters, from `Intl` so they follow the language. */}
            <div className="mt-2 grid grid-cols-7 border-b border-line px-2 pb-2">
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
          </div>

          <div className="grid grid-cols-7 px-2">
            {monthGrid(month).map((day) => {
              // The 42-cell grid always spills into the months either side —
              // that is what keeps every month six rows tall. Those days belong
              // to their own month's block, so here they are drawn as blank
              // space rather than as dimmed numbers: a run of stacked months
              // would otherwise show the 1st of September twice, once at the
              // foot of August and once at its own head.
              const outside = day.getMonth() !== month.getMonth()
              if (outside) return <span key={dayKey(day)} className="h-12" />

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
                  className="grid h-12 place-items-center outline-none"
                >
                  {/* **The mark is a circle behind the number, not a change of
                      colour on it.** A phone is read at arm's length and in
                      sunlight, where two greys are one grey — a filled shape
                      survives both. 36px, the square every other control on
                      this screen is.

                      `--now` for the selection, the same orange the desktop
                      calendar marks the day in play with; today when it is not
                      the selection takes the chip grey, exactly as there. The
                      two agree because they are the same statement said on two
                      screens. */}
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
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
