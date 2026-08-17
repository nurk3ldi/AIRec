import { useEffect, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import {
  createAppointment,
  getServices,
  getSlots,
  updateAppointment,
} from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import {
  BOOKING_STATES,
  clockOf,
  endClock,
  formatDuration,
  formatPrice,
  sameInstant,
  stateOf,
} from '../../lib/appointments'
import { DAY_NAMES, MONTHS_OF, dayKey } from '../../lib/dates'

/**
 * Writing a booking, or changing one already written.
 *
 * One form for both, because it is one form: a booking is the same five answers
 * whether they are being given for the first time or corrected. Two components
 * would be two places for the slot rules to drift apart.
 *
 * Editing adds exactly two things — a status switch, since what became of a
 * booking is the thing most often changed after the fact, and its own start
 * time put back among the free ones (see below). The day itself is fixed while
 * editing: moving a booking to another date is a different act, and there is no
 * date control here to do it with.
 *
 * The reference's inline editor, and inline is the point: it is placed as a
 * grid item inside the calendar rather than portalled to the middle of the
 * screen, so it measures exactly three day cells across — and the month it
 * belongs to stays legible around it. No dimming layer either, for the same
 * reason: the calendar behind is the context you are booking into, and covering
 * it would be hiding the answer to "is that day already busy?". Opened from a
 * control outside the calendar it has no cell to hang off, and the page renders
 * it centred over a dimmed page instead.
 *
 * That means it manages its own dismissal — Escape, and a press anywhere
 * outside — which a modal would have got from Radix.
 *
 * Three of the reference's rows had to be re-read rather than copied, because
 * the data behind them is different here:
 *
 *  - **Type** is a *service*. It is the field the rest of the form is computed
 *    from — its length decides which start times are legal and its price is
 *    what the booking will have cost.
 *  - **Hour** is one stepper, not two. The end of a booking is its start plus
 *    the service's length, so a second stepper would be a control that cannot
 *    be moved; the end is shown beside the start instead. And the stepper walks
 *    the times `GET /appointments/slots` returned rather than the clock, so a
 *    time that cannot be booked can't be stepped onto in the first place.
 *  - **Members** is a *client* — one name and one phone. The reference's avatar
 *    stack is a meeting with attendees; a booking is one person coming in.
 */
export default function BookingPanel({
  date,
  booking = null,
  className,
  modal = false,
  onClose,
  onSaved,
}) {
  const box = useRef(null)
  const editing = Boolean(booking)

  const [services, setServices] = useState([])
  const [serviceId, setServiceId] = useState(booking?.serviceId ?? null)

  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [startsAt, setStartsAt] = useState(booking?.startsAt ?? null)

  const [name, setName] = useState(booking?.client ?? '')
  const [phone, setPhone] = useState(booking?.phone ?? '')
  const [note, setNote] = useState(booking?.note ?? '')
  const [status, setStatus] = useState(stateOf(booking?.status))

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const service = services.find((item) => item.id === serviceId) ?? null
  const day = dayKey(date)

  // Escape, and a press outside. `mousedown` rather than `click` so a press
  // that starts outside closes it before the pointer can land on whatever was
  // underneath. The service menu portals itself out of this box, so a press on
  // it has to be forgiven explicitly.
  //
  // Skipped entirely in `modal` mode: Radix's Dialog already owns both, and two
  // handlers racing on the same Escape is how a menu and its dialog end up
  // closing on one press.
  useEffect(() => {
    if (modal) return

    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    const onDown = (event) => {
      if (box.current?.contains(event.target)) return
      if (event.target.closest?.('[data-radix-popper-content-wrapper]')) return
      onClose()
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [modal, onClose])

  useEffect(() => {
    let cancelled = false

    getServices(getAccessToken())
      .then((rows) => {
        if (cancelled) return
        // A hidden service can't be booked, so it isn't offered.
        const active = rows.filter((row) => row.is_active)
        setServices(active)
        setServiceId((current) => current ?? active[0]?.id ?? null)
        if (active.length === 0) setSlotsLoading(false)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setSlotsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!serviceId) return
    let cancelled = false

    setSlotsLoading(true)
    getSlots(getAccessToken(), { serviceId, day })
      .then((data) => {
        if (cancelled) return

        // A booking's own time is missing from its own edit form: the slots
        // endpoint leaves out whatever is taken, and this booking is taken —
        // by itself. It goes back in, but only while the service is unchanged;
        // a longer service starting at the same minute is a different span,
        // and the server is the one that knows whether it still fits.
        const own =
          editing &&
          serviceId === booking.serviceId &&
          !data.slots.some((slot) => sameInstant(slot, booking.startsAt))
            ? [booking.startsAt]
            : []

        const offered = [...data.slots, ...own].sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime()
        )
        setSlots(offered)
        // Keep the time already chosen if it survived; otherwise the first free
        // one, so the form is always arriving valid.
        setStartsAt((current) =>
          offered.some((slot) => sameInstant(slot, current))
            ? current
            : (offered[0] ?? null)
        )
      })
      .catch((err) => {
        if (!cancelled) {
          setSlots([])
          setStartsAt(null)
          setError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [serviceId, day, editing, booking])

  const at = slots.findIndex((slot) => sameInstant(slot, startsAt))

  const step = (direction) => {
    const next = at + direction
    if (next >= 0 && next < slots.length) setStartsAt(slots[next])
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})

    try {
      const token = getAccessToken()

      if (editing) {
        // Only what actually moved. An unchanged field sent back would read as
        // unchanged to the server anyway, but leaving it out keeps the request
        // saying exactly what the owner did — and an unchanged `starts_at` is
        // what stops a two-week-old booking being re-checked against today's
        // availability just to mark it completed.
        const changes = {}
        if (serviceId !== booking.serviceId) changes.service_id = serviceId
        if (!sameInstant(startsAt, booking.startsAt)) changes.starts_at = startsAt
        if (name.trim() !== booking.client) changes.client_name = name.trim()
        if ((phone.trim() || null) !== (booking.phone ?? null)) {
          changes.client_phone = phone.trim() || null
        }
        if ((note.trim() || null) !== (booking.note ?? null)) {
          changes.note = note.trim() || null
        }
        if (status !== stateOf(booking.status)) changes.status = status

        if (Object.keys(changes).length === 0) {
          onClose()
          return
        }
        await updateAppointment(token, booking.id, changes)
      } else {
        await createAppointment(token, {
          service_id: serviceId,
          client_name: name,
          client_phone: phone || null,
          starts_at: startsAt,
          note: note || null,
          // The owner writing a booking down already agreed it with the client.
          // `pending` is reserved for what the assistant books on its own.
          status: 'confirmed',
        })
      }

      onSaved()
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
    // `z-20` over the cells, and the only shadow on this screen — it is the one
    // thing here that genuinely floats above the page.
    <div
      ref={box}
      // In `modal` mode the wrapping `Dialog.Content` is already the dialog;
      // a second `role="dialog"` inside it would announce two.
      role={modal ? undefined : 'dialog'}
      aria-label={
        modal ? undefined : editing ? 'Редактировать запись' : 'Новая запись'
      }
      className={`relative z-20 flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] ring-1 ring-[#999999]/20 ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4 pb-3.5">
        <h3 className="font-display truncate text-[18px] font-semibold tracking-[-0.02em] text-[#171215]">
          {editing ? 'Редактировать запись' : 'Новая запись'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#999999] transition-colors outline-none hover:bg-[#171215]/6 hover:text-[#171215] focus-visible:ring-2 focus-visible:ring-[#3248F2]"
        >
          <HugeiconsIcon
            icon={Cancel01Icon}
            size={16}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </button>
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col">
        {/* Dashed, as in the reference, and it earns the difference: these fence
            off the fields from the title and the button rather than separating
            two subjects, which is what a solid rule means everywhere else in
            this product. */}
        {/* No scroll container here, deliberately. The panel is sized by its
            own content, so a scrollable child could only ever produce the
            scrollbar sub-pixel rounding invents when a box is exactly as tall
            as what is in it — a bar that scrolls nothing. */}
        <div className="border-t border-dashed border-[#999999]/35 px-5 py-3">
          <Row label="Дата">
            <p className="truncate text-[14px] text-[#171215]">
              {DAY_NAMES[date.getDay()]}, {date.getDate()}{' '}
              {MONTHS_OF[date.getMonth()]}
            </p>
          </Row>

          <Row label="Услуга">
            {services.length === 0 ? (
              <p className="text-[13px] text-[#999999]">
                Сначала добавьте услугу в разделе «Бизнес».
              </p>
            ) : (
              <ServiceSelect
                services={services}
                value={service}
                onChange={setServiceId}
              />
            )}
          </Row>
          <FieldError message={fieldErrors.service_id} />

          <Row label="Время">
            {slotsLoading ? (
              <p className="text-[13px] text-[#999999]">Смотрим…</p>
            ) : slots.length === 0 ? (
              <p className="text-[13px] text-[#999999]">Свободного времени нет.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <div className="flex items-center gap-1 rounded-xl bg-[#999999]/15 p-1">
                  <Step
                    icon={ArrowLeft01Icon}
                    label="Раньше"
                    disabled={at <= 0}
                    onClick={() => step(-1)}
                  />
                  <span className="min-w-[46px] text-center text-[14px] font-medium text-[#171215] tabular-nums">
                    {clockOf(startsAt)}
                  </span>
                  <Step
                    icon={ArrowRight01Icon}
                    label="Позже"
                    disabled={at >= slots.length - 1}
                    onClick={() => step(1)}
                  />
                </div>

                {/* Not a second stepper: the end is the start plus the
                    service's length, so there is nothing here to move. It wears
                    the same fill and weight as the start it is paired with —
                    the two are one span of time, and the dash between them is
                    what says so. What it does *not* get is arrows, which is the
                    only difference the eye needs to find. */}
                {service && (
                  <>
                    <span className="text-[14px] text-[#999999]">–</span>
                    <span className="flex h-9 items-center rounded-xl bg-[#999999]/15 px-3 text-[14px] font-medium text-[#171215] tabular-nums">
                      до {endClock(startsAt, service.duration_minutes)}
                    </span>
                  </>
                )}
              </div>
            )}
          </Row>
          <FieldError message={fieldErrors.starts_at} />

          <Row label="Клиент">
            <Input value={name} onChange={setName} placeholder="Имя клиента" />
          </Row>
          <FieldError message={fieldErrors.client_name} />

          <Row label="Телефон">
            <Input
              value={phone}
              onChange={setPhone}
              placeholder="Необязательно"
              label="Телефон клиента"
            />
          </Row>
          <FieldError message={fieldErrors.client_phone} />

          {/* Only when editing: a booking being written down now is active by
              definition, and offering «Завершено» for something that hasn't
              happened yet is offering a lie. */}
          {editing && (
            <Row label="Статус">
              <div
                role="group"
                aria-label="Статус записи"
                className="flex h-10 w-full items-center gap-1 rounded-xl bg-[#999999]/15 p-1"
              >
                {BOOKING_STATES.map((state) => {
                  const active = state.id === status
                  return (
                    <button
                      key={state.id}
                      type="button"
                      onClick={() => setStatus(state.id)}
                      aria-pressed={active}
                      className={`h-8 min-w-0 flex-1 truncate rounded-lg px-1.5 text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#3248F2] ${
                        active
                          ? 'bg-white text-[#171215] shadow-[0_1px_2px_rgba(23,18,21,0.12)]'
                          : 'text-[#999999] hover:text-[#171215]'
                      }`}
                    >
                      {state.label}
                    </button>
                  )
                })}
              </div>
            </Row>
          )}

          <Row label="Заметка">
            <Input
              value={note}
              onChange={setNote}
              placeholder="Добавить заметку"
              label="Комментарий"
            />
          </Row>
          <FieldError message={fieldErrors.note} />
        </div>

        <div className="shrink-0 border-t border-dashed border-[#999999]/35 px-5 pt-3.5 pb-4">
          {error && (
            <p role="alert" className="mb-2 text-center text-[12px] text-[#DC2626]">
              {error}
            </p>
          )}

          {/* Centred and alone, as in the reference. There is no Cancel beside
              it: the ✕, Escape and a press outside all already close this, and
              a third way to do nothing would be the widest thing on the row. */}
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-xl bg-[#3248F2] px-7 py-2 text-[14px] font-medium text-white transition-colors outline-none hover:bg-[#2839c9] focus-visible:ring-2 focus-visible:ring-[#171215] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

/**
 * Label on the left, the value on the right — the reference's whole layout.
 *
 * The 14px of padding either side is what sets the rhythm: with a 40px control
 * it puts 28px of air between one row and the next, which is close to the
 * reference's own pitch and is the whole difference between a form you read
 * down and a stack of fields.
 */
function Row({ label, children }) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <p className="w-[80px] shrink-0 text-[14px] text-[#999999]">{label}</p>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function Input({ value, onChange, placeholder, label }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      className="h-10 w-full rounded-xl bg-[#999999]/15 px-3 text-[14px] text-[#171215] outline-none transition-shadow placeholder:text-[#999999] focus:ring-2 focus:ring-[#3248F2]"
    />
  )
}

function FieldError({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="pl-[92px] text-[12px] text-[#DC2626]">
      {message}
    </p>
  )
}

function ServiceSelect({ services, value, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex h-10 w-full items-center justify-between gap-2 rounded-xl bg-[#999999]/15 px-3 text-left transition-colors outline-none hover:bg-[#999999]/22 focus-visible:ring-2 focus-visible:ring-[#3248F2]">
        <span className="truncate text-[14px] text-[#171215]">
          {value ? value.name : 'Выберите услугу'}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={15}
          strokeWidth={2.2}
          className="shrink-0 text-[#999999]"
        />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-[70] max-h-[240px] w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-xl border border-[#999999]/25 bg-white p-1.5 shadow-[0_16px_40px_-8px_rgba(23,18,21,0.28)]"
        >
          {services.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange(item.id)
                setOpen(false)
              }}
              className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors outline-none hover:bg-[#F6F8FA] focus-visible:bg-[#F6F8FA]"
            >
              <span className="truncate text-[14px] text-[#171215]">
                {item.name}
              </span>
              <span className="truncate text-[12px] text-[#999999]">
                {formatDuration(item.duration_minutes)} · {formatPrice(item.price)}
              </span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Step({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-[#171215] transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[#3248F2] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <HugeiconsIcon
        icon={icon}
        size={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
    </button>
  )
}
