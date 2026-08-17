import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { cancelAppointment, updateAppointment } from '../../lib/api'
import { getAccessToken } from '../../lib/auth'

const formatPrice = (value) => `${value.toLocaleString('ru-RU')} ₸`

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} мин`
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
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
 * Sits under the month picker rather than in a column of its own: a third
 * column would take its width from the grid, which is the part of this screen
 * that actually needs it — and the space under the calendar was empty anyway.
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
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-[#171215]">
              {block.client}
            </p>
            {block.phone && (
              // A phone number on a calendar exists to be dialled, so it is a
              // link rather than a string to copy out by hand.
              <a
                href={`tel:${block.phone.replace(/[^\d+]/g, '')}`}
                className="mt-0.5 block truncate text-[14px] text-[#3248F2] outline-none hover:underline"
              >
                {block.phone}
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#999999] outline-none transition-colors hover:bg-[#171215]/6 hover:text-[#171215]"
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

        <span
          className={`mt-3 inline-block rounded-md px-2.5 py-1 text-[12px] font-medium ${status.pill}`}
        >
          {status.label}
        </span>

        <dl className="mt-4 space-y-2.5 border-t border-[#999999]/15 pt-4">
          <Row term="Услуга" value={block.service} />
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
    </div>
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
