import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Calendar03Icon } from '@hugeicons/core-free-icons'
import MiniMonth from './MiniMonth'
import {
  addDays,
  clockOf,
  formatDuration,
  formatPrice,
  fromMinutes,
  minutesOf,
  sameInstant,
  startOfDay,
} from '../../lib/appointments'
import { DAY_LETTERS, sameDay } from '../../lib/dates'

/**
 * The three fields that decide when a booking happens, shared by the dialog
 * that creates one and the one that edits it.
 *
 * They live together in one file rather than beside either dialog because the
 * rules they encode are the rules: a time is only ever chosen from the slots
 * the server offered, a service's length and price are what the rest of the
 * form is computed from, and the day is almost always today or tomorrow. Two
 * copies of that would agree right up until one of them was changed.
 *
 * Only components are exported — the constants below stay private, which is
 * what keeps `react/only-export-components` quiet.
 */

const DAYS_ON_OFFER = 5

// Three buckets, always the same three. Grouping by "runs of consecutive
// slots" was the other option and it lies: a gap means a break on one day and
// a booking already taken on the next, so the same list would split
// differently for reasons the owner cannot see.
const PARTS = [
  { id: 'morning', label: 'Утро', until: 12 * 60 },
  { id: 'afternoon', label: 'День', until: 17 * 60 },
  { id: 'evening', label: 'Вечер', until: 24 * 60 },
]

export function Label({ children, className = '' }) {
  return (
    <p
      className={`text-[11px] font-medium tracking-wide text-[#999999] uppercase ${className}`}
    >
      {children}
    </p>
  )
}

export function FieldError({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-1.5 text-[13px] text-[#DC2626]">
      {message}
    </p>
  )
}

/** The price list, with the two numbers that decide the rest of the form. */
export function ServicePicker({ services, value, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="mt-2 w-full rounded-xl border border-[#999999]/25 px-3 py-2.5 text-left outline-none transition-colors hover:bg-[#F6F8FA]">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[14px] font-medium text-[#171215]">
            {value ? value.name : 'Выберите услугу'}
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            strokeWidth={2.2}
            className="shrink-0 text-[#999999]"
          />
        </span>
        {/* The length and the price on their own line: they are what the rest
            of this form is computed from, not decoration on the name. */}
        {value && (
          <span className="mt-0.5 block text-[13px] text-[#999999]">
            {formatDuration(value.duration_minutes)} · {formatPrice(value.price)}
          </span>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-[70] max-h-[260px] w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-xl border border-[#999999]/25 bg-white p-1.5 shadow-[0_16px_40px_-8px_rgba(23,18,21,0.28)]"
        >
          {services.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange(item.id)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[14px] text-[#171215] outline-none transition-colors hover:bg-[#F6F8FA]"
            >
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="shrink-0 text-[13px] text-[#999999]">
                {formatDuration(item.duration_minutes)} · {formatPrice(item.price)}
              </span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * Five days in a row, plus the month behind a button.
 *
 * Almost every booking made by hand is for today or the next day or two. A
 * dropdown makes that common case cost three actions — open, find, click —
 * where a visible chip costs one, and it leaves the month for the rare far
 * date rather than putting it in everybody's way.
 *
 * The row's own first day is held here rather than by the caller, so picking a
 * chip never slides the row under the pointer: it re-anchors only when a date
 * is chosen from the month, which by definition is outside the row.
 */
export function DayChips({ day, onPick }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(() => startOfDay(day))
  const today = new Date()

  const days = Array.from({ length: DAYS_ON_OFFER }, (_, index) =>
    addDays(anchor, index)
  )

  const pick = (next) => {
    const picked = startOfDay(next)
    if (picked < anchor || picked > addDays(anchor, DAYS_ON_OFFER - 1)) {
      setAnchor(picked)
    }
    onPick(picked)
  }

  const nameOf = (item) => {
    if (sameDay(item, today)) return 'Сег.'
    if (sameDay(item, addDays(today, 1))) return 'Завт.'
    return DAY_LETTERS[(item.getDay() + 6) % 7]
  }

  return (
    <div className="mt-2 flex items-stretch gap-1.5">
      {days.map((item) => {
        const active = sameDay(item, day)

        return (
          <button
            key={item.toISOString()}
            type="button"
            onClick={() => pick(item)}
            aria-pressed={active}
            className={`flex h-[52px] flex-1 flex-col items-center justify-center rounded-xl border text-[12px] outline-none transition-colors ${
              active
                ? 'border-[#3248F2] bg-[#3248F2] text-white'
                : 'border-[#999999]/25 text-[#171215] hover:bg-[#F6F8FA]'
            }`}
          >
            <span className={active ? 'text-white/80' : 'text-[#999999]'}>
              {nameOf(item)}
            </span>
            <span className="mt-0.5 text-[14px] font-medium">{item.getDate()}</span>
          </button>
        )
      })}

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          aria-label="Другая дата"
          className="grid h-[52px] w-[44px] shrink-0 place-items-center rounded-xl border border-[#999999]/25 text-[#171215] outline-none transition-colors hover:bg-[#F6F8FA]"
        >
          <HugeiconsIcon
            icon={Calendar03Icon}
            size={18}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="end"
            sideOffset={6}
            className="z-[70] rounded-xl border border-[#999999]/25 bg-white shadow-[0_16px_40px_-8px_rgba(23,18,21,0.28)]"
          >
            <MiniMonth
              date={day}
              onDateChange={(next) => {
                pick(next)
                setOpen(false)
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

/**
 * The times on offer, in three named parts of the day.
 *
 * Every one of these came from `GET /appointments/slots`, which has already
 * subtracted the lunch break, the bookings already taken and the day's opening
 * hours — so a time that cannot be booked is never shown.
 */
export function SlotPicker({
  slots,
  loading,
  value,
  onChange,
  breakStart,
  breakEnd,
  columns = 3,
}) {
  if (loading) {
    return <p className="text-[14px] text-[#999999]">Смотрим свободное время…</p>
  }

  if (slots.length === 0) {
    return (
      <p className="text-[14px] text-[#999999]">
        На этот день свободного времени нет.
      </p>
    )
  }

  // Spelled out rather than interpolated: Tailwind only ships the classes it
  // can see written in the source.
  const grid = columns === 4 ? 'grid-cols-4' : 'grid-cols-3'
  const span = columns === 4 ? 'col-span-4' : 'col-span-3'

  return (
    <div className="space-y-4">
      {PARTS.map((part, index) => {
        const from = index === 0 ? 0 : PARTS[index - 1].until
        const inPart = slots.filter((slot) => {
          const minutes = minutesOf(slot)
          return minutes >= from && minutes < part.until
        })
        if (inPart.length === 0) return null

        return (
          <div key={part.id}>
            <p className="mb-2 text-[12px] font-medium text-[#171215]">
              {part.label}
            </p>

            <div className={`grid gap-2 ${grid}`}>
              {inPart.map((slot, position) => {
                const previous =
                  position === 0 ? null : minutesOf(inPart[position - 1])
                // Named where it actually falls, so the jump from 12:30 to
                // 14:00 stops reading as data that went missing.
                const crossesBreak =
                  breakStart !== null &&
                  breakEnd !== null &&
                  previous !== null &&
                  previous < breakStart &&
                  minutesOf(slot) >= breakEnd

                return (
                  <Slot
                    key={slot}
                    slot={slot}
                    active={sameInstant(slot, value)}
                    onChange={onChange}
                    span={span}
                    divider={
                      crossesBreak
                        ? `перерыв ${fromMinutes(breakStart)}–${fromMinutes(breakEnd)}`
                        : null
                    }
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Slot({ slot, active, onChange, divider, span }) {
  return (
    <>
      {divider && (
        <span
          className={`flex items-center gap-2 py-1 text-[11px] text-[#999999] ${span}`}
        >
          <span className="h-px flex-1 bg-[#999999]/20" />
          {divider}
          <span className="h-px flex-1 bg-[#999999]/20" />
        </span>
      )}
      <button
        type="button"
        onClick={() => onChange(slot)}
        aria-pressed={active}
        className={`h-9 rounded-lg border text-[13px] font-medium outline-none transition-colors ${
          active
            ? 'border-[#3248F2] bg-[#3248F2] text-white'
            : 'border-[#999999]/25 text-[#171215] hover:bg-[#F6F8FA]'
        }`}
      >
        {clockOf(slot)}
      </button>
    </>
  )
}
