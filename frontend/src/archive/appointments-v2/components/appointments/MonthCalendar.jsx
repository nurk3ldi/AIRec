import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import BookingPanel from './BookingPanel'
import CalendarSearch from './CalendarSearch'
import { bookingColor, byStart } from '../../lib/appointments'
import { isDayOff } from '../../lib/schedule'
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import {
  DAY_NAMES,
  MONTHS,
  MONTHS_OF,
  dayKey,
  monthGrid,
  sameDay,
  sameMonth,
  shiftMonth,
} from '../../lib/dates'

/**
 * The month, as the page rather than as a picker.
 *
 * Ported from 21st.dev's «Fullscreen Calendar» (@ahmedmayara) — its layout is
 * the one this screen wanted: a header that steps months, a weekday strip, and
 * a grid of cells tall enough to hold what happens on each day rather than just
 * its number. Ported and not installed: the original is TypeScript on shadcn's
 * `cn`/Button/Separator and `date-fns`, and taking it whole would have brought a
 * second token system, a path alias and a TS toolchain into a plain-JSX project
 * to save arithmetic this repo already has in `lib/dates.js`.
 *
 * The week starts on **Monday**, unlike the reference, because everything else
 * in the product does — the backend's `weekday` is 0 = Monday, and a calendar
 * that disagreed with the working-hours card would be the one place in the app
 * where Sunday moved.
 *
 * The grid is always **7 × 6**. The reference shows five rows because September
 * 2025 happens to fit in five; a 31-day month starting on a weekend needs six,
 * and a grid that grew a row on those months would resize every cell under the
 * pointer four times a year. Six always is the one count that fits every month
 * without ever changing shape.
 *
 * A cell lists who is coming, not what was booked: at a glance across a month
 * the owner is looking for a person, and the service is one click away in the
 * panel beside it. The names are plain text inside the cell's own button —
 * clicking a day selects it, and the bookings are clickable in the panel, since
 * a button nested inside a button is invalid HTML and unreachable by keyboard.
 */

// The two that come first, and a count for the rest. Two names is enough to
// recognise a day; past that what matters is only how much more there is, and
// the count says that in one glyph instead of three more lines.
const NAMES_SHOWN = 2

// The booking panel is laid out as a grid item, so its size is stated in day
// cells and comes out exact — internal gaps included — at any window width.
const PANEL_COLS = 3
const GRID_COLS = 7
const GRID_ROWS = 6

// The fewest rows the form is given — now the whole grid.
//
// At the reference's spacing six labelled rows come to roughly 580px, and five
// day-rows are about 530px on an ordinary window: the form would have scrolled.
// Giving it the full height is what buys the spacing, and the cost is real and
// deliberate — the panel can no longer start at the day's own row the way the
// reference does, because there is no row left to start from.
const MIN_PANEL_ROWS = 6

// Spelled out because Tailwind only ships the classes it can see in the source.
const COL_START = [
  '',
  'col-start-1',
  'col-start-2',
  'col-start-3',
  'col-start-4',
  'col-start-5',
]
const ROW_START = ['', 'row-start-1']
const ROW_SPAN = ['', '', '', '', '', '', 'row-span-6']

/**
 * Where the panel sits next to the day it belongs to.
 *
 * Three rules, the first two from the reference:
 *
 *  - **Beside the day, never over it.** You are booking *that* day, and
 *    covering it would take away the one cell you were looking at. It opens to
 *    the right where there is room and flips to the left where there isn't.
 *  - **It takes the calendar's full height.** The reference starts its panel at
 *    the day's own row; at the spacing this form is now set in, that would have
 *    left it short enough to scroll, which is the one thing it must not do.
 *  - **Its width is a fraction of three cells; its height is purely its own.**
 *    `self-start` stops the row span stretching it, and no ceiling is put on
 *    that height: a cap would mean the form could be shortened below what it
 *    needs, and the only ways out of that are a scrollbar or a clipped Save
 *    button. The span reaches the bottom of the grid so there is room for it.
 *
 * The width is the three-column span in full, so it scales with the calendar at
 * any window size and lands exactly on cell boundaries — internal gaps
 * included. The panel still hugs whichever of its edges faces the day, which
 * matters if it is ever narrowed again.
 */
function placePanel(index) {
  const column = (index % 7) + 1
  const row = Math.floor(index / 7) + 1

  const opensRight = column + PANEL_COLS <= GRID_COLS
  const startColumn = opensRight ? column + 1 : Math.max(column - PANEL_COLS, 1)

  const startRow = Math.min(row, GRID_ROWS - MIN_PANEL_ROWS + 1)
  const span = GRID_ROWS - startRow + 1

  return `${COL_START[startColumn]} ${ROW_START[startRow]} ${ROW_SPAN[span]} col-span-3 w-full ${
    opensRight ? 'justify-self-start' : 'justify-self-end'
  } self-start`
}


// `DAY_NAMES` is indexed by `getDay()`, so Sunday is 0. This is the same list
// read Monday first — one source for the names, one place that reorders them.
const WEEK = [1, 2, 3, 4, 5, 6, 0].map((index) => DAY_NAMES[index])

// Three years back and three forward. Bookings live in the next few weeks, but
// the history reaches back, and a year menu has to stop somewhere — the arrows
// walk past either end for the rare case that it doesn't cover.
const yearsAround = (current) =>
  Array.from({ length: 7 }, (_, index) => current - 3 + index)

export default function MonthCalendar({
  month,
  selected,
  blocks,
  week,
  timeZone,
  search,
  booking,
  onMonthChange,
  onSelect,
  onCreate,
  onBookingClose,
  onBooked,
}) {
  const today = new Date()
  const days = monthGrid(month)

  // Which cell the open panel hangs off. `-1` when the day being booked is not
  // in the month on show, which is what stops the panel appearing in a corner
  // with nothing to do with it after the month is stepped away.
  const anchor = booking
    ? days.findIndex((day) => sameDay(day, booking))
    : -1

  // Grouped once rather than filtered inside each of the forty-two cells, and
  // kept in `byStart` order — the same order the day panel uses, which is what
  // makes a booking the same colour in both.
  const byDay = new Map()
  for (const block of [...(blocks ?? [])].sort(byStart)) {
    const list = byDay.get(block.day)
    if (list) list.push(block)
    else byDay.set(block.day, [block])
  }

  return (
    <div className="flex h-full flex-col">
      {/* The band above the grid pays for itself: the month and its arrows are
          smaller than they were, and the room that frees goes into the gap below
          them rather than back to the rows — so the calendar keeps its height
          and stops crowding its own heading. */}
      <header className="flex shrink-0 items-center justify-between gap-4 pb-7">
        {/* The month and the year are two separate menus, as in the reference,
            not one label. Stepping to the same month three years back is two
            picks here and thirty-six presses of an arrow otherwise — and the
            arrows stay for the ordinary case of "the next one". */}
        {/* Nudged in so the month lines up with the date numbers below it
            rather than with the very edge of the grid. */}
        <div className="flex min-w-0 items-center gap-5 pl-2">
          <Picker
            label={MONTHS[month.getMonth()]}
            ariaLabel="Выбрать месяц"
            options={MONTHS.map((name, index) => ({ value: index, label: name }))}
            value={month.getMonth()}
            onChange={(index) =>
              onMonthChange(new Date(month.getFullYear(), index, 1))
            }
          />
          <Picker
            label={month.getFullYear()}
            ariaLabel="Выбрать год"
            options={yearsAround(today.getFullYear()).map((year) => ({
              value: year,
              label: year,
            }))}
            value={month.getFullYear()}
            onChange={(year) => onMonthChange(new Date(year, month.getMonth(), 1))}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {search && <CalendarSearch {...search} />}
          <Step
            icon={ArrowLeft01Icon}
            label="Предыдущий месяц"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
          />
          <Step
            icon={ArrowRight01Icon}
            label="Следующий месяц"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
          />
        </div>
      </header>

      {/* Its own row above the grid rather than a first row inside it: the
          headings name the columns, they are not seven more days. */}
      {/* Written out in full, as in the reference. `truncate` is the safety
          net: «Понедельник» is the longest word on this screen, and a narrow
          window must clip it rather than push the columns out of line with the
          grid underneath. */}
      <div className="grid shrink-0 grid-cols-7 gap-2 pb-1.5">
        {WEEK.map((name) => (
          <span
            key={name}
            className="truncate px-1 text-[13px] leading-none text-[#999999]"
          >
            {name}
          </span>
        ))}
      </div>

      {/* `min-h-0` is what lets the rows share whatever height is left instead
          of the grid growing past the card and scrolling it. */}
      <div className="relative grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-2">
        {days.map((day, index) => (
          <DayCell
            key={day.getTime()}
            day={day}
            inMonth={sameMonth(day, month)}
            isToday={sameDay(day, today)}
            isSelected={sameDay(day, selected)}
            isAnchor={index === anchor}
            // The API's weekday starts on Monday; `getDay()` starts on Sunday.
            isClosed={isDayOff(
              (week ?? []).find((row) => row.weekday === (day.getDay() + 6) % 7)
            )}
            blocks={byDay.get(dayKey(day))}
            onSelect={onSelect}
            onCreate={onCreate}
          />
        ))}

        {/* A second grid laid exactly over the first — same seven columns, same
            six rows, same gap — carrying nothing but the panel.

            The panel cannot simply be another child of the grid above: an item
            with an explicit `col-start`/`row-start` is placed *before* the
            auto-flowed ones, so the forty-two day cells would flow around it,
            spill past the sixth row, and make the grid grow implicit rows —
            every cell in the month resizing the moment the panel opened. Out
            here it is absolutely positioned, so it takes part in no flow at
            all and the calendar underneath does not move by a pixel.

            `pointer-events-none` on the layer, `auto` on the panel: the days it
            isn't covering stay clickable through it. */}
        {anchor !== -1 && (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-7 grid-rows-6 gap-2">
            <BookingPanel
              date={booking}
              timeZone={timeZone}
              className={`pointer-events-auto ${placePanel(anchor)}`}
              onClose={onBookingClose}
              onSaved={onBooked}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function DayCell({
  day,
  inMonth,
  isToday,
  isSelected,
  isAnchor,
  isClosed,
  blocks,
  onSelect,
  onCreate,
}) {
  const booked = blocks ?? []
  const shown = booked.slice(0, NAMES_SHOWN)
  const hidden = booked.length - shown.length

  // Tiles with air between them rather than a ruled table: a booking sits
  // *inside* a day here, and a shared hairline would make two neighbouring
  // days' contents read as one column. The 8px gap is also what keeps
  // adjacent targets from being tapped by mistake.
  //
  // A faint wash of the accent rather than `#F6F8FA`. The page's grey is two
  // percent away from white, and forty-two tiles whose edges the eye has to
  // hunt for is what made the grid tiring to look at; the same lightness in a
  // cool cast reads immediately and belongs to the palette by construction.
  // It stays under the 10-15% band the product reserves for real data, so the
  // grid is a surface rather than something being pointed at.
  //
  // **One fill for every day**, whatever month it belongs to and whether the
  // business is open. Three shades of the same wash were tried and dropped:
  // the differences were too small to read as meaning anything, so all they
  // did was make the grid look unevenly lit. What those tiles say, they say in
  // text — a muted number for another month, the word «Выходной» for a day off
  // — and text is the part that can actually be read.
  const surface = isSelected
    ? 'bg-[#3248F2]'
    : 'bg-[#3248F2]/[0.06] hover:bg-[#3248F2]/[0.13]'

  const number = isSelected
    ? 'text-white'
    : !inMonth
      ? 'text-[#999999]'
      : isToday
        ? 'text-[#3248F2]'
        : 'text-[#171215]'

  return (
    <button
      type="button"
      onClick={() => onSelect(day)}
      // Double-click books it. The single click still lands first and selects
      // the day, which is the right thing to leave behind either way: the panel
      // beside the calendar is then already showing the day being booked into.
      onDoubleClick={() => onCreate?.(day)}
      aria-pressed={isSelected}
      aria-label={`${DAY_NAMES[day.getDay()]}, ${day.getDate()} ${MONTHS_OF[day.getMonth()]} ${day.getFullYear()}`}
      // The day the open panel belongs to, marked the way the reference marks
      // it — a dashed accent edge. `outline` rather than a border so it costs
      // the cell no interior width and the contents don't shift as it appears.
      //
      // The keyboard ring is a `ring`, not an outline, so it can coexist with
      // that dashed mark instead of one replacing the other — a cell can be
      // both the anchor and the focused element.
      className={`flex min-h-0 flex-col items-stretch rounded-xl p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[#3248F2] ${surface} ${
        isAnchor
          ? 'outline-2 outline-offset-[-2px] outline-dashed outline-[#3248F2]'
          : 'outline-none'
      }`}
    >
      {/* The date and, opposite it, what didn't fit below. The count lives up
          here rather than at the end of the list because it belongs to the day
          as a whole — and in the corner it can be read across a whole month
          without the eye stopping at each cell's contents. */}
      {/* Aligned at the top, not on the baseline: the count is smaller than the
          date, so sharing a baseline dropped it low enough to read as hanging
          off the number rather than sitting in the corner with it. */}
      <span className="flex shrink-0 items-start justify-between gap-1">
        <time
          dateTime={`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`}
          className={`text-[15px] leading-none font-semibold tracking-[-0.01em] ${number}`}
        >
          {day.getDate()}
        </time>

        {hidden > 0 && (
          // Near-black, the same as the date opposite it: the two are both facts
          // about the day rather than one being a note on the other, and in
          // muted grey the count read as an afterthought. Still white on the
          // selected day, where black would not read at all.
          <span
            className={`text-[12px] leading-none font-medium tabular-nums ${
              isSelected ? 'text-white' : 'text-[#171215]'
            }`}
          >
            +{hidden}
          </span>
        )}
      </span>

      {/* Pushed to the bottom of the cell by `mt-auto`, as in the reference:
          the number marks the top of the day and the names sit under it however
          many there are, so a busy day and an empty one share the same skyline.
          `overflow-hidden` is what stops a fourth name pushing the cell taller
          than its row. */}
      <span className="mt-auto flex min-h-0 flex-col gap-1 overflow-hidden pt-2">
        {/* Named only on a day that has nothing else to show — a closed day
            with a booking on it is a working day the hours were changed under,
            and the booking is the more useful thing to read. */}
        {isClosed && !isSelected && booked.length === 0 && (
          <span className="truncate text-[12px] leading-none text-[#999999]">
            Выходной
          </span>
        )}

        {shown.map((block, index) => (
          <span key={block.id} className="flex items-center gap-1.5">
            {/* An inline style, not a class: the colour is chosen at runtime
                and Tailwind can only ship classes it can see written down. */}
            <span
              className="h-3 w-[3px] shrink-0 rounded-full"
              style={{
                backgroundColor: isSelected
                  ? 'rgba(255,255,255,0.7)'
                  : bookingColor(index),
              }}
            />
            <span
              className={`truncate text-[12px] leading-none ${
                isSelected
                  ? 'text-white'
                  : block.status === 'cancelled'
                    ? 'text-[#999999] line-through'
                    : 'text-[#171215]'
              }`}
            >
              {block.client}
            </span>
          </span>
        ))}
      </span>
    </button>
  )
}

/**
 * A label that opens a list — the month, or the year.
 *
 * Radix for the behaviour only, as everywhere else in this project: the focus
 * trap, the outside-click and the Escape handling are the part that is hard to
 * get right, and none of its looks are used.
 */
function Picker({ label, ariaLabel, options, value, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={ariaLabel}
        className="flex min-w-0 items-center gap-1.5 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-[#3248F2]"
      >
        <span className="font-display truncate text-[22px] font-medium tracking-[-0.02em] text-[#171215]">
          {label}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          strokeWidth={2.2}
          className="shrink-0 text-[#999999]"
        />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-30 max-h-[300px] w-[180px] overflow-y-auto rounded-xl border border-[#999999]/25 bg-white p-1.5 shadow-[0_16px_40px_-8px_rgba(23,18,21,0.28)]"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={`block w-full truncate rounded-lg px-3 py-2 text-left text-[14px] transition-colors outline-none focus-visible:bg-[#F6F8FA] ${
                option.value === value
                  ? 'bg-[#3248F2]/10 font-medium text-[#3248F2]'
                  : 'text-[#171215] hover:bg-[#F6F8FA]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * Round and separate, as in the reference — not the joined pill the rest of the
 * app uses for a stepper. Here they sit alone at the end of a header with no
 * other control beside them, and a bordered group would be drawing a box around
 * one thing.
 */
function Step({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-[#999999]/25 text-[#171215] transition-colors outline-none hover:bg-[#F6F8FA] focus-visible:ring-2 focus-visible:ring-[#3248F2]"
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
