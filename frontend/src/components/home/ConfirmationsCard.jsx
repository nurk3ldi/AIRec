import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { listAppointments, updateAppointment } from '../../lib/api'
import { authed } from '../../lib/auth'
import { formatPrice } from '../../lib/appointments'
import { dayKey } from '../../lib/dates'
import { getLocale, useT } from '../../lib/i18n'
import { useSkeleton } from '../../lib/skeleton'
import { CARD_EDGE } from '../card'
import Skeleton, { SkeletonRegion } from '../Skeleton'

/** The panel's own rhythm for things that change while somebody is looking. */
const POLL_MS = 15000
/** How far ahead a request can be: past the booking horizon nothing is filed. */
const AHEAD_DAYS = 90

/**
 * Booking requests waiting for the owner's word, soonest first. `null` until
 * the first answer. Re-read every 15 seconds while the tab is visible; a
 * failed read keeps what is on screen.
 */
function usePending() {
  const [rows, setRows] = useState(null)

  const read = () => {
    const today = new Date()
    const until = new Date(today)
    until.setDate(until.getDate() + AHEAD_DAYS)
    return authed((token) =>
      listAppointments(token, {
        from: dayKey(today),
        to: dayKey(until),
        status: ['pending'],
      }),
    )
      .then((all) =>
        setRows(
          [...all].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
        ),
      )
      .catch(() => setRows((was) => was ?? []))
  }

  useEffect(() => {
    read()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') read()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [])

  return [rows, setRows, read]
}

/** «Сегодня, 14:00» / «Завтра, 14:00» / «Пт, 19 сентября, 14:00». */
function whenLabel(iso) {
  const at = new Date(iso)
  const locale = getLocale()
  const clock = at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(at)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((day - today) / 86400000)
  const date =
    diff >= 0 && diff <= 1
      ? new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diff, 'day')
      : at.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' })
  return `${date.charAt(0).toUpperCase()}${date.slice(1)}, ${clock}`
}

/** «14:00–14:30», or the start alone for a booking with no end. */
function spanLabel(row) {
  const locale = getLocale()
  const clock = (iso) =>
    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return row.ends_at ? `${clock(row.starts_at)}–${clock(row.ends_at)}` : clock(row.starts_at)
}

/**
 * Requests the assistant agreed with clients, waiting for the owner to say yes.
 *
 * **Split in two**: the list of every request on the left, the one chosen on the
 * right with everything the booking will be — who, what, when, for how much —
 * and the two answers. Confirming makes it `confirmed`; declining makes it
 * `cancelled`, which gives the time back. Either way the backend has the
 * assistant tell the client in their own chat, so the press here is the whole
 * of the owner's part.
 *
 * **The row leaves at once** and the next one is chosen, so a queue of requests
 * is worked through without reaching for the list between them; the server's
 * answer is a confirmation, and a failure re-reads rather than guessing.
 */
export default function ConfirmationsCard({ className = '' }) {
  const t = useT()
  const navigate = useNavigate()
  const [rows, setRows, reread] = usePending()
  const [chosenId, setChosenId] = useState(null)
  const { pending, bars, reveal } = useSkeleton(rows === null)

  const chosen = rows?.find((row) => row.id === chosenId) ?? rows?.[0] ?? null

  const decide = (row, status) => {
    const index = rows.findIndex((item) => item.id === row.id)
    const rest = rows.filter((item) => item.id !== row.id)
    setRows(rest)
    setChosenId(rest[Math.min(index, rest.length - 1)]?.id ?? null)
    authed((token) => updateAppointment(token, row.id, { status })).catch(reread)
  }

  return (
    <section className={`${CARD_EDGE} flex flex-col overflow-hidden ${className}`}>
      <header className="flex h-12 shrink-0 items-center gap-2 px-5">
        <h2 className="text-[15px] font-semibold text-ink">{t('confirm.title')}</h2>
        {rows && rows.length > 0 && (
          <span className="rounded-md bg-ink/8 px-1.5 text-[12px] leading-5 text-muted tabular-nums">
            {rows.length}
          </span>
        )}
      </header>

      {rows === null || pending ? (
        <SkeletonRegion
          visible={bars}
          label={t('confirm.title')}
          className="flex min-h-0 flex-1 flex-col sm:flex-row"
        >
          <div className="flex flex-col gap-1 p-2 sm:w-[42%] sm:border-r sm:border-card-edge">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex flex-col gap-2 rounded-[10px] px-3 py-3">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
          <div className="hidden flex-1 flex-col gap-3 p-5 sm:flex">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3.5 w-1/4" />
          </div>
        </SkeletonRegion>
      ) : rows.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
          <p className={`text-[14px] text-muted ${reveal ? 'animate-content-reveal' : ''}`}>
            {t('confirm.empty')}
          </p>
        </div>
      ) : (
        <div
          className={`flex min-h-0 flex-1 flex-col sm:flex-row ${reveal ? 'animate-content-reveal' : ''}`}
        >
          {/* Left: every request, soonest first. */}
          <ul className="flex max-h-[45%] shrink-0 flex-col gap-1 overflow-y-auto border-b border-card-edge p-2 sm:max-h-none sm:w-[42%] sm:border-r sm:border-b-0">
            {rows.map((row) => {
              const selected = row.id === chosen?.id
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setChosenId(row.id)}
                    aria-current={selected || undefined}
                    className={`flex w-full flex-col gap-0.5 rounded-[10px] px-3 py-2.5 text-left outline-none transition-[background-color,scale] duration-150 ease-out active:scale-[0.98] ${
                      selected ? 'bg-ink/8' : 'hover:bg-ink/5 focus-visible:bg-ink/5'
                    }`}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[14px] font-medium text-ink">
                        {row.client_name || t('chat.noName')}
                      </span>
                      <span className="ml-auto shrink-0 text-[12px] text-muted">
                        {whenLabel(row.starts_at)}
                      </span>
                    </span>
                    <span className="truncate text-[13px] text-muted">{row.service_name}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Right: the chosen request, whole, and the two answers. */}
          {chosen && (
            <div key={chosen.id} className="flex min-h-0 flex-1 flex-col">
              {/* Details scroll; the two answers stay pinned under them, so a
                  short card never hides the buttons below its edge. */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
                <p className="text-[18px] font-semibold tracking-[-0.01em] text-ink">
                  {chosen.client_name || t('chat.noName')}
                </p>
                {chosen.client_phone && (
                  <a
                    href={`tel:${chosen.client_phone}`}
                    className="mt-0.5 w-fit text-[14px] text-muted hover:text-ink"
                  >
                    {chosen.client_phone}
                  </a>
                )}

                <dl className="mt-3 flex flex-col divide-y divide-card-edge">
                  <Row label={t('confirm.service')} value={chosen.service_name} />
                  <Row
                    label={t('confirm.when')}
                    value={`${whenLabel(chosen.starts_at).split(', ').slice(0, -1).join(', ')}, ${spanLabel(chosen)}`}
                  />
                  <Row label={t('confirm.price')} value={formatPrice(chosen.price)} />
                </dl>

                {chosen.conversation_id && (
                  <button
                    type="button"
                    onClick={() => navigate(`/inbox?chat=${chosen.conversation_id}`)}
                    className="mt-2 mb-3 flex w-fit items-center gap-1.5 rounded-md text-[13px] font-medium text-ink outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97]"
                  >
                    {t('confirm.openChat')}
                    <HugeiconsIcon icon={ArrowRight02Icon} size={14} strokeWidth={2} />
                  </button>
                )}
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-card-edge p-3">
                <button
                  type="button"
                  onClick={() => decide(chosen, 'cancelled')}
                  className="h-10 rounded-[10px] bg-ink/8 text-[14px] font-medium text-ink outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-ink/12 focus-visible:bg-ink/12 active:scale-[0.97]"
                >
                  {t('confirm.decline')}
                </button>
                <button
                  type="button"
                  onClick={() => decide(chosen, 'confirmed')}
                  className="h-10 rounded-[10px] bg-ink text-[14px] font-medium text-surface outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-90 focus-visible:opacity-90 active:scale-[0.97]"
                >
                  {t('confirm.approve')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[14px] text-ink">{value}</dd>
    </div>
  )
}
