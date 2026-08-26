import { useEffect, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as Select from '@radix-ui/react-select'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  Cancel01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
} from '../../lib/api'
import { authed } from '../../lib/auth'
import {
  BOOKING_STATES,
  BOOKING_TINT_MIX,
  BOOKING_TINTS,
  fromMinutes,
  instantAt,
  parseClock,
  stateOf,
} from '../../lib/appointments'
import { useT } from '../../lib/i18n'
import { FIELD, FIELD_ERROR } from '../controls'
import DateField from './DateField'
import ServiceField from './ServiceField'
import TimeField from './TimeField'
import { PANEL_MOTION } from './panel'

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
  asAnchor = false,
  open: openProp,
  onOpenChange,
  booking,
  onDayChange,
  services,
  timeZone,
  onSaved,
}) {
  const t = useT()
  const editing = Boolean(booking)

  // **Two ways in, and they need different plumbing.** The add button clicks,
  // so it is a `Popover.Trigger` and the panel owns its own boolean — a page
  // holding one for it would be a page that knows about a control two
  // components down. A booking card opens on a *double* click, which no
  // trigger listens for, so it is a `Popover.Anchor` and the boolean lives
  // with the card. `??` rather than `||`, or a controlled `false` would fall
  // through to the internal state and the panel would never close.
  const [selfOpen, setSelfOpen] = useState(false)
  const open = openProp ?? selfOpen
  const setOpen = onOpenChange ?? setSelfOpen

  const [date, setDate] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [price, setPrice] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [note, setNote] = useState('')
  const [color, setColor] = useState('')
  const [status, setStatus] = useState('confirmed')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const active = services?.filter((item) => item.is_active) ?? []
  const service = active.find((item) => item.id === serviceId)

  /**
   * Choosing from the price list fills the fields; the fields are still the
   * truth.
   *
   * **Either pick or type, for the name and for the money both.** The list is
   * what the business usually sells, and a day contains things it sells once —
   * a one-off job, a favour, a price agreed on the phone. Making the list the
   * only way in would mean inventing a permanent service to record a single
   * afternoon.
   *
   * So the row is a shortcut into two ordinary inputs rather than a value of
   * its own. `service_id` still travels with the booking when one was chosen,
   * because that is the link to a living service — but the name and the price
   * that get snapshotted are whatever is in the boxes.
   */
  const choose = (item) => {
    setServiceId(item.id)
    setServiceName(item.name)
    setPrice(String(item.price))
  }

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

  // Opening is what fills the form — from the booking when there is one, from
  // nothing when there is not. Keeping the last booking's client in the boxes
  // would be a saved draft nobody asked for, and the second booking of a day is
  // rarely for the same person.
  //
  // **Everything starts blank when adding, the date included.** Seeding the one
  // service a new business happens to have was a value nobody entered, and a
  // price that had not been agreed is the kind of default that gets saved by
  // accident.
  useEffect(() => {
    if (!open) return
    setDate(booking?.day ?? '')
    setServiceId(booking?.serviceId ?? '')
    setServiceName(booking?.service ?? '')
    setPrice(booking ? String(booking.price) : '')
    setStartsAt(booking?.from ?? '')
    setEndsAt(booking?.to ?? '')
    setClientName(booking?.client ?? '')
    setClientPhone(booking?.phone ?? '')
    setNote(booking?.note ?? '')
    setColor(booking?.color ?? '')
    setStatus(booking ? stateOf(booking.status) : 'confirmed')
    setConfirmingDelete(false)
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
    if (!serviceName.trim()) problems.service = t('appointments.required')
    if (price === '') problems.price = t('appointments.required')
    if (!startsAt || !endsAt) problems.time = t('appointments.required')
    else if (parseClock(startsAt) === parseClock(endsAt))
      problems.time = t('appointments.sameTime')
    if (!clientName.trim()) problems.clientName = t('appointments.required')
    setFields(problems)
    if (Object.keys(problems).length > 0) return

    setSaving(true)
    setError('')

    // **The same body either way.** A PATCH is a partial update, but the panel
    // holds every field of the booking, so sending all of them says exactly
    // what is on screen — and a form that sent only what it thought had changed
    // would be a form deciding what "changed" means.
    const body = {
      // Null when the name was typed rather than chosen: the booking still
      // carries what it was called and what it cost, it simply has no living
      // service to point at.
      service_id: serviceId || null,
      service_name: serviceName.trim(),
      price: Number(price),
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
      // Empty means "no mark", which the API stores as null — a booking that
      // was coloured and then cleared has to be able to say so, and `''` is not
      // a colour the server knows.
      color: color || null,
      // Only when editing. A booking being written now has not happened yet, so
      // the four states are not a choice anyone can make about it — its status
      // is whatever the API's default says a new booking is.
      ...(editing ? { status } : {}),
    }

    try {
      await authed((token) =>
        editing
          ? updateAppointment(token, booking.id, body)
          : createAppointment(token, body),
      )
      onSaved?.()
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
  /**
   * Removing the booking outright, in two presses.
   *
   * **Not a status change.** Cancelling keeps the row, because it is what the
   * owner looks back on to see how often bookings fall through; this is for one
   * that should never have existed — a typo, a duplicate, a test. Leaving that
   * as a cancellation would put a client in the history who was never booked.
   *
   * The two presses are the confirmation. A dialog inside a popover is a layer
   * on a layer for a question with two words in it, and a single red button
   * next to Save is one slip away from deleting somebody's afternoon.
   */
  const remove = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }

    setSaving(true)
    setError('')
    try {
      await authed((token) => deleteAppointment(token, booking.id))
      onSaved?.()
      setOpen(false)
    } catch (err) {
      setError(err.message)
      setConfirmingDelete(false)
    } finally {
      setSaving(false)
    }
  }

  const pickDate = (value) => {
    setDate(value)
    // `T00:00:00` is load-bearing: a bare `YYYY-MM-DD` is parsed as UTC, which
    // is the previous day for anyone west of Greenwich and the wrong column.
    if (value) onDayChange?.(new Date(`${value}T00:00:00`))
  }

  return (
    // **`modal`, which is what stops the page scrolling underneath.** Radix
    // locks scroll everywhere outside the panel while it is open — including
    // the timetable's own scroll box, which is the one that matters: the edit
    // panel is anchored to a *card inside that box*, so a wheel turn slides its
    // anchor out from under it and the panel chases the card across the screen.
    //
    // It costs the half of "a popover, not a modal" that was about the page
    // staying usable — outside content is inert while this is open. The other
    // half is the one that mattered and it is kept: no scrim, so the grid
    // behind is still legible, which is how you know which day and hour you are
    // writing for.
    <Popover.Root open={open} onOpenChange={setOpen} modal>
      {asAnchor ? (
        <Popover.Anchor asChild>{children}</Popover.Anchor>
      ) : (
        <Popover.Trigger asChild>{children}</Popover.Trigger>
      )}

      <Popover.Portal>
        {/* No scrim. The page behind stays readable *and* usable — that is the
            difference between this and the modal it replaced, and dimming it
            would take back the only reason to anchor the panel at all. */}
        <Popover.Content
          // The date and service fields open their own popovers into portals,
          // so Escape has to be told which layer it is for: without this a
          // press meant for an open month would close the whole panel with it.
          onEscapeKeyDown={(event) => {
            if (document.querySelector('[data-nested-overlay]')) {
              event.preventDefault()
            }
          }}
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
          aria-label={t(
            editing ? 'appointments.editTitle' : 'appointments.newTitle',
          )}
          className={`z-[60] flex max-h-[var(--radix-popover-content-available-height)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] outline-none ${PANEL_MOTION}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3">
            <p className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
              {t(editing ? 'appointments.editTitle' : 'appointments.newTitle')}
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
            {/* **What it is, first.** The reference opens with the event's own
                name in a plain full-width field, and everything that is a
                *setting about* it becomes a row underneath. The same split
                works here: a booking is a service at a price, and the rest —
                when, what colour, what became of it — are settings about that. */}
            <Group error={fields.service ?? fields.service_name}>
              <ServiceField
                value={serviceName}
                onChange={(next) => {
                  setServiceName(next)
                  // Typing a name unhooks the row: this is no longer that
                  // service, it is one the owner is describing. The price is
                  // deliberately *not* unhooked the same way — a different
                  // amount for the same service is a discount, not a different
                  // service.
                  setServiceId('')
                }}
                onPick={choose}
                services={active}
                chosenId={serviceId}
                invalid={Boolean(fields.service_name)}
                label={t('appointments.service')}
              />
            </Group>

            <Group error={fields.price}>
              {/* Digits only, and no thousands separators while it is being
                  typed: a field that reformats under the caret is a field that
                  moves the caret. The list above shows the formatted figure,
                  which is where it is read rather than written. */}
              <div className="relative">
                <input
                  value={price}
                  onChange={(event) =>
                    setPrice(event.target.value.replace(/\D/g, '').slice(0, 9))
                  }
                  inputMode="numeric"
                  placeholder={t('appointments.price')}
                  autoComplete="off"
                  className={`${fields.price ? FIELD_ERROR : FIELD} h-9 pr-8 text-[14px]`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[14px] text-muted">
                  ₸
                </span>
              </div>
            </Group>

            {/* **The day gets a line of its own, and the two clocks share
                one.** They were on one row together — a label, a date and a
                start time — and the date was the field that lost: three
                controls on a 400px row left it a shrunken box showing its
                calendar glyph and nothing else, which is a date field that
                cannot say what date it holds.

                Split, each row holds one question. The day is a full-width
                field like the service and the price above it, because it is the
                same kind of thing: a value the booking has, not a setting about
                it. And the two clocks are back on one line, which is how a span
                is read — *from* something *to* something — with the dash
                between them saying so.

                There is no end *date* and there should not be: a booking that
                runs past midnight is written with an end clock earlier than its
                start and the arithmetic wraps, so a second date field would be
                offering a value nothing reads. */}
            <Group>
              <DateField
                value={date}
                onChange={pickDate}
                label={t('appointments.date')}
              />
            </Group>

            <Group error={fields.time ?? fields.starts_at}>
              <div className="flex items-center gap-2">
                <TimeField
                  value={startsAt}
                  onChange={setStartsAt}
                  label={t('appointments.start')}
                />
                {/* The span, in one character. Both fields carry their own name
                    while they are empty, and once they are filled it is the
                    dash that says which way round they run. */}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-[14px] text-muted"
                >
                  —
                </span>
                <TimeField
                  value={endsAt}
                  onChange={setEndsAt}
                  label={t('appointments.end')}
                />
              </div>
            </Group>

            {/* Both answer a question with a small closed set — a label and
                a field of the same build as every other field on the panel; see
                the note on `PanelSelect`. The colour is offered when adding as
                well as when editing; the status only when editing, because a
                booking being written down has not happened yet and none of the
                four is a thing anyone can say about it. */}
            <PanelSelect
              label={t('appointments.color')}
              // `'none'` on the wire and `''` in the form: Radix will not take
              // an empty string as an item value, and the API wants `null`.
              value={color || 'none'}
              onChange={(next) => setColor(next === 'none' ? '' : next)}
              options={[
                { id: 'none', label: t('appointments.colorNone'), dot: null },
                ...Object.entries(BOOKING_TINTS).map(([name, tint]) => ({
                  id: name,
                  label: t(`color.${name}`),
                  dot: tint,
                })),
              ]}
            />

            {editing && (
              <PanelSelect
                label={t('appointments.status')}
                value={status}
                onChange={setStatus}
                options={BOOKING_STATES.map((state) => ({
                  id: state.id,
                  label: t(STATUS_KEYS[state.id]),
                }))}
              />
            )}

            {/* **Who, last.** The reference keeps its free text — the URL, the
                notes — below the settings for the same reason: they are the
                part nobody has to fill in, and putting them first makes a short
                form look long. */}
            <Group error={fields.client_name ?? fields.clientName}>
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                maxLength={120}
                placeholder={t('appointments.clientName')}
                autoComplete="off"
                className={`${
                  fields.client_name || fields.clientName ? FIELD_ERROR : FIELD
                } h-9 text-[14px]`}
              />
            </Group>

            <Group error={fields.client_phone}>
              <input
                value={clientPhone}
                onChange={(event) => setClientPhone(event.target.value)}
                type="tel"
                maxLength={32}
                placeholder={t('appointments.clientPhone')}
                autoComplete="off"
                className={`${fields.client_phone ? FIELD_ERROR : FIELD} h-9 text-[14px]`}
              />
            </Group>

            <Group error={fields.note}>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder={t('appointments.note')}
                className={`${FIELD} h-auto resize-none py-2 text-[14px] leading-snug`}
              />
            </Group>

            {error && (
              <p className="mb-3 text-[13px] text-danger" role="alert">
                {error}
              </p>
            )}

            {/* **Buttons in a row, sharing the width evenly.** The reference
                puts its two side by side across the foot of the panel rather
                than huddled at one corner, which is what makes a 400px column
                read as finished rather than as cut off. Delete joins the same
                row when there is something to delete, and takes the width from
                the other two rather than a corner of its own.

                It is still the leftmost, and still two presses: beside Save,
                one slip is the difference between keeping a booking and losing
                it. */}
            <div className="mt-1 flex shrink-0 items-center gap-2">
              {editing && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={saving}
                  className="h-10 flex-1 rounded-xl bg-danger/10 px-3 text-[14px] font-medium text-danger outline-none transition-colors hover:bg-danger/20 focus-visible:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t(
                    confirmingDelete
                      ? 'appointments.deleteConfirm'
                      : 'appointments.delete',
                  )}
                </button>
              )}

              <Popover.Close asChild>
                <button
                  type="button"
                  className="h-10 flex-1 rounded-xl bg-ink/[0.06] px-3 text-[14px] font-medium text-ink outline-none transition-colors hover:bg-ink/12 focus-visible:bg-ink/12"
                >
                  {t('appointments.cancel')}
                </button>
              </Popover.Close>

              <button
                type="submit"
                disabled={saving}
                className="h-10 flex-1 rounded-xl bg-surface-chip px-3 text-[14px] font-semibold text-ink outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
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

/**
 * A settings-style row: a label, and a closed set of answers behind a chevron.
 *
 * **Written once because there are two of them**, and two rows built separately
 * are two rows that agree until one is restyled.
 *
 * **The trigger wears `FIELD`, the same ring every other control on this panel
 * has.** It was bare text with a chevron after it — the shape «Настройки» uses
 * — and that shape belongs to a list of settings, where the rules between rows
 * are what make each one a row. Dropped among seven bordered fields it read as
 * a caption rather than as something you could press, and the panel looked like
 * a form with two sentences fallen into the middle of it.
 *
 * **The label is inside the field, on the left, and the answer is on the
 * right.** A select always has a value, so there is no empty state a
 * placeholder could fill the way the other fields' do — the label has to be
 * visible next to its answer permanently. Outside the field it needed a column
 * of its own, which made these two rows the only ones on the panel that were
 * not simply a field the full width of it. Inside, the row is that field again
 * and the split does the labelling: muted name on the left, ink answer against
 * the right edge, which is the shape a settings row has always had.
 *
 * An option may carry a `dot` — a colour, drawn at the strength the grid will
 * actually paint it, so what the list shows is what the card becomes.
 */
function PanelSelect({ label, value, onChange, options }) {
  const current = options.find((option) => option.id === value)

  return (
    <div className="mb-3">
      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger
          aria-label={label}
          className={`${FIELD} flex h-9 w-full cursor-pointer items-center gap-2 text-[14px] outline-none`}
        >
          {/* Muted, and never truncated: it is the shorter of the two and the
              one that must always be readable — a row whose answer has eaten
              its question is a row you cannot use. */}
          <span className="shrink-0 text-muted">{label}</span>

          {/* The answer, held to the right edge. `ml-auto` on the group rather
              than `flex-1` on the value, so a long option truncates from its
              own end instead of dragging the chevron off with it. */}
          <span className="ml-auto flex min-w-0 items-center gap-2">
            {current?.dot && <Dot tint={current.dot} />}
            <Select.Value className="truncate text-ink" />
            <Select.Icon asChild>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={15}
                strokeWidth={2}
                className="shrink-0 text-muted"
              />
            </Select.Icon>
          </span>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            align="end"
            sideOffset={6}
            // Above the panel's own `z-[60]`, and tagged so one Escape closes
            // this list rather than the panel with it.
            data-nested-overlay
            className="z-[70] max-h-[240px] min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)]"
          >
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item
                  key={option.id}
                  value={option.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[14px] text-ink outline-none select-none data-[highlighted]:bg-ink/6"
                >
                  {option.dot !== undefined && <Dot tint={option.dot} />}
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="ml-auto text-ink">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={15}
                      strokeWidth={2.4}
                    />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}

/** The colour itself, at the strength a booking card is tinted with. `null` is
 *  "no colour" and shows the plain card fill inside a hairline. */
function Dot({ tint }) {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 rounded-full shadow-[0_0_0_1px_var(--color-line)]"
      style={{
        backgroundColor: tint
          ? `color-mix(in oklab, ${tint} ${BOOKING_TINT_MIX}%, var(--color-surface-card))`
          : 'var(--color-surface-card)',
      }}
    />
  )
}

/** The four states' labels, keyed by id — the same map `StatusFilter` keeps,
 *  and for the same reason: `BOOKING_STATES` carries Russian of its own, which
 *  is right for code with no `t` to call and wrong on a panel that is not. */
const STATUS_KEYS = {
  confirmed: 'booking.active',
  completed: 'booking.completed',
  no_show: 'booking.noShow',
  cancelled: 'booking.cancelled',
}

/**
 * A field and, under it, whatever is wrong with it.
 *
 * **It used to carry a label above the control; the placeholder carries it
 * now.** Seven uppercase captions down a 400px panel was a second column of
 * text to read past, and each one repeated a word the empty field could say
 * itself. The label comes back the moment the field is cleared, which is the
 * only time it was doing any work.
 *
 * The trade is real and worth naming: a placeholder disappears as soon as there
 * is a value, so a filled field no longer says what it is. That is fine on this
 * panel — seven fields in a fixed order that anyone adding a booking fills in
 * every day — and would not be on a form somebody meets once.
 */
function Group({ error, children }) {
  return (
    <div className="mb-3">
      {children}
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}
