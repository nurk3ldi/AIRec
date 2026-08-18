import { useState } from 'react'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Archive02Icon,
  Cancel01Icon,
  Chat01Icon,
  Delete02Icon,
  PencilEdit02Icon,
} from '@hugeicons/core-free-icons'
import BookingPanel from './BookingPanel'
import { deleteAppointment, updateAppointment } from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import {
  formatDuration,
  formatPrice,
  statusLabel,
} from '../../lib/appointments'
import { DAY_NAMES, MONTHS_OF } from '../../lib/dates'

/**
 * One booking, opened from its card in the day column.
 *
 * The card itself carries no Edit button any more. A card in a list is a thing
 * to *recognise* — a name, a time, a colour — and hanging every action off it
 * turns eight of them into eight rows of controls. Opening one is the act that
 * says which booking you mean; only then is there one booking for the buttons
 * to be about.
 *
 * The window is read-only until Редактировать is pressed, and then it becomes
 * the same form the «+» opens, in the same place. It doesn't close and reopen:
 * you are still looking at the booking you asked for.
 */

/** `2026-08-18` → a local `Date`. Split by hand because `new Date(key)` reads a
 *  bare `YYYY-MM-DD` as UTC midnight, naming the previous day east of
 *  Greenwich — which is everywhere this runs. */
const parseDay = (key) => {
  const [year, month, date] = key.split('-').map(Number)
  return new Date(year, month - 1, date)
}

export default function BookingDetails({
  block,
  color,
  timeZone,
  onClose,
  onSaved,
}) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const [archiving, setArchiving] = useState(false)

  /** Out of the calendar's way, or back into it. */
  const toggleArchive = async () => {
    setArchiving(true)
    setError('')
    try {
      await updateAppointment(getAccessToken(), block.id, {
        archived: !block.archived,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
      setArchiving(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    setError('')
    try {
      await deleteAppointment(getAccessToken(), block.id)
      onSaved()
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <BookingPanel
        modal
        booking={block}
        date={parseDay(block.day)}
        timeZone={timeZone}
        className="w-full"
        // Back to the booking, not out to the calendar: the window was opened
        // to look at this one, and cancelling an edit hasn't changed that.
        onClose={() => setEditing(false)}
        onSaved={onSaved}
      />
    )
  }

  const day = parseDay(block.day)
  const dead = block.status === 'cancelled'

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] ring-1 ring-[#999999]/20">
      <div className="px-5 pt-4 pb-3.5">
        {/* The booking's own colour, the same bar its card wears, so the window
            is visibly about the row that was pressed. */}
        <span
          className="block h-1.5 w-full rounded-full"
          style={{ backgroundColor: color }}
        />

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`truncate text-[20px] font-semibold tracking-[-0.02em] ${
                dead ? 'text-[#999999] line-through' : 'text-[#171215]'
              }`}
            >
              {block.client}
            </p>
            <p className="mt-1 truncate text-[14px] text-[#999999]">
              {block.service}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mt-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#999999] transition-colors outline-none hover:bg-[#171215]/6 hover:text-[#171215] focus-visible:ring-2 focus-visible:ring-[#3248F2]"
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              size={18}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </button>
        </div>
      </div>

      {/* Dashed, like the form this window turns into — the two are readings of
          the same booking, and a solid rule in this product means two different
          subjects. */}
      <div className="border-t border-dashed border-[#999999]/35 px-5 py-3">
        <Row label="Дата">
          {DAY_NAMES[day.getDay()]}, {day.getDate()} {MONTHS_OF[day.getMonth()]}{' '}
          {day.getFullYear()}
        </Row>
        <Row label="Время">
          <span className="tabular-nums">
            {block.from} – {block.to}
          </span>
          <span className="ml-2 text-[#999999]">
            {formatDuration(block.minutes)}
          </span>
        </Row>
        <Row label="Статус">{statusLabel(block.status)}</Row>
        <Row label="Стоимость">{formatPrice(block.price)}</Row>
        {block.phone && (
          <Row label="Телефон">
            <span className="tabular-nums">{block.phone}</span>
          </Row>
        )}
        {block.note && <Row label="Заметка">{block.note}</Row>}
      </div>

      <div className="border-t border-dashed border-[#999999]/35 px-5 pt-3.5 pb-4">
        {error && (
          <p role="alert" className="mb-2.5 text-[12px] text-[#DC2626]">
            {error}
          </p>
        )}

        {/* Deleting asks first, and asks *in place* rather than in a second
            dialog over this one: the question is about the booking already on
            screen, and stacking a window over it would hide what is being
            deleted. The row it replaces is the row it belongs to. */}
        {confirming ? (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-[13px] text-[#171215]">
              Удалить запись? Это нельзя отменить.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="rounded-xl bg-[#999999]/15 px-4 py-2 text-[13px] font-medium text-[#171215] transition-colors outline-none hover:bg-[#999999]/25 focus-visible:ring-2 focus-visible:ring-[#3248F2] disabled:opacity-45"
              >
                Нет
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="rounded-xl bg-[#DC2626] px-4 py-2 text-[13px] font-medium text-white transition-colors outline-none hover:bg-[#b91c1c] focus-visible:ring-2 focus-visible:ring-[#171215] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {deleting ? 'Удаляем…' : 'Удалить'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href="/inbox"
                className="flex min-w-0 items-center gap-2 rounded-lg bg-[#999999]/15 px-3 py-2 text-[13px] font-medium text-[#171215] transition-colors outline-none hover:bg-[#999999]/25 focus-visible:ring-2 focus-visible:ring-[#3248F2]"
              >
                <span className="truncate">Диалог</span>
                <HugeiconsIcon
                  icon={Chat01Icon}
                  size={15}
                  strokeWidth={2}
                  className="shrink-0 text-[#171215]"
                />
              </Link>

              {/* Between the link and the bin, as asked — and the order is the
                  order of consequence: open the conversation, put the booking
                  away, destroy it. */}
              <button
                type="button"
                onClick={toggleArchive}
                disabled={archiving}
                aria-label={
                  block.archived ? 'Вернуть из архива' : 'В архив'
                }
                className="flex shrink-0 items-center gap-2 rounded-lg bg-[#999999]/15 px-3 py-2 text-[13px] font-medium text-[#171215] transition-colors outline-none hover:bg-[#999999]/25 focus-visible:ring-2 focus-visible:ring-[#3248F2] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="truncate">
                  {block.archived ? 'Из архива' : 'Архив'}
                </span>
                <HugeiconsIcon
                  icon={Archive02Icon}
                  size={15}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  className="shrink-0 text-[#171215]"
                />
              </button>

              {/* An icon on its own, and the only red on the card. It is the
                  one action here that cannot be taken back, so it is kept
                  small and away from the button the hand goes to. */}
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label="Удалить запись"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#999999] transition-colors outline-none hover:bg-[#DC2626]/10 hover:text-[#DC2626] focus-visible:ring-2 focus-visible:ring-[#DC2626]"
              >
                <HugeiconsIcon
                  icon={Delete02Icon}
                  size={16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-[#3248F2] px-5 py-2 text-[13px] font-medium text-white transition-colors outline-none hover:bg-[#2839c9] focus-visible:ring-2 focus-visible:ring-[#171215] focus-visible:ring-offset-2"
            >
              <HugeiconsIcon
                icon={PencilEdit02Icon}
                size={15}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
              Редактировать
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-baseline gap-3 py-2">
      <p className="w-[86px] shrink-0 text-[13px] text-[#999999]">{label}</p>
      <p className="min-w-0 flex-1 text-[14px] break-words text-[#171215]">
        {children}
      </p>
    </div>
  )
}
