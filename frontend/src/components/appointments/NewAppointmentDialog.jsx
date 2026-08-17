import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import {
  DayChips,
  FieldError,
  Label,
  ServicePicker,
  SlotPicker,
} from './BookingFields'
import {
  createAppointment,
  getServices,
  getSlots,
  getWorkingHours,
} from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import {
  clockOf,
  endClock,
  formatPrice,
  parseClock,
  startOfDay,
} from '../../lib/appointments'
import { MONTHS_ABBR, dayKey } from '../../lib/dates'

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
 */
export default function NewAppointmentDialog({ date, onClose, onCreated }) {
  const [services, setServices] = useState([])
  const [serviceId, setServiceId] = useState(null)
  const [week, setWeek] = useState([])

  const [day, setDay] = useState(() => startOfDay(date))

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
                  <DayChips day={day} onPick={setDay} />

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
                    <SlotPicker
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
                      {endClock(startsAt, service.duration_minutes)} ·{' '}
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
