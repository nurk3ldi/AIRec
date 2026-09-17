import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft02Icon, ArrowRight02Icon } from '@hugeicons/core-free-icons'
import {
  listAppointments,
  listConversations,
  updateAppointment,
  updateConversation,
} from '../../lib/api'
import { authed } from '../../lib/auth'
import { formatPrice } from '../../lib/appointments'
import { dayKey } from '../../lib/dates'
import { getLocale, useT } from '../../lib/i18n'
import { useSkeleton } from '../../lib/skeleton'
import { CARD_EDGE } from '../card'
import Skeleton, { SkeletonRegion } from '../Skeleton'
import Switch from '../Switch'

// --- DEMO: delete this block once real requests arrive -----------------------
/**
 * Two invented requests so the card can be seen with something in it while no
 * real request exists. Shown **only when the real list is empty**, never mixed
 * into real ones, and answering one touches nothing on the server.
 */
function demoRows() {
  const at = (days, hours, minutes) => {
    const start = new Date()
    start.setDate(start.getDate() + days)
    start.setHours(hours, minutes, 0, 0)
    return start
  }
  const row = (id, client_name, service_name, price, start, last_message, minutesAgo) => ({
    id,
    demo: true,
    last_message,
    last_message_at: new Date(Date.now() - minutesAgo * 60000).toISOString(),
    client_name,
    client_phone: null,
    service_name,
    price,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 30 * 60000).toISOString(),
    conversation_id: null,
  })
  return [
    row('demo-1', 'Nurkeldi', 'Service 1', 5000, at(1, 14, 0), 'Можно завтра в 14:00?', 4),
    row('demo-2', 'Unknown', 'Service 1', 8000, at(2, 11, 30), 'Здравствуйте, запишите меня', 26 * 60),
  ]
}
// --- end DEMO -----------------------------------------------------------------

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

/**
 * The chats behind the requests, by id: what was said last and whether the
 * assistant is on in that thread. Read with the same rhythm as the requests.
 */
function useThreads() {
  const [threads, setThreads] = useState({})

  useEffect(() => {
    let alive = true
    const read = () =>
      authed((token) =>
        listConversations(token, { archived: false, deleted: false, limit: 100 }),
      )
        .then((rows) => {
          if (!alive) return
          setThreads(Object.fromEntries(rows.map((row) => [row.id, row])))
        })
        .catch(() => {})
    read()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') read()
    }, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  return [threads, setThreads]
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

/** When a message was sent: the clock today, «Вчера» / a short date before. */
function chatTime(iso) {
  if (!iso) return ''
  const at = new Date(iso)
  const locale = getLocale()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(at)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((today - day) / 86400000)
  if (diff === 0) return at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) {
    const word = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day')
    return `${word.charAt(0).toUpperCase()}${word.slice(1)}`
  }
  return at.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
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
  const [realRows, setRows, reread] = usePending()
  // DEMO: the invented rows stand in only while nothing real is waiting, each
  // until it has been answered once.
  const [demoDone, setDemoDone] = useState([])
  const rows =
    realRows && realRows.length === 0
      ? demoRows().filter((row) => !demoDone.includes(row.id))
      : realRows
  // Which request is open. `null` is the list; a request takes the whole card,
  // and «Назад» comes back — a split view would leave each half too narrow for
  // a message and a price at a quarter of the page.
  const [openId, setOpenId] = useState(null)
  const [threads, setThreads] = useThreads()
  // DEMO: the invented rows' switches live here, since they have no thread.
  const [demoAi, setDemoAi] = useState({})

  /** The last thing said in the request's chat, and when; nothing without a chat. */
  const lastMessage = (row) =>
    row.demo ? row.last_message : threads[row.conversation_id]?.last_message_preview
  const lastMessageAt = (row) =>
    row.demo ? row.last_message_at : threads[row.conversation_id]?.last_message_at

  /** Whether the assistant is on in that chat; `null` when there is no chat. */
  const aiOn = (row) => {
    if (row.demo) return demoAi[row.id] ?? true
    const thread = threads[row.conversation_id]
    return thread ? thread.assistant_enabled : null
  }

  // Optimistic, like every switch here: it moves under the finger, and a
  // failed save puts it back.
  const toggleAi = (row) => {
    const next = !aiOn(row)
    if (row.demo) {
      setDemoAi((was) => ({ ...was, [row.id]: next }))
      return
    }
    const id = row.conversation_id
    const put = (value) =>
      setThreads((was) => ({ ...was, [id]: { ...was[id], assistant_enabled: value } }))
    put(next)
    authed((token) => updateConversation(token, id, { assistant_enabled: next })).catch(() =>
      put(!next),
    )
  }
  const { pending, bars, reveal } = useSkeleton(rows === null)

  const chosen = rows?.find((row) => row.id === openId) ?? null

  const decide = (row, status) => {
    // Answered, so the card goes back to the list — there is nothing left to
    // look at on this one.
    setOpenId(null)
    if (row.demo) {
      setDemoDone((done) => [...done, row.id])
      return
    }
    setRows(rows.filter((item) => item.id !== row.id))
    authed((token) => updateAppointment(token, row.id, { status })).catch(reread)
  }

  return (
    <section className={`${CARD_EDGE} flex flex-col overflow-hidden ${className}`}>
      <header className="flex h-12 shrink-0 items-center gap-2 px-5">
        {chosen ? (
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="-ml-1.5 flex items-center gap-1 rounded-md px-1.5 py-1 text-[15px] font-semibold text-ink outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97]"
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={2.2} />
            {t('confirm.back')}
          </button>
        ) : (
          <>
            <h2 className="text-[15px] font-semibold text-ink">{t('confirm.title')}</h2>
            {rows && rows.length > 0 && (
              <span className="rounded-md bg-ink/8 px-1.5 text-[12px] leading-5 text-muted tabular-nums">
                {rows.length}
              </span>
            )}
          </>
        )}
      </header>

      {rows === null || pending ? (
        <SkeletonRegion
          visible={bars}
          label={t('confirm.title')}
          className="flex min-h-0 flex-1 flex-col gap-1 p-2"
        >
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-2 rounded-[10px] px-3 py-3">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </SkeletonRegion>
      ) : rows.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
          <p className={`text-[14px] text-muted ${reveal ? 'animate-content-reveal' : ''}`}>
            {t('confirm.empty')}
          </p>
        </div>
      ) : (
        <div
          key={chosen ? 'one' : 'list'}
          className={`flex min-h-0 flex-1 flex-col ${chosen ? 'animate-content-reveal' : ''} ${
            reveal ? 'animate-content-reveal' : ''
          }`}
        >
          {/* The list, every request soonest first — the whole card until one
              of them is opened. */}
          {!chosen && (
          <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
            {rows.map((row) => {
              const on = aiOn(row)
              return (
                // The switch is a sibling laid over the row, not a child of its
                // button: a button inside a button is not valid, and a press on
                // the switch must not also choose the row.
                <li key={row.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenId(row.id)}
                    // No fill at rest, the chosen one included — the details on
                    // the right already say which it is. Grey only under the
                    // cursor or keyboard focus, and hairlines part the rows.
                    className="my-1 flex w-full flex-col gap-1 rounded-[10px] px-3 py-2.5 text-left outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-ink/8 focus-visible:bg-ink/8 active:scale-[0.98]"
                  >
                    {/* Two lines, as in Notes: the client on the first, then
                        when they last wrote and what they said on the second —
                        the time in ink, the message grey after it. */}
                    <span className="truncate pr-32 text-[14px] font-medium text-ink">
                      {row.client_name || t('chat.noName')}
                    </span>
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-[13px] font-medium text-ink tabular-nums">
                        {chatTime(lastMessageAt(row))}
                      </span>
                      <span className="min-w-0 truncate text-[13px] text-muted">
                        {lastMessage(row) || '—'}
                      </span>
                    </span>
                  </button>
                  {on !== null && (
                    <span className="absolute top-[13px] right-3 flex items-center gap-2">
                      <span aria-hidden="true" className="text-[12px] text-muted">
                        {t('confirm.aiLabel')}
                      </span>
                      <Switch
                        size="sm"
                        checked={on}
                        onChange={() => toggleAi(row)}
                        label={t('confirm.aiSwitch')}
                      />
                    </span>
                  )}
                  {/* The hairline between rows starts where the text does and
                      stops short of the edge, so the list reads as one block
                      rather than as boxes. */}
                  {row.id !== rows[rows.length - 1].id && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-card-edge"
                    />
                  )}
                </li>
              )
            })}
          </ul>
          )}

          {/* One request, whole, across the card, and the two answers. */}
          {chosen && (
            <div className="flex min-h-0 flex-1 flex-col">
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
