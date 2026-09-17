import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, domMax, LazyMotion, m, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'
import {
  listAppointments,
  listConversations,
  updateAppointment,
  updateConversation,
} from '../../lib/api'
import { authed } from '../../lib/auth'
import { BOOKING_COLORS, formatPrice, tintOf } from '../../lib/appointments'
import { dayKey } from '../../lib/dates'
import { getLocale, useT } from '../../lib/i18n'
import { haptic } from '../../lib/haptics'
import { project, SPRING } from '../../lib/motion'
import { useSkeleton } from '../../lib/skeleton'
import { CARD_EDGE } from '../card'
import Skeleton, { SkeletonRegion } from '../Skeleton'
import Switch from '../Switch'


/**
 * How far a swipe has to be *heading* for the request to close — a share of the
 * card's width, asked of where the throw lands rather than where the finger
 * stopped, so a short flick works and a slow drag back does not.
 */
const BACK_SHARE = 0.35

/** The panel's own rhythm for things that change while somebody is looking. */
const POLL_MS = 15000
/** How far ahead a request can be: past the booking horizon nothing is filed. */
const AHEAD_DAYS = 90

/**
 * The booking requests the assistant has filed and nobody has answered, by the
 * chat they were agreed in. Re-read every 15 seconds while the tab is visible;
 * a failed read keeps what is on screen.
 */
function usePending() {
  const [rows, setRows] = useState([])

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
 * **The chats themselves — what this card lists.** Every open conversation,
 * newest first: a client writing to the bot is a стрим the moment they write,
 * whether or not it ever becomes a booking. `null` until the first answer.
 */
function useThreads() {
  const [threads, setThreads] = useState(null)

  useEffect(() => {
    let alive = true
    const read = () =>
      authed((token) =>
        listConversations(token, { archived: false, deleted: false, limit: 100 }),
      )
        .then((all) => {
          if (!alive) return
          setThreads(
            [...all].sort(
              (a, b) => Date.parse(b.last_message_at ?? 0) - Date.parse(a.last_message_at ?? 0),
            ),
          )
        })
        .catch(() => setThreads((was) => was ?? []))
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

/**
 * A colour for the dot beside a client's name, from the booking palette.
 *
 * **Picked from the id, not at random and not from the row's position.** A
 * colour that changed on every render would be noise, and one taken from the
 * position would repaint every row left behind when a request is answered.
 */
function dotColor(id) {
  let hash = 0
  for (const character of String(id)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return tintOf(BOOKING_COLORS[hash % BOOKING_COLORS.length])
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
  const [requests, setRequests, reread] = usePending()
  // Which request is open. `null` is the list; a request takes the whole card,
  // and «Назад» comes back — a split view would leave each half too narrow for
  // a message and a price at a quarter of the page.
  const [openId, setOpenId] = useState(null)
  const [rows, setThreads] = useThreads()

  /** The request the assistant filed in this chat, if it filed one. */
  const requestOf = (row) => requests.find((item) => item.conversation_id === row.id) ?? null

  // Optimistic, like every switch here: it moves under the finger, and a
  // failed save puts it back.
  const toggleAi = (row) => {
    const next = !row.assistant_enabled
    const put = (value) =>
      setThreads((was) =>
        (was ?? []).map((item) =>
          item.id === row.id ? { ...item, assistant_enabled: value } : item,
        ),
      )
    put(next)
    authed((token) => updateConversation(token, row.id, { assistant_enabled: next })).catch(
      () => put(!next),
    )
  }
  const { pending, bars, reveal } = useSkeleton(rows === null)
  const reduce = useReducedMotion()
  // Where the swipe-back is measured against, and whether the last haptic has
  // already been spent on crossing the point of no return.
  const stage = useRef(null)
  const armed = useRef(false)
  const [scrolled, setScrolled] = useState(false)

  const chosen = rows?.find((row) => row.id === openId) ?? null
  const request = chosen ? requestOf(chosen) : null

  /** How the list and the request trade places: a drill-down, so it arrives
   *  from the right and leaves the same way — the path a press to «Назад» or a
   *  swipe takes it back along. Under reduced motion nothing travels. */
  const step = (direction) =>
    reduce
      ? { opacity: 0 }
      : { opacity: 0, x: direction * (stage.current?.offsetWidth ?? 320) * 0.25 }

  const onDrag = (event, info) => {
    const width = stage.current?.offsetWidth ?? 320
    const past = info.offset.x + project(info.velocity.x) > width * BACK_SHARE
    // One tick on crossing, held by a ref so it cannot repeat per frame.
    if (past && !armed.current) haptic('snap')
    armed.current = past
  }

  const onDragEnd = (event, info) => {
    const width = stage.current?.offsetWidth ?? 320
    armed.current = false
    if (info.offset.x + project(info.velocity.x) > width * BACK_SHARE) setOpenId(null)
  }

  /** Answering the request a chat carries; the chat itself stays in the list. */
  const decide = (request, status) => {
    setRequests(requests.filter((item) => item.id !== request.id))
    // A decision is the one moment here worth a haptic: it is finished, and it
    // reaches a client.
    haptic('commit')
    authed((token) => updateAppointment(token, request.id, { status })).catch(reread)
  }

  return (
    <section className={`${CARD_EDGE} flex flex-col overflow-hidden ${className}`}>
      {/* The heading sits where «Ассистент» and «Лимит» sit on the cards beside
          it: 16px down from the card's own edge, not centred in a bar of its
          own. */}
      {!chosen && (
        <header className="flex shrink-0 items-center gap-2 px-5 pt-4 pb-2">
          <h2 className="text-[15px] font-semibold text-ink">{t('confirm.title')}</h2>
          {/* How many are waiting, against the right edge and in ink — it is a
              count somebody acts on, not a caption. */}
          {rows && rows.length > 0 && (
            <span className="ml-auto rounded-md bg-ink/10 px-1.5 text-[12px] leading-5 font-medium text-ink tabular-nums">
              {rows.length}
            </span>
          )}
        </header>
      )}

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
        // `domMax`, not `domAnimation`: the smaller bundle leaves out drag, and
        // the swipe back is a drag.
        <LazyMotion features={domMax} strict>
        <div
          ref={stage}
          className={`relative min-h-0 flex-1 overflow-hidden ${reveal ? 'animate-content-reveal' : ''}`}
        >
        {/* **A drill-down, so it travels.** The request arrives from the right
            and leaves the same way — the path «Назад» and the swipe take it
            back along — on the critically damped spring this app uses for
            everything a hand can touch. Both layers are present at once
            (`popLayout`), so neither waits for the other. */}
        <AnimatePresence initial={false} mode="popLayout">
          {/* The list, every request soonest first — the whole card until one
              of them is opened. Two columns of equal width, parted down the
              middle: a request is two short lines, and one column of them left
              half the card empty. The line is on the box that does *not*
              scroll, so it runs the card's full height however long the list
              gets, and the list itself scrolls when there are more requests
              than fit. */}
          {!chosen && (
          <m.div
            key="list"
            initial={step(-1)}
            animate={{ opacity: 1, x: 0 }}
            exit={step(-1)}
            transition={SPRING}
            className="absolute inset-0"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-2 left-1/2 w-px bg-card-edge"
            />
            {/* A scroll edge rather than a rule under the heading: the first
                row fades out as it goes under it, and there is nothing to see
                while the list sits at the top. */}
            <ul
              onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
              className={`grid h-full grid-flow-row auto-rows-min grid-cols-2 content-start gap-x-4 overflow-y-auto p-2 pt-0 transition-[mask-image] duration-200 [scrollbar-gutter:stable_both-edges] ${
                scrolled
                  ? '[mask-image:linear-gradient(to_bottom,transparent_0,black_20px)]'
                  : ''
              }`}
            >
            {rows.map((row, index) => {
              const on = row.assistant_enabled
              // The hairline under a row is dropped for the last row of each
              // column, so the list does not end on a line.
              const lastRow = index >= rows.length - (rows.length % 2 === 0 ? 2 : 1)
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
                    className="my-0.5 flex w-full flex-col gap-1 rounded-[10px] px-3 py-2.5 text-left outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-ink/8 focus-visible:bg-ink/8 active:scale-[0.98]"
                  >
                    {/* Two lines, as in Notes: the client on the first, then
                        what they wrote last on the second, with when
                        against the right edge. */}
                    <span className="flex min-w-0 items-center gap-2 pr-28">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: dotColor(row.id) }}
                      />
                      <span className="truncate text-[14px] font-medium text-ink">
                        {row.client_name || t('chat.noName')}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="min-w-0 truncate text-[13px] text-muted">
                        {row.last_message_preview || '—'}
                      </span>
                      <span className="ml-auto shrink-0 text-[13px] font-medium text-ink tabular-nums">
                        {chatTime(row.last_message_at)}
                      </span>
                    </span>
                  </button>
                  <span className="absolute top-[11px] right-3 flex items-center gap-2">
                      <span aria-hidden="true" className="text-[12px] text-ink">
                        {t('confirm.aiLabel')}
                      </span>
                    <Switch
                      size="sm"
                      checked={on}
                      onChange={() => toggleAi(row)}
                      label={t('confirm.aiSwitch')}
                    />
                  </span>
                  {/* The hairline between rows starts where the text does and
                      stops short of the edge, so the list reads as one block
                      rather than as boxes. */}
                  {!lastRow && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-card-edge"
                    />
                  )}
                </li>
              )
            })}
            </ul>
          </m.div>
          )}

          {/* One request, whole, across the card, and the two answers. It can
              be dragged back with a finger: 1:1 rightwards, resisted the other
              way, and it closes on where the throw was heading rather than on
              how far it got. */}
          {chosen && (
            <m.div
              key={chosen.id}
              initial={step(1)}
              animate={{ opacity: 1, x: 0 }}
              exit={step(1)}
              transition={SPRING}
              // The gesture stays under reduced motion — a movement somebody
              // is making with their own finger is not vestibular; only the
              // entrance and the exit stop travelling.
              drag="x"
              dragDirectionLock
              dragMomentum={false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 0.85 }}
              onDrag={onDrag}
              onDragEnd={onDragEnd}
              className="absolute inset-0 flex touch-pan-y flex-col"
            >
              {/* Details scroll; the two answers stay pinned under them, so a
                  short card never hides the buttons below its edge. */}
              <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-5 pt-4">
                {/* The client names the screen, and the way back sits at the end
                    of that line — one row rather than a heading over a heading. */}
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.01em] text-ink">
                    {chosen.client_name || t('chat.noName')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpenId(null)}
                    className="touch-target relative -mr-1.5 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[14px] font-medium text-ink outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97]"
                  >
                    <HugeiconsIcon icon={ArrowLeft02Icon} size={15} strokeWidth={2.2} />
                    {t('confirm.back')}
                  </button>
                </div>
                {/* What there is to decide about this chat. With a request
                    filed, the booking it would make; without one, the chat
                    itself and a line saying there is nothing to answer yet. */}
                <dl className="mt-3 flex flex-col divide-y divide-card-edge">
                  {request ? (
                    <>
                      <Row label={t('confirm.service')} value={request.service_name} />
                      <Row
                        label={t('confirm.when')}
                        value={`${whenLabel(request.starts_at).split(', ').slice(0, -1).join(', ')}, ${spanLabel(request)}`}
                      />
                      <Row label={t('confirm.price')} value={formatPrice(request.price)} />
                    </>
                  ) : (
                    <>
                      <Row
                        label={t('confirm.lastMessage')}
                        value={chosen.last_message_preview || '—'}
                      />
                      <Row
                        label={t('confirm.when')}
                        value={chatTime(chosen.last_message_at) || '—'}
                      />
                      <Row
                        label={t('confirm.request')}
                        value={<span className="text-muted">{t('confirm.noRequest')}</span>}
                      />
                    </>
                  )}
                </dl>
              </div>

              {/* The three answers in one row: the chat it was agreed in, and
                  the two decisions. */}
              <div className="flex shrink-0 gap-2 border-t border-card-edge p-3">
                <button
                  type="button"
                  onClick={() => navigate(`/inbox?chat=${chosen.id}`)}
                  className="h-10 flex-1 rounded-[10px] bg-ink/8 text-[14px] font-medium text-ink outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-ink/12 focus-visible:bg-ink/12 active:scale-[0.97]"
                >
                  {t('confirm.openChat')}
                </button>
                {request && (
                <>
                <button
                  type="button"
                  onClick={() => decide(request, 'cancelled')}
                  // Red, because declining is the one answer here that tells a
                  // client no — and it is a tint, not a filled red button: the
                  // loud shape belongs to the ordinary answer beside it.
                  className="h-10 flex-1 rounded-[10px] bg-danger/12 text-[14px] font-medium text-danger outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-danger/20 focus-visible:bg-danger/20 active:scale-[0.97]"
                >
                  {t('confirm.decline')}
                </button>
                <button
                  type="button"
                  onClick={() => decide(request, 'confirmed')}
                  className="h-10 flex-1 rounded-[10px] bg-ink text-[14px] font-medium text-surface outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-90 focus-visible:opacity-90 active:scale-[0.97]"
                >
                  {t('confirm.approve')}
                </button>
                </>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
        </div>
        </LazyMotion>
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
