import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import {
  formatDuration,
  formatPrice,
  statusLabel,
  statusTone,
} from '../../lib/appointments'
import { dayLabel } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import BookingPopover from './BookingPopover'
import Sheet from './Sheet'

/**
 * A booking, read before it is changed.
 *
 * **On a phone a tap opens this, not the editor.** The editor was doubling as
 * the detail view, which is the shape a desktop can afford: there a booking is
 * opened with a deliberate double click, the grid stays visible behind the
 * panel, and the fields are wide enough to read as a record. On a phone a tap
 * is the lightest gesture there is and the panel takes the whole screen — so
 * every glance at "who is at three" put a form over the day with seven live
 * inputs in it, one stray keystroke from changing something.
 *
 * Reading and writing are different acts and this is the reading one: no field
 * takes focus, nothing here can be typed into, and «Изменить» is the one way
 * from here to the other.
 *
 * **The editor opens beside it rather than inside it.** Two sheets stacked
 * would put a form over a detail over a day, and the way out of the middle one
 * would be a question. Closing this and opening that is one screen at a time,
 * and the editor's own close comes back to the day rather than to a summary of
 * what was just edited.
 */
export default function BookingDetail({
  booking,
  open,
  onOpenChange,
  services,
  week,
  timeZone,
  onSaved,
  children,
}) {
  const t = useT()
  const [editing, setEditing] = useState(false)

  return (
    <>
      {children}

      <Sheet
        open={open && !editing}
        onOpenChange={onOpenChange}
        label={t('appointments.detailTitle')}
        header={
          // **No heading in the bar, only the two things you can do with it.**
          // The word «Запись» named a sheet that opens from a booking and is
          // full of that booking's own facts — the client's name is the first
          // line under it in 24px — so it was a label for something already
          // labelled. The sheet still *has* a name: `Sheet` puts it in the
          // `Dialog.Title` Radix requires, where a screen reader announces it
          // and the screen does not have to spend a line on it.
          <div className="flex items-center justify-between gap-2 px-6 py-2.5">
            <button
              type="button"
              onClick={() => onOpenChange?.(false)}
              aria-label={t('appointments.close')}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/8 text-ink outline-none transition-colors hover:bg-ink/14 focus-visible:bg-ink/14"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={2} />
            </button>

            {/* **The one way from reading to writing**, and the word alone.
                It had a pencil beside it, which was saying the same thing
                twice — an icon earns its place where it replaces a word or
                where the word is too long for the room, and neither is true of
                «Изменить» in a bar with two circles and a title. */}
            <button
              type="button"
              onClick={() => {
                setEditing(true)
                onOpenChange?.(false)
              }}
              className="grid h-10 shrink-0 place-items-center rounded-full bg-surface-chip px-4 text-[14px] font-semibold text-ink outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85"
            >
              {t('appointments.edit')}
            </button>
          </div>
        }
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {/* **The client leads, then when, then what.** On the grid a card can
              open with the name because its position already says the time;
              here there is no position, so the order is who → when → what for →
              what it costs, which is the order the same facts are said in on
              the phone. */}
          <p className="pt-2 text-[24px] leading-tight font-bold tracking-[-0.02em] text-ink">
            {booking?.client}
          </p>

          <p
            className={`mt-2 flex items-center gap-1.5 text-[13px] font-medium ${statusTone(booking?.status)}`}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
            />
            {statusLabel(booking?.status)}
          </p>

          <dl className="mt-5 divide-y divide-line">
            <Row label={t('appointments.date')} value={booking && dayLabel(new Date(`${booking.day}T00:00:00`))} />
            <Row
              label={t('appointments.time')}
              value={
                booking &&
                `${booking.range} · ${formatDuration(booking.minutes)}`
              }
            />
            <Row label={t('appointments.service')} value={booking?.service} />
            <Row
              label={t('appointments.price')}
              value={booking && formatPrice(booking.price)}
            />
            <Row
              label={t('appointments.clientPhone')}
              value={booking?.phone}
              // A phone number is the one value here worth acting on rather
              // than only reading: this screen is most often opened because
              // somebody has to be called.
              href={booking?.phone ? `tel:${booking.phone}` : undefined}
            />
            <Row label={t('appointments.note')} value={booking?.note} />
          </dl>
        </div>
      </Sheet>

      {/* Rendered beside the detail rather than inside it — see the note above.
          `asAnchor` with nothing to anchor to: on a phone the editor is a sheet
          and takes no position from its trigger, so the child is only there
          because the component takes one. */}
      <BookingPopover
        asAnchor
        open={editing}
        onOpenChange={setEditing}
        booking={booking}
        services={services}
        week={week}
        timeZone={timeZone}
        onSaved={onSaved}
      >
        <span className="hidden" />
      </BookingPopover>
    </>
  )
}

/**
 * One fact about the booking.
 *
 * **A row with nothing in it is not drawn.** A note nobody wrote and a client
 * who gave no number are the ordinary case, and a list with «—» twice in it
 * reads as a record with holes rather than as a short record.
 */
function Row({ label, value, href }) {
  if (!value) return null

  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="shrink-0 text-[14px] text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[14px] text-ink">
        {href ? (
          <a
            href={href}
            className="text-ink underline decoration-line underline-offset-4 outline-none"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}
