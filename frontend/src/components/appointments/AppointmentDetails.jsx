import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons'
import {
  DayChips,
  FieldError,
  Label,
  ServicePicker,
  SlotPicker,
} from './BookingFields'
import {
  getServices,
  getSlots,
  getWorkingHours,
  updateAppointment,
} from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import {
  formatDuration,
  formatPrice,
  parseClock,
  sameInstant,
  startOfDay,
} from '../../lib/appointments'
import { DAY_NAMES, MONTHS_ABBR, MONTHS_OF, dayKey } from '../../lib/dates'

/**
 * `2026-08-17` → "Понедельник, 17 августа".
 *
 * Split by hand rather than fed to `new Date(key)`, which reads a bare
 * `YYYY-MM-DD` as UTC midnight and so names the previous day everywhere east
 * of Greenwich — which is everywhere this runs.
 */
const parseDayKey = (key) => {
  const [year, month, date] = key.split('-').map(Number)
  return new Date(year, month - 1, date)
}

/** "Понедельник, 17 августа" — the row in the table, where it stands alone. */
const formatDay = (key) => {
  const day = parseDayKey(key)
  return `${DAY_NAMES[day.getDay()]}, ${day.getDate()} ${MONTHS_OF[day.getMonth()]}`
}

/** "17 авг" — the same date inside a line that carries three other facts. */
const dayLabel = (key) => {
  const day = parseDayKey(key)
  return `${day.getDate()} ${MONTHS_ABBR[day.getMonth()]}`
}

const SOURCE = { whatsapp: 'WhatsApp', manual: 'Вручную' }

/**
 * The four states a booking can be put into, as one switch.
 *
 * `pending` — what the assistant leaves behind when it books on its own — sits
 * in «Активно» rather than getting a fifth segment: from the owner's side it is
 * an active booking, and pressing that segment is what marks it as seen. The
 * five backend statuses map onto four here for that one reason and no other.
 */
const STATES = [
  { id: 'confirmed', label: 'Активно', covers: ['pending', 'confirmed'] },
  { id: 'completed', label: 'Завершено', covers: ['completed'] },
  { id: 'no_show', label: 'Не пришёл', covers: ['no_show'] },
  { id: 'cancelled', label: 'Отменено', covers: ['cancelled'] },
]

const stateOf = (status) =>
  STATES.find((state) => state.covers.includes(status))?.id ?? 'completed'

/**
 * One booking, opened from the grid.
 *
 * A dialog rather than a panel below the month picker. The panel meant the
 * answer to "who is this?" appeared in the corner of the screen furthest from
 * the block that was clicked, and it grew and shrank the left column every time
 * a different booking was opened. A dialog puts the reply where the question
 * was asked, and leaves the calendar exactly as it was underneath.
 *
 * It has two modes and they are deliberately unalike. **Reading** is the one
 * that happens fifty times a day — who, when, how much — and the status switch
 * under the client applies the moment it is pressed, because marking someone as
 * arrived is one decision and should cost one press. **Editing** is rare and
 * touches things that can fail against the server (a time someone else has
 * taken, a service that is longer than the gap), so it stages everything and
 * commits on Сохранить.
 */
export default function AppointmentDetails({ block, onClose, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const state = stateOf(block.status)

  /** One status, applied straight away. Only ever called outside edit mode. */
  const setStatus = async (next) => {
    if (next === state) return
    setBusy(true)
    setError('')
    try {
      onUpdated(
        await updateAppointment(getAccessToken(), block.id, { status: next })
      )
    } catch (err) {
      // Reviving a cancelled booking can lose the slot to someone else in the
      // meantime — the server says so, and there is nothing to do but show it.
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] grid place-items-center bg-[#171215]/50 p-4">
          <Dialog.Content
            aria-describedby={undefined}
            className="flex max-h-[calc(100vh-2rem)] w-[520px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(23,18,21,0.35)] outline-none"
          >
            {/* Who and how to reach them, in both modes — the window's heading
                stays the same thing whether the booking is being read or
                changed. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5 pb-4">
              <div className="min-w-0">
                <Dialog.Title className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] text-[#171215]">
                  {block.client}
                </Dialog.Title>
                {block.phone && (
                  // Still a link — a number on a calendar exists to be dialled
                  // — but in the same near-black as everything beside it.
                  // Accent blue made it the loudest thing in the window, and it
                  // is a detail, not the point of it. The underline on hover is
                  // what says it is clickable, which is all it needed.
                  <a
                    href={`tel:${block.phone.replace(/[^\d+]/g, '')}`}
                    className="mt-0.5 block truncate text-[14px] text-[#171215] outline-none hover:underline"
                  >
                    {block.phone}
                  </a>
                )}
              </div>

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

            {editing ? (
              <EditForm
                block={block}
                onCancel={() => setEditing(false)}
                onSaved={(row) => {
                  onUpdated(row)
                  setEditing(false)
                }}
              />
            ) : (
              <ReadView
                block={block}
                state={state}
                error={error}
                busy={busy}
                onStatusChange={setStatus}
                onEdit={() => {
                  setError('')
                  setEditing(true)
                }}
              />
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Both the current state and every state it could be moved to, laid out flat.
 *
 * The same control as the calendar's day/week switch, for the same reason: with
 * a handful of options a menu costs a click just to see what the others are,
 * and hides the current one behind a chevron. It replaced a row of verbs
 * («Подтвердить», «Завершить», «Не пришёл») which had to be re-read every time
 * because the set changed with the status — this always shows the same four in
 * the same places.
 */
function StatusSwitch({ value, disabled, onChange }) {
  return (
    <div
      role="group"
      aria-label="Статус записи"
      className="flex h-10 w-full items-center gap-1 rounded-xl bg-[#999999]/15 p-1"
    >
      {STATES.map((state) => {
        const active = state.id === value

        return (
          <button
            key={state.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(state.id)}
            aria-pressed={active}
            className={`h-8 min-w-0 flex-1 truncate rounded-lg px-2 text-[13px] font-medium outline-none transition-colors disabled:cursor-not-allowed ${
              active
                ? 'bg-white text-[#171215] shadow-[0_1px_2px_rgba(23,18,21,0.12)]'
                : 'text-[#999999] enabled:hover:text-[#171215] disabled:opacity-45'
            }`}
          >
            {state.label}
          </button>
        )
      })}
    </div>
  )
}

function ReadView({ block, state, error, busy, onStatusChange, onEdit }) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#999999]/15 px-6 py-5">
        {/* Directly under the client, above the details: what happened to a
            booking is the one thing on this screen the owner comes back to
            change, and everything below it is a fact rather than a control. */}
        <StatusSwitch value={state} disabled={busy} onChange={onStatusChange} />

        <dl className="mt-5 space-y-2.5">
          <Row term="Услуга" value={block.service} />
          {/* The date is in the dialog even though the calendar behind it shows
              the same day: once this is a window over the whole screen, the
              column it came from is no longer the thing being read. */}
          <Row term="Дата" value={formatDay(block.day)} />
          <Row term="Время" value={block.range} />
          <Row term="Длительность" value={formatDuration(block.minutes)} />
          <Row term="Стоимость" value={formatPrice(block.price)} />
          <Row term="Источник" value={SOURCE[block.source] ?? block.source} />
        </dl>

        {block.note && (
          <div className="mt-4 border-t border-[#999999]/15 pt-4">
            <p className="text-[13px] text-[#999999]">Комментарий</p>
            <p className="mt-1 text-[14px] break-words text-[#171215]">
              {block.note}
            </p>
          </div>
        )}

        {/* The same booking again, as one sentence — the line the creation
            dialog shows before you press Записать. It is not a summary of the
            table above it but the thing you say out loud when the client rings
            back: reading six labelled rows down the phone is not something
            anyone does, and reassembling them by eye every time is the work
            this line saves.
            On its own tinted strip so it reads as a quotation rather than a
            seventh fact, and selectable as one run of text so it can be copied
            into a message whole. */}
        <p className="mt-5 rounded-xl bg-[#F6F8FA] px-3.5 py-3 text-[14px] break-words text-[#171215]">
          {block.service} · {dayLabel(block.day)} · {block.from}–{block.to} ·{' '}
          {formatPrice(block.price)}
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#999999]/15 px-6 py-4">
        <p className="min-w-0 flex-1 truncate text-[13px]">
          {error && (
            <span role="alert" className="text-[#DC2626]">
              {error}
            </span>
          )}
        </p>

        {/* Bordered, not filled: nothing in a window that only shows things is
            the one action you came to take, and a solid accent button here
            would claim otherwise. */}
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#999999]/30 px-4 py-2 text-[13px] font-medium text-[#171215] outline-none transition-colors hover:bg-[#171215]/5 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <HugeiconsIcon
            icon={PencilEdit02Icon}
            size={16}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
          Редактировать
        </button>
      </div>
    </>
  )
}

/**
 * The same booking, opened up.
 *
 * One column rather than the two the creation dialog uses: this form starts
 * out already filled, so it is read down rather than worked through, and a
 * second column would only put half of an existing answer beside the other.
 *
 * The one thing it has to do that creating does not: offer the time the
 * booking already holds. `/appointments/slots` leaves out whatever is taken,
 * and this booking is taken — by itself — so its own start would be missing
 * from its own edit form. It is merged back in, but only while the service is
 * unchanged: a longer service starting at the same minute is a different span,
 * and the server is the one that knows whether it still fits.
 */
function EditForm({ block, onCancel, onSaved }) {
  const [services, setServices] = useState([])
  const [week, setWeek] = useState([])

  const [serviceId, setServiceId] = useState(block.serviceId)
  const [day, setDay] = useState(() => startOfDay(parseDayKey(block.day)))
  const [startsAt, setStartsAt] = useState(block.startsAt)

  const [name, setName] = useState(block.client)
  const [phone, setPhone] = useState(block.phone ?? '')
  const [note, setNote] = useState(block.note ?? '')

  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)

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
        // The booking's own service is kept even if it has since been hidden
        // from the price list — otherwise the picker would open showing a
        // service this booking is not for.
        setServices(rows.filter((row) => row.is_active || row.id === serviceId))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    getWorkingHours(token)
      .then((rows) => {
        if (!cancelled) setWeek(rows)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dayString = dayKey(day)
  const unmovedService = serviceId === block.serviceId

  useEffect(() => {
    if (!serviceId) return
    let cancelled = false

    setSlotsLoading(true)
    getSlots(getAccessToken(), { serviceId, day: dayString })
      .then((data) => {
        if (cancelled) return

        // Its own time, put back among the free ones — but only where it truly
        // is still this booking's own slot.
        const own =
          unmovedService &&
          dayString === block.day &&
          !data.slots.some((slot) => sameInstant(slot, block.startsAt))
            ? [block.startsAt]
            : []

        setSlots(
          [...data.slots, ...own].sort(
            (a, b) => new Date(a).getTime() - new Date(b).getTime()
          )
        )
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
  }, [serviceId, dayString, unmovedService, block.day, block.startsAt])

  // A change of service or day drops a time that belonged to neither — but
  // only once the new list is in, so the field doesn't blank and refill.
  useEffect(() => {
    if (slotsLoading || slots.length === 0) return
    setStartsAt((current) =>
      slots.some((slot) => sameInstant(slot, current)) ? current : null
    )
  }, [slots, slotsLoading])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})

    try {
      // Only what actually changed. An unchanged `starts_at` sent back would
      // still read as unchanged to the server, but leaving it out keeps the
      // request saying exactly what the owner did.
      const changes = {}
      if (serviceId !== block.serviceId) changes.service_id = serviceId
      if (!sameInstant(startsAt, block.startsAt)) changes.starts_at = startsAt
      if (name.trim() !== block.client) changes.client_name = name.trim()
      if ((phone.trim() || null) !== (block.phone ?? null)) {
        changes.client_phone = phone.trim() || null
      }
      if ((note.trim() || null) !== (block.note ?? null)) {
        changes.note = note.trim() || null
      }

      if (Object.keys(changes).length === 0) {
        onCancel()
        return
      }

      onSaved(await updateAppointment(getAccessToken(), block.id, changes))
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
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#999999]/15 px-6 py-5">
        <Label>Услуга</Label>
        <ServicePicker
          services={services}
          value={service}
          onChange={setServiceId}
        />
        <FieldError message={fieldErrors.service_id} />

        <Label className="mt-5">Дата</Label>
        <DayChips day={day} onPick={setDay} />

        <div className="mt-5 flex items-baseline justify-between gap-2">
          <Label>Время</Label>
          {slots.length > 0 && (
            <span className="text-[12px] text-[#999999]">
              свободно {slots.length}
            </span>
          )}
        </div>
        {/* Capped rather than left to grow: a round-the-clock day is ninety-six
            options, and the client's name has to stay reachable without
            scrolling past all of them. */}
        <div className="mt-2 max-h-[236px] overflow-y-auto">
          <SlotPicker
            slots={slots}
            loading={slotsLoading}
            value={startsAt}
            onChange={setStartsAt}
            breakStart={breakStart}
            breakEnd={breakEnd}
            columns={4}
          />
        </div>
        <FieldError message={fieldErrors.starts_at} />

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

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#999999]/15 px-6 py-4">
        <p className="min-w-0 flex-1 truncate text-[13px]">
          {error && (
            <span role="alert" className="text-[#DC2626]">
              {error}
            </span>
          )}
        </p>

        <div className="flex shrink-0 items-center gap-3">
          {/* Leaves edit mode rather than closing the window: the booking is
              still the thing being looked at, and dropping the owner back onto
              the calendar would make them find and open it again. */}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#999999]/30 px-4 py-2 text-[13px] font-medium text-[#171215] outline-none transition-colors hover:bg-[#171215]/5"
          >
            Отменить
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl bg-[#3248F2] px-4 py-2 text-[13px] font-medium text-white outline-none transition-colors hover:bg-[#2839c9] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </form>
  )
}

function Row({ term, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[13px] text-[#999999]">{term}</dt>
      <dd className="min-w-0 truncate text-right text-[14px] text-[#171215]">
        {value}
      </dd>
    </div>
  )
}
