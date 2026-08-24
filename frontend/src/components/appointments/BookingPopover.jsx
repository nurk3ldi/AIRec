import { useEffect, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { createAppointment } from '../../lib/api'
import { authed } from '../../lib/auth'
import {
  formatDuration,
  formatPrice,
  fromMinutes,
  instantAt,
  parseClock,
} from '../../lib/appointments'
import { dayKey } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import { FIELD, FIELD_ERROR } from '../controls'
import TimeField from './TimeField'

/**
 * Writing a booking down by hand, in a panel hanging off the button that opens
 * it.
 *
 * **A popover, not a centred modal.** The two are not interchangeable here: a
 * modal dims the page and takes it away, which is the right shape for a form
 * you went into on purpose and the wrong one for adding a booking, where the
 * grid behind is the reason you know which day and hour you want. Anchored to
 * the button, the calendar stays legible over your shoulder while you fill it
 * in — the way every calendar app does this.
 *
 * It takes its trigger as `children`, so the button keeps living in the toolbar
 * it belongs to and Radix gets the DOM relationship it needs to position and
 * to trap focus.
 *
 * **The time is chosen freely and the service only names the booking.** They
 * were tied together at first: the service decided how long the booking was,
 * and `GET /appointments/slots` returned the exact starts that length still
 * fitted into. That is the right pairing for a client picking a time out of
 * what is left. It is the wrong one for the owner, who is writing down
 * something already agreed — often something that already happened — and needs
 * the hour it actually is, not the nearest one the calendar approves of.
 *
 * So the picker offers every quarter hour of the day and the service is a
 * label with a length attached: the label is what the booking is called, the
 * length is what fills in the end time beside it.
 *
 * The server has not stopped checking. Opening hours are enforced whatever the
 * source, and so is capacity — a booking outside the working day, or into a
 * full hour, comes back refused and the message lands under the form. What
 * changed is that the panel no longer pre-empts that answer.
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
export default function BookingPopover({
  children,
  day,
  onDayChange,
  services,
  timeZone,
  onCreated,
}) {
  const t = useT()
  // The popover owns whether it is open: it is the button's own panel, and a
  // page that had to hold a boolean for it would be a page that knows about a
  // control two components down.
  const [open, setOpen] = useState(false)

  const [date, setDate] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [note, setNote] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})

  const active = services?.filter((item) => item.is_active) ?? []
  const service = active.find((item) => item.id === serviceId)

  /**
   * When the booking ends, derived rather than asked for.
   *
   * **This is why the end is a second field and not a second picker.** The API
   * takes a `service_id` and a `starts_at` and computes `ends_at` from the
   * service's own length — there is no end to send it. Offering one would be a
   * control whose value is thrown away, and a booking that finished when the
   * form said it would only by coincidence.
   *
   * It still earns a box of its own: the owner is choosing a piece of the day,
   * and "10:30" answers when the client arrives while leaving them to work out
   * when the chair is free again — which is the question the grid beside this
   * is entirely about.
   */
  /**
   * The end follows the start, until it is moved on its own.
   *
   * **Both ends are fields, and the service only proposes the second one.** A
   * service is a price-list entry — "стрижка, 30 минут" — and what happened on
   * the day regularly is not that: the client came for two things, or it ran
   * long. The panel writes down the hour that was used, not the hour that was
   * quoted, so the length travels to the API as `duration_minutes` and is
   * snapshotted onto the booking.
   *
   * Re-proposing it whenever the start or the service changes is what keeps the
   * common case free — pick a service, pick a start, the end is already right —
   * and nothing overwrites a hand-set end until one of those two moves again.
   */
  const duration = service?.duration_minutes
  useEffect(() => {
    if (!startsAt || !duration) return
    setEndsAt(fromMinutes((parseClock(startsAt) + duration) % (24 * 60)))
  }, [startsAt, duration])

  // Opening is what resets the form: keeping the last booking's client in the
  // boxes would be a saved draft nobody asked for, and the second booking of a
  // day is rarely for the same person.
  useEffect(() => {
    if (!open) return
    setDate(day ? dayKey(day) : '')
    setServiceId(active.length === 1 ? active[0].id : '')
    setStartsAt('')
    setEndsAt('')
    setClientName('')
    setClientPhone('')
    setNote('')
    setError('')
    setFields({})
    // `open` alone: this is "the dialog was opened", not "the services
    // changed" — refilling the form under someone mid-typing because a list
    // arrived a moment late is the bug this dependency list prevents. The
    // suppression is the point of the rule, not a way around it: `active` is
    // read here on purpose and must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async (event) => {
    event.preventDefault()

    const problems = {}
    if (!serviceId) problems.service = t('appointments.required')
    if (!startsAt || !endsAt) problems.time = t('appointments.required')
    else if (parseClock(startsAt) === parseClock(endsAt))
      problems.time = t('appointments.sameTime')
    if (!clientName.trim()) problems.clientName = t('appointments.required')
    setFields(problems)
    if (Object.keys(problems).length > 0) return

    setSaving(true)
    setError('')
    try {
      await authed((token) =>
        createAppointment(token, {
          service_id: serviceId,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim() || null,
          starts_at: instantAt(date, startsAt, timeZone),
          // Wrapped through midnight rather than clamped: an end before the start
          // is the ordinary way to write a booking that runs past twelve, and
          // refusing it would be refusing the one shape a night shift can take in
          // two clock fields.
          duration_minutes:
            (parseClock(endsAt) - parseClock(startsAt) + 24 * 60) % (24 * 60),
          note: note.trim() || null,
        }),
      )
      onCreated?.()
      setOpen(false)
    } catch (err) {
      // The backend words its own errors, in the caller's language — showing
      // its message is more use than a generic one written here.
      setError(err.message)
      if (err.fields?.length) {
        setFields(
          Object.fromEntries(err.fields.map((f) => [f.field, f.message])),
        )
      }
    } finally {
      setSaving(false)
    }
  }

  /**
   * Moving the date here moves the page's own selection with it.
   *
   * Two controls, one answer to "which day": the calendar in the panel and this
   * field are bound to the same date, exactly as the calendar and the
   * timetable's arrows already are. Without it a booking could be written for
   * Thursday from a screen showing Monday and then not appear anywhere, because
   * the grid behind reloads the week around the page's selection.
   */
  const pickDate = (value) => {
    setDate(value)
    // `T00:00:00` is load-bearing: a bare `YYYY-MM-DD` is parsed as UTC, which
    // is the previous day for anyone west of Greenwich and the wrong column.
    if (value) onDayChange?.(new Date(`${value}T00:00:00`))
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>

      <Popover.Portal>
        {/* No scrim. The page behind stays readable *and* usable — that is the
            difference between this and the modal it replaced, and dimming it
            would take back the only reason to anchor the panel at all. */}
        <Popover.Content
          // **Beside the button, not under it.** Under it there is only the
          // distance from the toolbar down to the bottom of the window, and a
          // form of seven fields does not fit in that — the panel arrived
          // capped, with a scrollbar down its own side. To the left it has the
          // whole height of the page and opens at its natural size.
          //
          // `align="center"` hangs it level with the button; Radix slides it
          // along that edge if either end would fall off the screen, and only
          // flips it to the other side if the left has no room at all.
          side="left"
          align="center"
          sideOffset={10}
          // **80px of it at the top: the 68px header plus the usual 12.** The
          // panel is `z-[60]` and the header `z-40`, so nothing stops it
          // painting straight over the page title — it has to be told where the
          // page really begins. Radix takes this as the edge of the space it
          // may use, so it bounds `--radix-popover-content-available-height`
          // too: the panel shortens rather than sliding under the bar.
          collisionPadding={{ top: 80, right: 12, bottom: 12, left: 12 }}
          // The panel has a heading but no `Dialog.Title` to point at any
          // more — a popover has no required label of its own, so it is named
          // here for anyone arriving by screen reader.
          aria-label={t('appointments.newTitle')}
          className="z-[60] flex origin-[var(--radix-popover-content-transform-origin)] max-h-[var(--radix-popover-content-available-height)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] outline-none data-[state=open]:animate-[popover-in_180ms_cubic-bezier(0.32,0.72,0,1)]"
        >
          <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3">
            <p className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
              {t('appointments.newTitle')}
            </p>
            <Popover.Close asChild>
              <button
                type="button"
                aria-label={t('appointments.close')}
                className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted outline-none transition-colors hover:bg-ink/6 hover:text-ink focus-visible:bg-ink/6 focus-visible:text-ink"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
              </button>
            </Popover.Close>
          </div>

          <form
            onSubmit={submit}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6"
          >
            {/* **A native date input.** The calendar in the panel is the
                nicer way to choose a day and it is right there — this is the
                same value, spelled out, for the case the dialog is opened and
                the day turns out to be wrong. Native because the browser's own
                picker is keyboard-navigable, localised and already understood;
                the alternative is a second month grid inside a dialog that is
                capped at 560px, which is a lot of surface to spend on
                agreeing with the one behind it. */}
            <Group label={t('appointments.date')} error={fields.starts_at}>
              <input
                type="date"
                value={date}
                onChange={(event) => pickDate(event.target.value)}
                className={`${FIELD} h-9 text-[14px]`}
              />
            </Group>

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
                // **The chosen row lifts, and that is all it does** —
                // `surface-chip`, the same fill the toolbar's chosen segment
                // takes, with no ring around it. The ring was drawing a second
                // edge inside a list that is already a stack of edges, and it
                // read as an error state rather than as a choice. A hue was
                // tried here too and taken out: orange means "now" everywhere
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
                            ? 'bg-surface-chip'
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

            {/* **Two clocks, not a clock and a readout.** The second one was
                derived and disabled, which is the right shape only while a
                booking is exactly as long as its service — and it often is
                not. Both are the same control, so neither reads as the more
                real of the two. */}
            <Group label={t('appointments.time')} error={fields.time}>
              <div className="flex items-center gap-2">
                <TimeField
                  value={startsAt}
                  onChange={setStartsAt}
                  label={t('appointments.start')}
                />

                <span aria-hidden="true" className="shrink-0 text-muted">
                  –
                </span>

                <TimeField
                  value={endsAt}
                  onChange={setEndsAt}
                  label={t('appointments.end')}
                />
              </div>
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
              <Popover.Close asChild>
                <button
                  type="button"
                  className="h-9 rounded-full px-4 text-[14px] font-medium text-muted outline-none transition-colors hover:bg-ink/6 hover:text-ink focus-visible:bg-ink/6"
                >
                  {t('appointments.cancel')}
                </button>
              </Popover.Close>
              <button
                type="submit"
                disabled={saving}
                className="h-9 rounded-full bg-surface-chip px-5 text-[14px] font-medium text-ink outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? t('appointments.saving') : t('appointments.save')}
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
