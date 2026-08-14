import * as Switch from '@radix-ui/react-switch'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, MinusSignIcon } from '@hugeicons/core-free-icons'
import OptionPicker from './OptionPicker'

/** Half-hour steps: the grid a barbershop actually books on. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, '0')
  return `${hour}:${index % 2 ? '30' : '00'}`
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
const COLUMNS = 'grid grid-cols-[40px_1fr_100px_100px_90px_170px] gap-6'

const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const formatSpan = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} мин`
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

/**
 * Hours the business is actually open that day — the working span minus the
 * break. Derived rather than entered, so it can't disagree with the times next
 * to it, and it turns a row of settings into a row that also answers "how long
 * is this day?".
 */
const openMinutes = (item) => {
  if (!item.from || !item.to) return null
  const span = toMinutes(item.to) - toMinutes(item.from)
  const rest =
    item.breakFrom && item.breakTo
      ? toMinutes(item.breakTo) - toMinutes(item.breakFrom)
      : 0
  const total = span - Math.max(rest, 0)
  // A closing time before the opening one is a mistake, not a negative day.
  return total > 0 ? total : null
}

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
        const isOpen = Boolean(item.from)
        const hasBreak = Boolean(item.breakFrom)
        const open = openMinutes(item)

        return (
          // A grid, not a wrapping flex row: the columns then line up down the
          // whole week, so the eye can read a column of opening times instead
          // of chasing them across seven ragged rows.
          <div
            key={item.day}
            className={`${COLUMNS} group items-center border-t border-[#999999]/15 py-2.5`}
          >
            <Switch.Root
              checked={isOpen}
              onCheckedChange={(open) =>
                update(
                  item.day,
                  open
                    ? DEFAULT_WORKDAY
                    : { from: null, to: null, breakFrom: null, breakTo: null }
                )
              }
              aria-label={`${item.day}: ${isOpen ? 'сделать выходным' : 'сделать рабочим'}`}
              className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full bg-[#999999]/35 outline-none transition-colors data-[state=checked]:bg-[#3248F2]"
            >
              <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgba(23,18,21,0.25)] transition-transform will-change-transform data-[state=checked]:translate-x-[18px]" />
            </Switch.Root>

            <span
              className={`text-[14px] ${isOpen ? 'text-[#171215]' : 'text-[#999999]'}`}
            >
              {item.day}
            </span>

            {isOpen ? (
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
              </>
            ) : (
              // Spans the time and hours columns: a closed day has none of
              // them, and empty cells under the headings would read as values
              // that went missing.
              <span className="col-span-3 text-[14px] text-[#999999]">Выходной</span>
            )}

            {isOpen && (
              <span className="text-[14px] text-[#999999]">
                {open ? formatSpan(open) : '—'}
              </span>
            )}

            {/* Pushed to the right edge: with the times on the left, the row
                then reads from edge to edge instead of trailing off into empty
                space on a full-width card. */}
            {isOpen &&
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
                    className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-[#999999] outline-none transition-colors hover:bg-[#DC2626]/8 hover:text-[#DC2626]"
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
                  className="inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-[13px] font-medium text-[#3248F2] outline-none transition-colors hover:bg-[#3248F2]/8"
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
        )
      })}
    </div>
  )
}

/** A time as a picker, sized to sit inline in a sentence of times. */
function TimeField({ value, label, onChange }) {
  return (
    <OptionPicker
      value={value}
      options={TIME_OPTIONS}
      label={label}
      onChange={onChange}
      size="text-[14px]"
      weight="font-medium"
      compact
    />
  )
}
