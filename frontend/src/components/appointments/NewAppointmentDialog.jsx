import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  Calendar03Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import MiniMonth from './MiniMonth'
import {
  createAppointment,
  getServices,
  getSlots,
  getWorkingHours,
} from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import { DAY_LETTERS, MONTHS_ABBR, dayKey, sameDay } from '../../lib/dates'

const formatPrice = (value) => `${value.toLocaleString('ru-RU')} ₸`

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} мин`
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

const pad = (value) => String(value).padStart(2, '0')

const clockOf = (iso) => {
  const moment = new Date(iso)
  return `${pad(moment.getHours())}:${pad(moment.getMinutes())}`
}

const minutesOf = (iso) => {
  const moment = new Date(iso)
  return moment.getHours() * 60 + moment.getMinutes()
}

/** "13:00" → 780. Null for a day that has no break. */
const parseClock = (text) => {
  if (!text) return null
  const [hours, minutes] = text.split(':').map(Number)
  return hours * 60 + minutes
}

const fromMinutes = (minutes) =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

// Three buckets, always the same three. Grouping by "runs of consecutive
// slots" was the other option and it lies: a gap means a break on one day and
// a booking already taken on the next, so the same list would split
// differently for reasons the owner cannot see.
const PARTS = [
  { id: 'morning', label: 'Утро', until: 12 * 60 },
  { id: 'afternoon', label: 'День', until: 17 * 60 },
  { id: 'evening', label: 'Вечер', until: 24 * 60 },
]

const DAYS_ON_OFFER = 5

const startOfDay = (date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const addDays = (date, count) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + count)
  return copy
}

/**
 * Booking a time by hand, from the panel.
 *
 * Two columns rather than one long scroll: everything on the left is a short
 * answer, and the right is the one list that needs room. Stacked, the times
 * pushed the client's name below the fold and the dialog ended up with a
 * scrollbar inside a scrollbar.
 *
 * The order of the fields is the order the rules impose, not the order they'd
 * read best in: the service has to be chosen first because its length decides
 * which start times are legal, and the day second because free times are a
 * property of that day.
 *
 * Times are never typed. Every one on offer comes from `GET /appointments/slots`,
 * which has already subtracted the lunch break, the bookings already taken and
 * the day's opening hours, so a time that cannot be booked is never shown.
 */
export default function NewAppointmentDialog({ date, onClose, onCreated }) {
  const [services, setServices] = useState([])
  const [serviceId, setServiceId] = useState(null)
  const [week, setWeek] = useState([])

  const [day, setDay] = useState(() => startOfDay(date))
  // The first of the day chips. Held apart from `day` so picking one doesn't
  // slide the row under the pointer — it re-anchors only when a date is chosen
  // from the month, which by definition is outside the row.
  const [anchor, setAnchor] = useState(() => startOfDay(date))

  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [startsAt, setStartsAt] = useState(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const service = services.find((item) => item.id === serviceId) ?? null

  useEffect(() => {
    let cancelled = false
    const token = getAccessToken()

    getServices(token)
      .then((rows) => {
        if (cancelled) return
        // A hidden service can't be booked, so it isn't offered.
        const active = rows.filter((row) => row.is_active)
        setServices(active)
        setServiceId((current) => current ?? active[0]?.id ?? null)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    // Needed only to name the break. A gap in the slot list cannot say whether
    // it is lunch or a booking someone else already made, and calling every gap
    // a break would be a guess shown as a fact.
    getWorkingHours(token)
      .then((rows) => {
        if (!cancelled) setWeek(rows)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  const dayString = dayKey(day)

  useEffect(() => {
    if (!serviceId) return
    let cancelled = false

    setSlotsLoading(true)
    // Dropped rather than kept: the times that were on offer belonged to the
    // service and day that have just changed.
    setStartsAt(null)

    getSlots(getAccessToken(), { serviceId, day: dayString })
      .then((data) => {
        if (!cancelled) setSlots(data.slots)
      })
      .catch((err) => {
        if (!cancelled) {
          setSlots([])
          setError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [serviceId, dayString])

  const pickDay = (next) => {
    const picked = startOfDay(next)
    setDay(picked)
    if (picked < anchor || picked > addDays(anchor, DAYS_ON_OFFER - 1)) {
      setAnchor(picked)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})

    try {
      await createAppointment(getAccessToken(), {
        service_id: serviceId,
        client_name: name,
        client_phone: phone || null,
        starts_at: startsAt,
        note: note || null,
        // The owner writing a booking down already agreed it with the client.
        // `pending` is reserved for what the assistant books on its own.
        status: 'confirmed',
      })
      onCreated()
    } catch (err) {
      setError(err.fields?.length ? '' : err.message)
      setFieldErrors(
        Object.fromEntries((err.fields ?? []).map((f) => [f.field, f.message]))
      )
    } finally {
      setSaving(false)
    }
  }

  // Backend weekdays start on Monday; `getDay()` starts on Sunday.
  const hours = week.find((row) => row.weekday === (day.getDay() + 6) % 7)
  const breakStart = hours?.is_24h ? null : parseClock(hours?.break_starts_at)
  const breakEnd = hours?.is_24h ? null : parseClock(hours?.break_ends_at)

  const canSubmit = Boolean(serviceId && startsAt && name.trim()) && !saving

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] grid place-items-center bg-[#171215]/50 p-4">
          <Dialog.Content
            aria-describedby={undefined}
            className="flex max-h-[calc(100vh-2rem)] w-[680px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(23,18,21,0.35)] outline-none"
          >
            <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-4">
              <Dialog.Title className="font-display text-[19px] font-semibold tracking-[-0.02em] text-[#171215]">
                Новая запись
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Закрыть"
                  className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#999999] outline-none transition-colors hover:bg-[#171215]/6 hover:text-[#171215]"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 border-t border-[#999999]/15">
                {/* Left: three short answers, none of which needs room. */}
                <div className="w-[340px] shrink-0 overflow-y-auto px-6 py-5">
                  <Label>Услуга</Label>
                  {services.length === 0 ? (
                    <p className="mt-2 text-[14px] text-[#999999]">
                      Сначала добавьте услугу в разделе «Бизнес».
                    </p>
                  ) : (
                    <ServicePicker
                      services={services}
                      value={service}
                      onChange={setServiceId}
                    />
                  )}
                  <FieldError message={fieldErrors.service_id} />

                  <Label className="mt-5">Дата</Label>
                  <DayChips anchor={anchor} day={day} onPick={pickDay} />

                  <Label className="mt-5">Клиент</Label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Имя клиента"
                    aria-label="Имя клиента"
                    className="mt-2 h-10 w-full rounded-xl border border-[#999999]/25 px-3 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2]"
                  />
                  <FieldError message={fieldErrors.client_name} />

                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Телефон · необязательно"
                    aria-label="Телефон клиента"
                    className="mt-2 h-10 w-full rounded-xl border border-[#999999]/25 px-3 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2]"
                  />
                  <FieldError message={fieldErrors.client_phone} />

                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    placeholder="Комментарий · необязательно"
                    aria-label="Комментарий"
                    className="mt-2 w-full resize-none rounded-xl border border-[#999999]/25 px-3 py-2 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2]"
                  />
                  <FieldError message={fieldErrors.note} />
                </div>

                {/* Right: the one list that needs room. */}
                <div className="flex min-w-0 flex-1 flex-col border-l border-[#999999]/15">
                  <div className="flex shrink-0 items-baseline justify-between gap-2 px-6 pt-5">
                    <Label>Время</Label>
                    {slots.length > 0 && (
                      <span className="text-[12px] text-[#999999]">
                        свободно {slots.length}
                      </span>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-5">
                    <Slots
                      slots={slots}
                      loading={slotsLoading}
                      value={startsAt}
                      onChange={setStartsAt}
                      breakStart={breakStart}
                      breakEnd={breakEnd}
                    />
                  </div>
                </div>
              </div>

              {/* What is about to be booked, in one line you could read aloud to
                  the client on the phone. Without it, pressing the button means
                  trusting five separate fields you have to reassemble. */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#999999]/15 px-6 py-4">
                <p className="min-w-0 flex-1 truncate text-[13px]">
                  {error ? (
                    <span role="alert" className="text-[#DC2626]">
                      {error}
                    </span>
                  ) : startsAt && service ? (
                    <span className="text-[#171215]">
                      {service.name} · {day.getDate()}{' '}
                      {MONTHS_ABBR[day.getMonth()]} · {clockOf(startsAt)}–
                      {endOf(startsAt, service.duration_minutes)} ·{' '}
                      {formatPrice(service.price)}
                    </span>
                  ) : (
                    <span className="text-[#999999]">Выберите время</span>
                  )}
                </p>

                <div className="flex shrink-0 items-center gap-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-xl border border-[#999999]/30 px-4 py-2 text-[13px] font-medium text-[#171215] outline-none transition-colors hover:bg-[#171215]/5"
                    >
                      Отмена
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="rounded-xl bg-[#3248F2] px-4 py-2 text-[13px] font-medium text-white outline-none transition-colors hover:bg-[#2839c9] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {saving ? 'Сохраняем…' : 'Записать'}
                  </button>
                </div>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function endOf(iso, minutes) {
  const end = new Date(new Date(iso).getTime() + minutes * 60000)
  return `${pad(end.getHours())}:${pad(end.getMinutes())}`
}

function Label({ children, className = '' }) {
  return (
    <p
      className={`text-[11px] font-medium tracking-wide text-[#999999] uppercase ${className}`}
    >
      {children}
    </p>
  )
}

function FieldError({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-1.5 text-[13px] text-[#DC2626]">
      {message}
    </p>
  )
}

/**
 * Five days in a row, plus the month behind a button.
 *
 * Almost every booking made by hand is for today or the next day or two. A
 * dropdown makes that common case cost three actions — open, find, click —
 * where a visible chip costs one, and it leaves the month for the rare far
 * date rather than putting it in everybody's way.
 */
function DayChips({ anchor, day, onPick }) {
  const [open, setOpen] = useState(false)
  const today = new Date()

  const days = Array.from({ length: DAYS_ON_OFFER }, (_, index) =>
    addDays(anchor, index)
  )

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
            onClick={() => onPick(item)}
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
                onPick(next)
                setOpen(false)
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

/** The price list, with the two numbers that decide the rest of the form. */
function ServicePicker({ services, value, onChange }) {
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
            of this dialog is computed from, not decoration on the name. */}
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

function Slots({ slots, loading, value, onChange, breakStart, breakEnd }) {
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

            <div className="grid grid-cols-3 gap-2">
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
                    active={slot === value}
                    onChange={onChange}
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

function Slot({ slot, active, onChange, divider }) {
  return (
    <>
      {divider && (
        <span className="col-span-3 flex items-center gap-2 py-1 text-[11px] text-[#999999]">
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
