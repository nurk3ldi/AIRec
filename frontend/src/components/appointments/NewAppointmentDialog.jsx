import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import MiniMonth from './MiniMonth'
import { createAppointment, getServices, getSlots } from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import { DAY_NAMES, MONTHS_OF, dayKey } from '../../lib/dates'

const formatPrice = (value) => `${value.toLocaleString('ru-RU')} ₸`

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} мин`
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

const clockOf = (iso) => {
  const moment = new Date(iso)
  return `${String(moment.getHours()).padStart(2, '0')}:${String(
    moment.getMinutes()
  ).padStart(2, '0')}`
}

/**
 * Booking a time by hand, from the panel.
 *
 * The order of the fields is the order the rules impose, not the order they'd
 * read best in: the service has to be chosen first because its length decides
 * which start times are legal, and the day second because free times are a
 * property of that day. Asking for a time before either would mean re-checking
 * — and often discarding — an answer the owner had already given.
 *
 * Times are never typed. Every one on offer comes from `GET /appointments/slots`,
 * which has already subtracted the lunch break, the bookings already taken and
 * the day's opening hours, so a time that cannot be booked is never shown.
 */
export default function NewAppointmentDialog({ date, onClose, onCreated }) {
  const [services, setServices] = useState([])
  const [serviceId, setServiceId] = useState(null)
  const [day, setDay] = useState(() => date)

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

    getServices(getAccessToken())
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

  const canSubmit = Boolean(serviceId && startsAt && name.trim()) && !saving

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] grid place-items-center bg-[#171215]/50 p-4">
          <Dialog.Content
            aria-describedby={undefined}
            className="flex max-h-[calc(100vh-2rem)] w-[520px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(23,18,21,0.35)] outline-none"
          >
            <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3">
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

            <form
              onSubmit={submit}
              noValidate
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5">
                <Field label="Услуга" error={fieldErrors.service_id}>
                  {services.length === 0 ? (
                    <p className="text-[14px] text-[#999999]">
                      Сначала добавьте услугу в разделе «Бизнес».
                    </p>
                  ) : (
                    <ServicePicker
                      services={services}
                      value={service}
                      onChange={setServiceId}
                    />
                  )}
                </Field>

                <Field label="Дата">
                  <DatePicker day={day} onChange={setDay} />
                </Field>

                <Field label="Время" error={fieldErrors.starts_at}>
                  <Slots
                    slots={slots}
                    loading={slotsLoading}
                    value={startsAt}
                    onChange={setStartsAt}
                  />
                </Field>

                <Field label="Клиент" error={fieldErrors.client_name}>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Имя"
                    aria-label="Имя клиента"
                    className="h-10 w-full rounded-xl border border-[#999999]/25 px-3 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2]"
                  />
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Телефон · необязательно"
                    aria-label="Телефон клиента"
                    className="mt-2 h-10 w-full rounded-xl border border-[#999999]/25 px-3 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2]"
                  />
                  {fieldErrors.client_phone && (
                    <p role="alert" className="mt-1.5 text-[13px] text-[#DC2626]">
                      {fieldErrors.client_phone}
                    </p>
                  )}
                </Field>

                <Field label="Комментарий · необязательно" error={fieldErrors.note}>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    aria-label="Комментарий"
                    className="w-full resize-none rounded-xl border border-[#999999]/25 px-3 py-2 text-[14px] text-[#171215] outline-none transition-colors focus:border-[#3248F2]"
                  />
                </Field>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#999999]/15 px-6 py-4">
                {error && (
                  <p role="alert" className="mr-auto text-[13px] text-[#DC2626]">
                    {error}
                  </p>
                )}
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
            </form>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] text-[#999999]">{label}</p>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-[#DC2626]">
          {error}
        </p>
      )}
    </div>
  )
}

/** The price list, with the two numbers that decide the rest of the form. */
function ServicePicker({ services, value, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[#999999]/25 px-3 text-left text-[14px] text-[#171215] outline-none transition-colors hover:bg-[#F6F8FA]">
        <span className="truncate">
          {value
            ? `${value.name} · ${formatDuration(value.duration_minutes)} · ${formatPrice(value.price)}`
            : 'Выберите услугу'}
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

/** The same month grid the page uses, borrowed into a popover. */
function DatePicker({ day, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[#999999]/25 px-3 text-left text-[14px] text-[#171215] outline-none transition-colors hover:bg-[#F6F8FA]">
        <span className="truncate">
          {day.getDate()} {MONTHS_OF[day.getMonth()]},{' '}
          {DAY_NAMES[day.getDay()].toLowerCase()}
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
          sideOffset={6}
          className="z-[70] rounded-xl border border-[#999999]/25 bg-white shadow-[0_16px_40px_-8px_rgba(23,18,21,0.28)]"
        >
          <MiniMonth
            date={day}
            onDateChange={(next) => {
              onChange(next)
              setOpen(false)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Slots({ slots, loading, value, onChange }) {
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
    <>
      {/* A fixed height with its own scroll: a day with ninety free quarter
          hours would otherwise push the client's name off the dialog. */}
      <div className="grid max-h-[132px] grid-cols-5 gap-2 overflow-y-auto">
        {slots.map((slot) => {
          const active = slot === value

          return (
            <button
              key={slot}
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
          )
        })}
      </div>
      <p className="mt-2 text-[13px] text-[#999999]">
        Свободных слотов: {slots.length}
      </p>
    </>
  )
}
