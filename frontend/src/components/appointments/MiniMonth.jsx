import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import {
  DAY_LETTERS,
  MONTHS,
  monthIndex,
  sameDay,
} from '../../lib/dates'

// Six rows, always. A month needs five or six depending on which weekday it
// starts on, and letting that vary would move everything below the calendar
// up and down as you browse.
const CELLS = 6 * 7

function buildGrid(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  // Back up to the Monday on or before the 1st.
  start.setDate(1 - ((first.getDay() + 6) % 7))

  return Array.from({ length: CELLS }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

/**
 * The month picker beside the calendar.
 *
 * Monday first, not Sunday — that is how a week is read here, and the working
 * hours this calendar is built on are numbered the same way. Keeping the two
 * apart would mean a column of Sundays sitting under a schedule that treats
 * Sunday as the last day of the week.
 *
 * `marked` is the set of `YYYY-MM-DD` strings that have bookings; a day in it
 * gets a dot. The space for that dot is reserved on every cell, so days don't
 * shift by a pixel as the month's bookings load.
 */
export default function MiniMonth({ date, onDateChange, marked }) {
  // Which month is on screen, separate from which day is selected: browsing
  // ahead to check a date should not change what the calendar is showing.
  const [cursor, setCursor] = useState(() => monthIndex(date))

  // …but picking a day elsewhere — the toolbar's arrows, «Сегодня» — should
  // bring this back to the month that day is in.
  useEffect(() => {
    setCursor(monthIndex(date))
  }, [date])

  const year = Math.floor(cursor / 12)
  const month = cursor % 12
  const today = new Date()

  return (
    // No card of its own: it is a panel inside the calendar's card, marked off
    // by the hairline beside it rather than by a second white surface.
    <div className="w-[300px] shrink-0 p-6">
      <div className="flex items-center justify-between">
        <ArrowButton
          icon={ArrowLeft01Icon}
          label="Предыдущий месяц"
          onClick={() => setCursor(cursor - 1)}
        />
        <p className="text-[15px] font-semibold text-[#171215]">
          {MONTHS[month]} {year}
        </p>
        <ArrowButton
          icon={ArrowRight01Icon}
          label="Следующий месяц"
          onClick={() => setCursor(cursor + 1)}
        />
      </div>

      <div className="mt-5 grid grid-cols-7 gap-y-1">
        {DAY_LETTERS.map((letter) => (
          <span
            key={letter}
            className="pb-2 text-center text-[13px] font-medium text-[#171215]"
          >
            {letter}
          </span>
        ))}

        {buildGrid(year, month).map((day) => {
          const outside = day.getMonth() !== month
          const selected = sameDay(day, date)
          const isToday = sameDay(day, today)
          const hasBookings = marked?.has(dayKey(day))

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDateChange(day)}
              aria-current={selected ? 'date' : undefined}
              className="flex flex-col items-center gap-1 outline-none"
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-[14px] transition-colors ${
                  selected
                    ? 'bg-[#3248F2] font-medium text-white'
                    : isToday
                      ? 'bg-[#999999]/15 font-medium text-[#171215]'
                      : outside
                        ? 'text-[#999999]/70 hover:bg-[#F6F8FA]'
                        : 'text-[#171215] hover:bg-[#F6F8FA]'
                }`}
              >
                {day.getDate()}
              </span>
              {/* Always rendered, coloured only when it means something — the
                  row height then never depends on whether that day is busy. */}
              <span
                className={`h-1 w-1 rounded-full ${
                  hasBookings ? 'bg-[#171215]' : 'bg-transparent'
                }`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** `YYYY-MM-DD` in local time — `toISOString` would shift the day in any zone
 *  east of UTC, which is every zone this product runs in. */
function dayKey(day) {
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${date}`
}

function ArrowButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-lg text-[#171215] outline-none transition-colors hover:bg-[#F6F8FA]"
    >
      <HugeiconsIcon
        icon={icon}
        size={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
    </button>
  )
}
