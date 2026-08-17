import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { cancelAppointment, updateAppointment } from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import { DAY_NAMES, MONTHS_OF } from '../../lib/dates'

const formatPrice = (value) => `${value.toLocaleString('ru-RU')} ₸`

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} мин`
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

/**
 * `2026-08-17` → "Понедельник, 17 августа".
 *
 * Split by hand rather than fed to `new Date(key)`, which reads a bare
 * `YYYY-MM-DD` as UTC midnight and so names the previous day everywhere east
 * of Greenwich — which is everywhere this runs.
 */
const formatDay = (key) => {
  const [year, month, date] = key.split('-').map(Number)
  const day = new Date(year, month - 1, date)
  return `${DAY_NAMES[day.getDay()]}, ${date} ${MONTHS_OF[month - 1]}`
}

const STATUS = {
  pending: { label: 'Новая', pill: 'bg-[#3248F2]/10 text-[#3248F2]' },
  confirmed: { label: 'Подтверждена', pill: 'bg-[#16A34A]/10 text-[#16A34A]' },
  completed: { label: 'Завершена', pill: 'bg-[#999999]/15 text-[#171215]' },
  no_show: { label: 'Не пришёл', pill: 'bg-[#DC2626]/10 text-[#DC2626]' },
  cancelled: { label: 'Отменена', pill: 'bg-[#999999]/15 text-[#999999]' },
}

const SOURCE = { whatsapp: 'WhatsApp', manual: 'Вручную' }

/**
 * What each status lets the owner do next.
 *
 * Written as a table rather than a chain of conditions because the rule *is* a
 * table: a booking's status decides its moves entirely, and the one move that
 * matters most at each stage is the one that should look like the button.
 */
const ACTIONS = {
  pending: [
    { label: 'Подтвердить', status: 'confirmed', primary: true },
    { label: 'Отменить', status: 'cancelled' },
  ],
  confirmed: [
    { label: 'Завершить', status: 'completed', primary: true },
    { label: 'Не пришёл', status: 'no_show' },
    { label: 'Отменить', status: 'cancelled' },
  ],
  completed: [{ label: 'Вернуть', status: 'confirmed' }],
  no_show: [{ label: 'Вернуть', status: 'confirmed' }],
  cancelled: [{ label: 'Восстановить', status: 'confirmed', primary: true }],
}

/**
 * One booking, opened from the grid.
 *
 * A dialog rather than a panel below the month picker. The panel meant the
 * answer to "who is this?" appeared in the corner of the screen furthest from
 * the block that was clicked, and it grew and shrank the left column every time
 * a different booking was opened. A dialog puts the reply where the question
 * was asked, and leaves the calendar exactly as it was underneath.
 *
 * It is the same width as a form dialog would be but holds no form: everything
 * here is read, and the only writing is the row of buttons at the bottom, which
 * are one press each.
 */
export default function AppointmentDetails({ block, onClose, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const status = STATUS[block.status] ?? STATUS.completed

  const run = async (next) => {
    setBusy(true)
    setError('')
    try {
      const token = getAccessToken()
      // Cancelling has its own endpoint; everything else is a status patch.
      const row =
        next === 'cancelled'
          ? await cancelAppointment(token, block.id)
          : await updateAppointment(token, block.id, { status: next })
      onUpdated(row)
    } catch (err) {
      // Restoring a cancelled booking can lose the slot to someone else in the
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
            className="flex max-h-[calc(100vh-2rem)] w-[440px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(23,18,21,0.35)] outline-none"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5 pb-4">
              <div className="min-w-0">
                <Dialog.Title className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] text-[#171215]">
                  {block.client}
                </Dialog.Title>
                {block.phone && (
                  // A phone number on a calendar exists to be dialled, so it is
                  // a link rather than a string to copy out by hand.
                  <a
                    href={`tel:${block.phone.replace(/[^\d+]/g, '')}`}
                    className="mt-0.5 block truncate text-[14px] text-[#3248F2] outline-none hover:underline"
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

            <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#999999]/15 px-6 py-5">
              <span
                className={`inline-block rounded-md px-2.5 py-1 text-[12px] font-medium ${status.pill}`}
              >
                {status.label}
              </span>

              <dl className="mt-4 space-y-2.5">
                <Row term="Услуга" value={block.service} />
                {/* The date is in the dialog even though the calendar behind it
                    shows the same day: once this is a window over the whole
                    screen, the column it came from is no longer the thing being
                    read. */}
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
            </div>

            <div className="shrink-0 border-t border-[#999999]/15 px-6 py-4">
              {error && (
                <p role="alert" className="mb-2.5 text-[13px] text-[#DC2626]">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {(ACTIONS[block.status] ?? []).map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    disabled={busy}
                    onClick={() => run(action.status)}
                    className={`rounded-xl px-3 py-2 text-[13px] font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                      action.primary
                        ? 'bg-[#3248F2] text-white hover:bg-[#2839c9]'
                        : 'border border-[#999999]/30 text-[#171215] hover:bg-[#171215]/5'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
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
