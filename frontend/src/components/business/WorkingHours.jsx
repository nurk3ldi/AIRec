import * as Switch from '@radix-ui/react-switch'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, MinusSignIcon } from '@hugeicons/core-free-icons'
import OptionPicker from './OptionPicker'
import { dayProblem, formatSpan, openMinutes, openSpans } from '../../lib/schedule'

/**
 * Quarter-hour steps — the same grid service durations are offered on, so a
 * 45-minute service divides into a day evenly instead of leaving offcuts no
 * other booking can fill. The backend enforces the same 15-minute multiple, so
 * this list can't drift away from what the API will accept.
 */
const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hour = String(Math.floor(index / 4)).padStart(2, '0')
  const minute = String((index % 4) * 15).padStart(2, '0')
  return `${hour}:${minute}`
})

const DEFAULT_WORKDAY = { from: '10:00', to: '21:00' }
const DEFAULT_BREAK = { breakFrom: '13:00', breakTo: '14:00' }

// One template for the header and every row, so the labels sit over the values
// they name. The first column is the switch and needs no heading.
//
// The day name takes the slack rather than the break column, which pushes the
// times, the hours and the break together against the right edge — a left-
// anchored name and a right-anchored block of numbers, with the gap between
// them instead of inside them.
//
// Every width here is fixed except that one `1fr`, and the break column in
// particular must NOT be `auto`: the header and each row are separate grids,
// so a content-sized column resolves to the width of "ПЕРЕРЫВ" in one and to
// two time fields in the other, and the whole table drifts out of alignment.
// The day name holds the slack, so everything after it stays anchored to the
// right edge. The round-the-clock mark rides just ahead of the opening time —
// it isn't a value in the row, it's the mode the times are in, so it reads as a
// switch in front of them. Its column is wider than the chip inside it on
// purpose: both the chip and its heading sit at the column's left edge, and the
// leftover width is what keeps the pair off the opening time without needing a
// margin that only one of the two would carry.
// The bar column now holds the slack instead of the day name, which is fixed:
// everything after it stays anchored to the right edge exactly as before, and
// the one flexible column is the one that actually wants the width. `gap-6`
// rather than `gap-8` is what pays for it — at eight columns the old 32px gaps
// left the bar around 100px, which is too narrow to read a lunch break out of.
const COLUMNS =
  'grid grid-cols-[40px_130px_1fr_72px_100px_100px_90px_170px] gap-6'

/** Table column header: tiny, uppercase, muted — the row's frame is air. */
function ColumnLabel({ children, className = '' }) {
  return (
    <span
      className={`text-[11px] font-medium uppercase tracking-wide text-[#999999] ${className}`}
    >
      {children}
    </span>
  )
}

/**
 * The week as seven compact rows rather than a calendar grid.
 *
 * The calendar looked precise but cost a lot of ink for information a list
 * carries in a line — and it had nowhere to put a lunch break without becoming
 * a second layer of blocks. Every value here is editable in place, from the
 * same pickers the rest of the page uses, so no time can be typed wrong.
 */
export default function WorkingHours({ schedule, onChange }) {
  const update = (day, changes) =>
    onChange(
      schedule.map((item) => (item.day === day ? { ...item, ...changes } : item))
    )


  return (
    <div className="flex flex-col">
      <div className={`${COLUMNS} pb-3`}>
        <span />
        <ColumnLabel>День</ColumnLabel>
        {/* The column heading *is* the scale. Three marks and no more: without
            an anchor a bar cannot say whether the open stretch is the morning
            or the evening, and with gridlines it would stop being a bar and
            start being a chart. */}
        <span
          aria-hidden="true"
          className="flex items-end justify-between self-end text-[11px] font-medium text-[#999999]"
        >
          <span>0</span>
          <span>12</span>
          <span>24</span>
        </span>
        {/* Nudged 8px past the column's edge so it reads as sitting over the
            chip's label rather than over the chip's rounded corner. */}
        <ColumnLabel className="pl-[8px]">24/7</ColumnLabel>
        <ColumnLabel>Начало</ColumnLabel>
        <ColumnLabel>Конец</ColumnLabel>
        <ColumnLabel>Часов</ColumnLabel>
        {/* Centred over the pair of times rather than the whole column — the
            right padding discounts the remove button, which has no header and
            would otherwise pull the label off the values it names. */}
        <ColumnLabel className="block w-full pr-[56px] text-center">
          Перерыв
        </ColumnLabel>
      </div>

      {schedule.map((item) => {
        const always = Boolean(item.is24h)
        const isOpen = always || Boolean(item.from)
        const hasBreak = Boolean(item.breakFrom)
        const open = openMinutes(item)
        const problem = dayProblem(item)

        return (
          // The border belongs to the wrapper rather than the grid, so a day
          // with something wrong keeps its message inside its own band instead
          // of pushing a line between the row and its explanation.
          <div key={item.day} className="border-t border-[#999999]/15">
            {/* A grid, not a wrapping flex row: the columns then line up down
                the whole week, so the eye can read a column of opening times
                instead of chasing them across seven ragged rows. */}
            <div className={`${COLUMNS} group items-center py-2.5`}>
            <Switch.Root
              checked={isOpen}
              onCheckedChange={(open) =>
                update(
                  item.day,
                  open
                    ? { ...DEFAULT_WORKDAY, is24h: false }
                    : {
                        from: null,
                        to: null,
                        breakFrom: null,
                        breakTo: null,
                        is24h: false,
                      }
                )
              }
              aria-label={`${item.day}: ${isOpen ? 'сделать выходным' : 'сделать рабочим'}`}
              className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full bg-[#999999]/35 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#3248F2] focus-visible:ring-offset-2 data-[state=checked]:bg-[#3248F2]"
            >
              <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgba(23,18,21,0.25)] transition-transform will-change-transform data-[state=checked]:translate-x-[18px]" />
            </Switch.Root>

            <span
              className={`text-[14px] ${isOpen ? 'text-[#171215]' : 'text-[#999999]'}`}
            >
              {item.day}
            </span>

            <DayBar item={item} />

            {/* Always visible: it is the only place in the product that offers
                a round-the-clock day, so hiding it until hover would leave the
                feature undiscoverable. Muted while off so it doesn't compete
                with the times it would override, and darkening on hover to
                answer the pointer; switched on it takes the accent, because it
                is the reason the columns after it are gone. */}
            <button
              type="button"
              onClick={() =>
                update(
                  item.day,
                  always
                    ? { is24h: false, ...DEFAULT_WORKDAY }
                    : {
                        is24h: true,
                        from: null,
                        to: null,
                        breakFrom: null,
                        breakTo: null,
                      }
                )
              }
              aria-pressed={always}
              aria-label={`${item.day}: круглосуточно`}
              // Content-sized, not stretched: this column carries the row's
              // slack, and a button filling it would put a 400px hit target
              // under the empty space between the day and the times.
              className={`h-7 w-fit justify-self-start rounded-lg px-2 text-[12px] font-medium outline-none transition-colors ${
                always
                  ? 'bg-[#3248F2]/10 text-[#3248F2]'
                  : 'text-[#999999] hover:bg-[#F6F8FA] hover:text-[#171215] focus-visible:bg-[#F6F8FA] focus-visible:text-[#171215]'
              }`}
            >
              24 ч
            </button>

            {/* A day that is closed, and a day that never closes, both replace
                the three value columns with one statement — empty cells under
                the headings would read as values that went missing. */}
            {isOpen && !always ? (
              <>
                <TimeField
                  value={item.from}
                  label={`${item.day}: начало`}
                  onChange={(from) => update(item.day, { from })}
                />
                <TimeField
                  value={item.to}
                  label={`${item.day}: конец`}
                  onChange={(to) => update(item.day, { to })}
                />
                <span className="text-[14px] text-[#171215]">
                  {open ? formatSpan(open) : '—'}
                </span>
              </>
            ) : (
              <span
                className={`col-span-3 text-[14px] ${always ? 'text-[#171215]' : 'text-[#999999]'}`}
              >
                {always ? 'Круглосуточно' : 'Выходной'}
              </span>
            )}

            {/* Pushed to the right edge: with the times on the left, the row
                then reads from edge to edge instead of trailing off into empty
                space on a full-width card. Nothing follows it, so a day without
                one simply leaves the last column empty. */}
            {isOpen &&
              !always &&
              (hasBreak ? (
                <span className="flex items-center gap-3">
                  <TimeField
                    value={item.breakFrom}
                    label={`${item.day}: перерыв с`}
                    onChange={(breakFrom) => update(item.day, { breakFrom })}
                  />
                  <TimeField
                    value={item.breakTo}
                    label={`${item.day}: перерыв до`}
                    onChange={(breakTo) => update(item.day, { breakTo })}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update(item.day, { breakFrom: null, breakTo: null })
                    }
                    aria-label={`${item.day}: убрать перерыв`}
                    className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-[#999999] outline-none transition-colors hover:bg-[#DC2626]/8 hover:text-[#DC2626] focus-visible:bg-[#DC2626]/8 focus-visible:text-[#DC2626]"
                  >
                    <HugeiconsIcon
                      icon={MinusSignIcon}
                      size={14}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.4}
                    />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => update(item.day, DEFAULT_BREAK)}
                  className="inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-[13px] font-medium text-[#3248F2] outline-none transition-colors hover:bg-[#3248F2]/8 focus-visible:bg-[#3248F2]/8"
                >
                  <HugeiconsIcon
                    icon={Add01Icon}
                    size={13}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.4}
                  />
                  Перерыв
                </button>
              ))}
            </div>

            {/* Indented to start under the day name — the message is about
                this day, and lining it up with the switch would make it read
                as belonging to the table. */}
            {problem && (
              <p
                role="alert"
                className="pb-2.5 pl-[64px] text-[13px] text-[#DC2626]"
              >
                {problem}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * One day drawn as the stretches it is open, across a track of twenty-four
 * hours.
 *
 * This is the only chart on the page and it earns its place: a break is what
 * splits a day into two, and seven rows of times cannot show that — you have to
 * read four numbers and subtract. As a shape it is one glance, and a Sunday
 * left open by accident stands out of the column without being read at all.
 *
 * Deliberately bare, per the reference: no gridlines, no axis, no border, no
 * tick under each hour. And a tint rather than solid accent — every day here is
 * equal, so seven solid blue bars would spend the colour that is supposed to
 * mean "look at this one".
 *
 * `aria-hidden`, because it restates the times sitting beside it; a screen
 * reader announcing a row twice is worse than not announcing the picture.
 */
function DayBar({ item }) {
  return (
    <span
      aria-hidden="true"
      className="relative block h-1.5 w-full self-center overflow-hidden rounded-full bg-[#999999]/12"
    >
      {openSpans(item).map(([from, to]) => (
        <span
          key={from}
          className="absolute inset-y-0 rounded-full bg-[#3248F2]/35"
          style={{
            left: `${(from / 1440) * 100}%`,
            width: `${((to - from) / 1440) * 100}%`,
          }}
        />
      ))}
    </span>
  )
}

/**
 * A time as a picker, sized to sit inline in a sentence of times.
 *
 * Searchable because the quarter-hour grid is ninety-six entries long: typing
 * "18" is one keystroke pair away from the answer, where scrolling to it is a
 * dozen. The box also makes the filtering visible — cmdk narrows the list on
 * any keypress whether or not there is somewhere to see it happen.
 */
function TimeField({ value, label, onChange }) {
  return (
    <OptionPicker
      value={value}
      options={TIME_OPTIONS}
      label={label}
      onChange={onChange}
      size="text-[14px]"
      weight="font-medium"
      searchable
      compact
    />
  )
}
