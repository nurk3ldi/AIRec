import { useEffect, useRef, useState } from 'react'
import AppointmentBlock from './AppointmentBlock'
import DaysHeader from './DaysHeader'
import { layoutDay } from '../../lib/appointments'
import { dayKey, sameDay, weekDays } from '../../lib/dates'

// 96px an hour — 24px per quarter, which is the smallest a 15-minute booking
// can be and still hold a line of text. The whole day is 2304px, so the grid
// scrolls; that is the trade for not deciding on the owner's behalf which
// hours are worth showing.
const HOUR_HEIGHT = 96

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
// A hair of space either side, so two neighbouring bookings don't share an edge
// and read as one block.
const COLUMN_INSET = 4

export default function TimeGrid({
  date,
  view,
  onDateChange,
  appointments,
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
      <div className="sticky top-0 z-10 bg-white">
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

            return (
              <div
                key={key}
                className={`relative ${index === 0 ? '' : 'border-l border-[#999999]/15'}`}
              >
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
                      // A minimum, so a fifteen-minute booking is still a
                      // thing you can see and click rather than a line.
                      height: Math.max(
                        ((block.end - block.start) / 60) * HOUR_HEIGHT,
                        24
                      ),
                      // Overlapping bookings split the column between them.
                      left: `calc(${(block.lane / block.lanes) * 100}% + ${COLUMN_INSET}px)`,
                      width: `calc(${100 / block.lanes}% - ${COLUMN_INSET * 2}px)`,
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
            makes a half-empty afternoon obvious at a glance. */}
        {showsToday && (
          <div
            className="pointer-events-none absolute right-0 left-0 flex -translate-y-1/2 items-center"
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
