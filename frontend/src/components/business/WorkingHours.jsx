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
      {schedule.map((item, index) => {
        const isOpen = Boolean(item.from)
        const hasBreak = Boolean(item.breakFrom)

        return (
          // A grid, not a wrapping flex row: the columns then line up down the
          // whole week, so the eye can read a column of opening times instead
          // of chasing them across seven ragged rows.
          <div
            key={item.day}
            className={`grid grid-cols-[40px_180px_220px_1fr] items-center gap-6 py-2.5 ${
              index > 0 ? 'border-t border-[#999999]/15' : ''
            }`}
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
              <span className="flex items-center gap-3">
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
              </span>
            ) : (
              <span className="text-[14px] text-[#999999]">Выходной</span>
            )}

            {/* Pushed to the right edge: with the times on the left, the row
                then reads from edge to edge instead of trailing off into empty
                space on a full-width card. */}
            {isOpen &&
              (hasBreak ? (
                <span className="flex items-center gap-1 justify-self-end">
                  <span className="mr-1 text-[13px] text-[#999999]">Перерыв</span>
                  <TimeField
                    value={item.breakFrom}
                    label={`${item.day}: перерыв с`}
                    onChange={(breakFrom) => update(item.day, { breakFrom })}
                  />
                  <span className="text-[14px] text-[#999999]">—</span>
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
                  className="inline-flex w-fit items-center gap-1 justify-self-end rounded-lg px-1.5 py-1 text-[13px] font-medium text-[#3248F2] outline-none transition-colors hover:bg-[#3248F2]/8"
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
