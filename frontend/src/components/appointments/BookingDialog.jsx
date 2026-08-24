import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { createAppointment, getSlots } from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import { clockOf, formatDuration, formatPrice } from '../../lib/appointments'
import { dayKey } from '../../lib/dates'
import { getLocale, useT } from '../../lib/i18n'
import { FIELD, FIELD_ERROR } from '../controls'

/**
 * Writing a booking down by hand.
 *
 * **The times come from the server, not from a picker.** `GET /appointments/slots`
 * has already applied opening hours, the break, everything else booked that day
 * and the business's capacity, so the only start times this offers are ones
 * `POST /appointments` will actually accept. Building a clock face here would
 * mean writing those rules a second time and being wrong about them
 * separately — the panel would offer 13:00 through lunch and the server would
 * refuse it, which reads as a broken form rather than as a closed hour.
 *
 * It asks for the slots **without a `source`**, which the endpoint reads as
 * `manual` — the same default `POST` takes. That pair has to stay in step: with
 * `manual` the whole day is offered, this morning included, because the owner
 * writing down someone who walked in twenty minutes ago is recording something
 * that already happened. A picker that hid those times while the endpoint
 * accepted them would be a picker that lies.
 *
 * **It is capped at 560px and scrolls inside itself.** Two of its blocks are
 * lists that grow with the business — a price list, and a quarter-hour grid
 * that is ninety-six entries long on a round-the-clock day — so left to size
 * itself the panel reached the top and bottom of the screen and stopped looking
 * like a dialog at all. Each of those two has its own ceiling as well as the
 * panel's, which is what keeps a long price list from pushing the client's name
 * off the bottom: the part that is long scrolls, the form does not.
 *
 * The day is not editable here. It comes from the calendar, which is on screen
 * beside this and is the control for choosing one; a second date picker inside
 * the dialog would be a second answer to a question already answered.
 */
export default function BookingDialog({
  open,
  onOpenChange,
  day,
  services,
  timeZone,
  onCreated,
}) {
  const t = useT()

  const [serviceId, setServiceId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [note, setNote] = useState('')

  const [slots, setSlots] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})

  const active = services?.filter((item) => item.is_active) ?? []

  // Opening is what resets the form: keeping the last booking's client in the
  // boxes would be a saved draft nobody asked for, and the second booking of a
  // day is rarely for the same person.
  useEffect(() => {
    if (!open) return
    setServiceId(active.length === 1 ? active[0].id : '')
    setStartsAt('')
    setClientName('')
    setClientPhone('')
    setNote('')
    setSlots(null)
    setError('')
    setFields({})
    // `open` alone: this is "the dialog was opened", not "the services
    // changed" — refilling the form under someone mid-typing because a list
    // arrived a moment late is the bug this dependency list prevents. The
    // suppression is the point of the rule, not a way around it: `active` is
    // read here on purpose and must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Slots depend on both the service (its length decides what fits) and the
  // day, so the answer is re-asked whenever either moves.
  useEffect(() => {
    if (!open || !serviceId || !day) return

    let alive = true
    setSlots(null)
    setStartsAt('')

    getSlots(getAccessToken(), { serviceId, day: dayKey(day) })
      .then((data) => {
        if (alive) setSlots(data.slots ?? [])
      })
      .catch(() => {
        // An empty list and a failed request look the same on screen, and the
        // difference is not one the owner can act on: either way there is
        // nothing to pick and Save will say why.
        if (alive) setSlots([])
      })

    return () => {
      alive = false
    }
  }, [open, serviceId, day])

  const submit = async (event) => {
    event.preventDefault()

    const problems = {}
    if (!serviceId) problems.service = t('appointments.required')
    if (!startsAt) problems.time = t('appointments.required')
    if (!clientName.trim()) problems.clientName = t('appointments.required')
    setFields(problems)
    if (Object.keys(problems).length > 0) return

    setSaving(true)
    setError('')
    try {
      await createAppointment(getAccessToken(), {
        service_id: serviceId,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || null,
        starts_at: startsAt,
        note: note.trim() || null,
      })
      onCreated?.()
      onOpenChange(false)
    } catch (err) {
      // The backend words its own errors, in the caller's language — showing
      // its message is more use than a generic one written here.
      setError(err.message)
      if (err.fields?.length) {
        setFields(
          Object.fromEntries(err.fields.map((f) => [f.field, f.message]))
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const dayLabel = day
    ? day.toLocaleDateString(getLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : ''

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-scrim data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[60] flex max-h-[min(560px,calc(100vh-3rem))] w-[calc(100vw-2rem)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface outline-none data-[state=open]:animate-[dialog-in_240ms_cubic-bezier(0.32,0.72,0,1)]">
          <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3">
            <Dialog.Title className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
              {t('appointments.newTitle')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={t('appointments.close')}
                className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted outline-none transition-colors hover:bg-ink/6 hover:text-ink focus-visible:bg-ink/6 focus-visible:text-ink"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
              </button>
            </Dialog.Close>
          </div>

          {/* The day is stated, not asked for — see the note on the component. */}
          <p className="shrink-0 px-6 pb-3 text-[13px] text-muted first-letter:uppercase">
            {dayLabel}
          </p>

          <form
            onSubmit={submit}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6"
          >
            <Group label={t('appointments.service')} error={fields.service}>
              {active.length === 0 ? (
                <p className="text-[13px] text-muted">
                  {t('appointments.noServices')}
                </p>
              ) : (
                // Rows rather than a dropdown: a service is a name, a length
                // and a price, and the two numbers are most of what decides
                // which one this booking is. A select shows one line at a time
                // and hides exactly the part being compared.
                //
                // **The chosen row lifts rather than colours** — `surface-chip`
                // and a ring, the same pair the toolbar's segment uses. A hue
                // was tried here and taken out: orange means "now" everywhere
                // else on this screen, and a service is not a time.
                <div className="flex max-h-[152px] flex-col gap-1.5 overflow-y-auto">
                  {active.map((service) => {
                    const chosen = service.id === serviceId
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setServiceId(service.id)}
                        aria-pressed={chosen}
                        className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors ${
                          chosen
                            ? 'bg-surface-chip shadow-[0_0_0_1px_var(--color-field-focus)]'
                            : 'bg-ink/[0.04] hover:bg-ink/[0.07] focus-visible:bg-ink/[0.07]'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium text-ink">
                            {service.name}
                          </span>
                          <span className="block text-[12px] text-muted">
                            {formatDuration(service.duration_minutes)}
                          </span>
                        </span>
                        <span className="shrink-0 font-display text-[14px] font-semibold text-ink">
                          {formatPrice(service.price)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Group>

            <Group label={t('appointments.time')} error={fields.time}>
              {!serviceId ? (
                <p className="text-[13px] text-muted">
                  {t('appointments.pickServiceFirst')}
                </p>
              ) : slots === null ? (
                <p className="text-[13px] text-muted">
                  {t('appointments.loadingSlots')}
                </p>
              ) : slots.length === 0 ? (
                <p className="text-[13px] text-muted">
                  {t('appointments.noSlots')}
                </p>
              ) : (
                <div className="flex max-h-[104px] flex-wrap gap-1.5 overflow-y-auto">
                  {slots.map((slot) => {
                    const chosen = slot === startsAt
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setStartsAt(slot)}
                        aria-pressed={chosen}
                        className={`h-8 rounded-lg px-3 font-display text-[13px] font-medium outline-none transition-colors ${
                          chosen
                            ? 'bg-surface-chip text-ink shadow-[0_0_0_1px_var(--color-field-focus)]'
                            : 'bg-ink/[0.06] text-ink hover:bg-ink/12 focus-visible:bg-ink/12'
                        }`}
                      >
                        {clockOf(slot, timeZone)}
                      </button>
                    )
                  })}
                </div>
              )}
            </Group>

            <Group
              label={t('appointments.clientName')}
              error={fields.client_name ?? fields.clientName}
            >
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                maxLength={120}
                autoComplete="off"
                className={`${
                  fields.client_name || fields.clientName ? FIELD_ERROR : FIELD
                } h-9 text-[14px]`}
              />
            </Group>

            <Group
              label={t('appointments.clientPhone')}
              error={fields.client_phone}
            >
              <input
                value={clientPhone}
                onChange={(event) => setClientPhone(event.target.value)}
                type="tel"
                maxLength={32}
                autoComplete="off"
                className={`${fields.client_phone ? FIELD_ERROR : FIELD} h-9 text-[14px]`}
              />
            </Group>

            <Group label={t('appointments.note')} error={fields.note}>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                className={`${FIELD} h-auto resize-none py-2 text-[14px] leading-snug`}
              />
            </Group>

            {error && (
              <p className="mb-3 text-[13px] text-danger" role="alert">
                {error}
              </p>
            )}

            {/* Both buttons at the segment's 32px rather than the auth pages'
                40: this dialog sits over a toolbar of 32px controls, not on a
                page of its own. */}
            <div className="mt-1 flex shrink-0 justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="h-9 rounded-full px-4 text-[14px] font-medium text-muted outline-none transition-colors hover:bg-ink/6 hover:text-ink focus-visible:bg-ink/6"
                >
                  {t('appointments.cancel')}
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={saving}
                className="h-9 rounded-full bg-surface-chip px-5 text-[14px] font-medium text-ink outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? t('appointments.saving') : t('appointments.save')}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** A labelled block, with the field's message under it where there is one. */
function Group({ label, error, children }) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-[12px] font-medium tracking-wide text-muted uppercase">
        {label}
      </p>
      {children}
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}
