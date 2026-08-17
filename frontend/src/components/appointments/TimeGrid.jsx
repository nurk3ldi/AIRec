import { useEffect, useRef, useState } from 'react'
import AppointmentBlock from './AppointmentBlock'
import DaysHeader from './DaysHeader'
import { layoutDay } from '../../lib/appointments'
import { closedRanges } from '../../lib/schedule'
import { dayKey, sameDay, weekDays } from '../../lib/dates'

// 256px an hour — 64px per quarter, sized so that even the shortest bookable
// service, fifteen minutes, still shows all three of its lines: the client, the
// time, and the service with its price. Anything tighter and the shortest
// bookings become bars you have to click to read.
//
// The cost is real: a whole day is 6144px and the grid scrolls a lot. That is
// the trade for every booking being legible where it sits, rather than only the
// long ones.
const HOUR_HEIGHT = 256

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

// Where the grid opens on a day that isn't today. Midnight is technically the
// top of the day and practically never what anyone wants to look at first.
const OPENS_AT_HOUR = 8

// The padding above the first hour line, so midnight's label isn't clipped by
// the top of the scroll area. Every absolute position below is measured from
// the same origin, which is why it's a constant rather than a class.
const TOP_PADDING = 8

const minutesToday = (moment) => moment.getHours() * 60 + moment.getMinutes()

/**
 * The calendar body: the strip of day names, and under it a gutter of times
 * with one column per day, ruled off at every hour.
 *
 * All twenty-four hours are rendered rather than only the working ones. A
 * business can open at 06:00 or run past midnight, and a grid that quietly
 * omitted those hours would make a booking in them impossible to see — worse,
 * impossible to notice was missing.
 *
 * The day header is rendered *inside* this scroll box, pinned with `sticky`,
 * rather than sitting above it. Outside, it would be laid out across the full
 * width while the grid below lost ~15px to the scrollbar, and every column
 * boundary would miss its heading by that much. Sharing one scrolling box makes
 * them share one content width, so they cannot drift apart.
 */
export default function TimeGrid({
  date,
  view,
  onDateChange,
  appointments,
  week,
  selectedId,
  onSelect,
}) {
  const days = view === 'week' ? weekDays(date) : [date]
  const scroller = useRef(null)

  // Ticks so the line moves on its own. Half a minute is fine: the line is a
  // rough "you are here", and a second-by-second re-render would cost more
  // than the precision is worth.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const showsToday = days.some((day) => sameDay(day, now))
  const nowOffset = TOP_PADDING + (minutesToday(now) / 60) * HOUR_HEIGHT

  useEffect(() => {
    if (!scroller.current) return
    // Open where the answer is: on today that's the current hour, with a little
    // of the past above it for context; on any other day, the morning.
    scroller.current.scrollTop = showsToday
      ? Math.max(nowOffset - HOUR_HEIGHT, 0)
      : TOP_PADDING + OPENS_AT_HOUR * HOUR_HEIGHT
    // Deliberately only on mount and when the shown range changes — re-running
    // it every tick would yank the grid back under anyone who scrolled away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showsToday, date, view])

  return (
    // A neutral scrollbar, not the accent one the option pickers use. Those
    // are short menus where the bar is the only thing on screen; here it runs
    // beside the day itself, and the accent is needed for what is *in* the
    // calendar — a coloured scrollbar would be the loudest thing on the page
    // and would be saying nothing.
    <div
      ref={scroller}
      className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:#999999_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#999999]/45 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2"
    >
      {/* Above the bookings, which carry `z-10` of their own so they can cut
          the "now" line. Sharing that level left the two to be separated by
          document order alone, and the grid comes second — so a booking in the
          first hours of the day scrolled *over* the day names instead of under
          them. */}
      <div className="sticky top-0 z-20 bg-white">
        <DaysHeader date={date} view={view} onDateChange={onDateChange} />
      </div>

      <div className="relative flex" style={{ paddingTop: TOP_PADDING }}>
        {/* Same width as the header's arrow cells, so the day columns below
            line up with the day names above them. */}
        <div className="w-[72px] shrink-0 border-r border-[#999999]/15">
          {HOURS.map((hour) => (
            <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
              {/* Straddling the line rather than sitting under it: the label
                  names the moment the line marks, not the hour beneath it. */}
              <span className="absolute -top-2 left-0 w-full text-center text-[11px] text-[#999999]">
                {String(hour).padStart(2, '0')}:00
              </span>
            </div>
          ))}
        </div>

        <div
          className="grid flex-1"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {days.map((day, index) => {
            const key = dayKey(day)
            const blocks = layoutDay(
              (appointments ?? []).filter((block) => block.day === key)
            )
            // The API's weekday starts on Monday; `getDay()` starts on Sunday.
            const hours = (week ?? []).find(
              (row) => row.weekday === (day.getDay() + 6) % 7
            )

            return (
              <div
                key={key}
                className={`relative ${index === 0 ? '' : 'border-l border-[#999999]/15'}`}
              >
                {/* Closed time, washed out: before opening, the lunch break and
                    after closing — a whole day of it when the business is shut.
                    Translucent rather than solid so the hour lines still read
                    through it; a closed hour is still an hour, and losing the
                    ruler inside it would make the column hard to read against
                    the one beside it.

                    A very faint tint of the accent rather than neutral grey.
                    It is the only other hue in the palette, and at 7% it sits
                    below the 10–15% band the product uses for real data — so it
                    reads as a shade of the surface, not as something being
                    pointed at. Grey worked but made closed time look like a
                    disabled control rather than a part of the day.

                    Drawn before anything else in the column and left at the
                    default level, so bookings (`z-10`) and the "now" line sit on
                    top of it. A booking inside closed time is not an error to
                    hide — it is exactly what the owner needs to see. */}
                {closedRanges(hours).map(([from, to]) => (
                  <div
                    key={from}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bg-[#3248F2]/[0.07]"
                    style={{
                      top: (from / 60) * HOUR_HEIGHT,
                      height: ((to - from) / 60) * HOUR_HEIGHT,
                    }}
                  />
                ))}

                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="border-t border-[#999999]/15 first:border-t-0"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {blocks.map((block) => (
                  <AppointmentBlock
                    key={block.id}
                    selected={block.id === selectedId}
                    onSelect={onSelect}
                    block={{
                      ...block,
                      top: (block.start / 60) * HOUR_HEIGHT,
                      // The floor never binds at the current row height; it is
                      // here so that shrinking `HOUR_HEIGHT` can never produce
                      // a block below the 44px minimum hit target.
                      height: Math.max(
                        ((block.end - block.start) / 60) * HOUR_HEIGHT,
                        44
                      ),
                      // The full width of its column, flush with the dividers
                      // either side — no inset, so the block lines up with the
                      // day it belongs to rather than floating inside it.
                      // Overlapping bookings split that width between them.
                      left: `${(block.lane / block.lanes) * 100}%`,
                      width: `${100 / block.lanes}%`,
                    }}
                  />
                ))}
              </div>
            )
          })}
        </div>

        {/* Mirrors the header's right-hand arrow cell, for the same reason the
            gutter mirrors the left one. */}
        <div className="w-[72px] shrink-0 border-l border-[#999999]/15" />

        {/* Drawn across every column, not just today's. In week view it reads
            as a ruler — "this is where the day has got to" — which is what
            makes a half-empty afternoon obvious at a glance.

            It sits *under* the bookings (`z-0` against their `z-10`), so a
            block's own white body interrupts it and the line picks up again
            past the block's edge. Drawn over the top, it would cut every
            booking it crossed in half. */}
        {showsToday && (
          <div
            className="pointer-events-none absolute right-0 left-0 z-0 flex -translate-y-1/2 items-center"
            style={{ top: nowOffset }}
          >
            <span className="shrink-0 rounded-md bg-[#171215] px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
              {String(now.getHours()).padStart(2, '0')}:
              {String(now.getMinutes()).padStart(2, '0')}
            </span>
            <span className="h-px flex-1 bg-[#171215]" />
          </div>
        )}
      </div>
    </div>
  )
}
