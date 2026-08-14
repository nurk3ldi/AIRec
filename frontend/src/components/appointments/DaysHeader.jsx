import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import {
  DAY_NAMES,
  MONTHS_ABBR,
  sameDay,
  shiftDate,
  weekDays,
} from '../../lib/dates'

/**
 * The strip of days above the time grid.
 *
 * The same component serves both views — a week is seven columns, a day is one.
 * They are the same thing at two widths, and splitting them into two components
 * would mean two places to keep the selected-day treatment in step.
 *
 * Each column is a button: in week view, clicking a heading is the quickest way
 * to say "show me that day", and it keeps the toolbar's date badge honest about
 * which day the grid is centred on.
 */
export default function DaysHeader({ date, view, onDateChange }) {
  const days = view === 'week' ? weekDays(date) : [date]

  return (
    <div className="flex items-stretch border-b border-[#999999]/15">
      <ArrowCell
        icon={ArrowLeft01Icon}
        label={view === 'week' ? 'Предыдущая неделя' : 'Предыдущий день'}
        onClick={() => onDateChange(shiftDate(date, view, -1))}
        className="border-r border-[#999999]/15"
      />

      <div
        className="grid flex-1"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((day, index) => {
          const selected = sameDay(day, date)

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDateChange(day)}
              aria-current={selected ? 'date' : undefined}
              // The first column skips its own line — the arrow beside it
              // already draws one, and two would sit a pixel apart.
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-4 outline-none transition-colors hover:bg-[#F6F8FA] ${
                index === 0 ? '' : 'border-l border-[#999999]/15'
              }`}
            >
              {/* Weight, not colour, marks the day being looked at. A tinted
                  column would put a second background behind the bookings that
                  sit in it, and those carry their own tints already. */}
              <span
                className={`truncate text-[14px] ${
                  selected
                    ? 'font-semibold text-[#171215]'
                    : 'font-medium text-[#171215]/70'
                }`}
              >
                {DAY_NAMES[day.getDay()]}
              </span>
              <span
                className={`truncate text-[12px] ${
                  selected ? 'font-medium text-[#171215]' : 'text-[#999999]'
                }`}
              >
                {day.getDate()} {MONTHS_ABBR[day.getMonth()]} {day.getFullYear()}
              </span>
            </button>
          )
        })}
      </div>

      <ArrowCell
        icon={ArrowRight01Icon}
        label={view === 'week' ? 'Следующая неделя' : 'Следующий день'}
        onClick={() => onDateChange(shiftDate(date, view, 1))}
        className="border-l border-[#999999]/15"
      />
    </div>
  )
}

function ArrowCell({ icon, label, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // Wider than the arrow needs, so the line beside it sits well clear of
      // the glyph instead of crowding it. The line itself stays as faint as
      // every other divider in the header.
      className={`grid w-[72px] shrink-0 place-items-center text-[#171215] outline-none transition-colors hover:bg-[#F6F8FA] ${className}`}
    >
      <HugeiconsIcon
        icon={icon}
        size={18}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </button>
  )
}
