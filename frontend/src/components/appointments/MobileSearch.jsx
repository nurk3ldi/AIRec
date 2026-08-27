import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { listAppointments } from '../../lib/api'
import { authed } from '../../lib/auth'
import {
  formatPrice,
  stateOf,
  statusLabel,
  statusTone,
  toBlock,
} from '../../lib/appointments'
import { dayLabel } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import BookingDetail from './BookingDetail'
import { CONTROLS_HEIGHT } from './grid'

/**
 * Searching the calendar from a phone: a field where the controls were, and the
 * answers where the months were.
 *
 * **It searches bookings and only bookings.** `GET /appointments?query=` with
 * no date range deliberately drops the range entirely and looks across the
 * whole history — see the backend note — because looking for a client means
 * looking for every visit they ever made, not the ones inside whichever month
 * happened to be on screen. Nothing else on this page is searchable, and
 * nothing here pretends to reach the rest of the product.
 *
 * **It comes down over the calendar from the top edge**, and the calendar stays
 * mounted underneath — see the page. Sliding it from the indicators says the
 * field arrived from the top of the phone, which is where the bar it lands in
 * already was; leaving the way it came says it went back there. Opaque, so the
 * months behind are not scrolling through a list that has nothing to do with
 * them, and the × in the bar is the one way back.
 *
 * The query is debounced rather than sent per keystroke: a search over the
 * whole history is a real query, and «Айг» on the way to «Айгерим» is three
 * requests for an answer nobody was going to read.
 */

// Long enough that a name is mostly typed, short enough that the list feels
// like it is keeping up.
const DEBOUNCE_MS = 300
// One character matches most of the history and answers nothing. Two is where
// a query starts being a query.
const MIN_QUERY = 2

export default function MobileSearch({
  onClose,
  services,
  week,
  timeZone,
  onSaved,
  className = '',
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)

  // Opening a search field and then having to tap it is one tap too many: the
  // only reason this screen exists is that somebody wants to type.
  const field = useRef(null)
  useEffect(() => {
    field.current?.focus()
  }, [])

  useEffect(() => {
    const text = query.trim()
    if (text.length < MIN_QUERY) {
      setRows(null)
      setBusy(false)
      return
    }

    setBusy(true)
    let alive = true
    const timer = setTimeout(() => {
      authed((token) => listAppointments(token, { query: text }))
        .then((found) => {
          if (!alive) return
          setRows(found.map((row) => toBlock(row, timeZone)))
          setBusy(false)
        })
        .catch(() => {
          // Swallowed, like every other read on this page: an error banner over
          // a search box says less than an empty list does, and the fix is to
          // type again either way.
          if (!alive) return
          setRows([])
          setBusy(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query, timeZone])

  return (
    <div className={`flex flex-col ${className}`}>
      {/* The same room the toolbar had, so switching modes does not move the
          screen under the reader — see `CONTROLS_HEIGHT` in `grid.js`. */}
      <div
        style={{ height: CONTROLS_HEIGHT }}
        className="flex shrink-0 items-end gap-2 px-4 pb-2"
      >
        <div className="relative flex h-10 min-w-0 flex-1 items-center">
          <span className="pointer-events-none absolute left-3 grid place-items-center text-muted">
            <HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={2} />
          </span>
          <input
            ref={field}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={t('header.search')}
            aria-label={t('header.search')}
            // 16px up to `sm`, like every other field in this app: iOS zooms
            // the page when a smaller one takes focus and never zooms back.
            className="h-full w-full appearance-none rounded-full bg-surface-card pr-3 pl-9 text-[16px] text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={t('appointments.close')}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/8 text-ink outline-none transition-colors hover:bg-ink/14 focus-visible:bg-ink/14"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={2} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {/* Four states and each says a different thing: nothing typed yet,
            typing, nothing found, and the answers. The first is not an empty
            state — there is no result to be empty of — so it says what this
            searches rather than that it found nothing. */}
        {query.trim().length < MIN_QUERY ? (
          <p className="pt-8 text-center text-[13px] text-muted">
            {t('appointments.searchHint')}
          </p>
        ) : busy ? (
          <p className="pt-8 text-center text-[13px] text-muted">
            {t('appointments.searching')}
          </p>
        ) : rows?.length ? (
          <ul className="space-y-2">
            {rows.map((block) => (
              <li key={block.id}>
                <SearchRow
                  block={block}
                  services={services}
                  week={week}
                  timeZone={timeZone}
                  onSaved={onSaved}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="pt-8 text-center text-[13px] text-muted">
            {t('appointments.searchEmpty')}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * One booking in the results.
 *
 * **The date leads.** On the grid a booking's position says when it is, so the
 * card can spend its first line on the client; in a list of results pulled from
 * anywhere in the history there is no position, and "when" is the first thing
 * that has to be answered. The status keeps the colour it has everywhere else.
 *
 * Tapping opens the booking's detail, the same thing the day grid's cards
 * open — reading before writing, on the screen where a tap is the lightest
 * gesture there is. See `BookingDetail`.
 */
function SearchRow({ block, services, week, timeZone, onSaved }) {
  const [open, setOpen] = useState(false)
  const state = stateOf(block.status)

  return (
    <BookingDetail
      open={open}
      onOpenChange={setOpen}
      booking={block}
      services={services}
      week={week}
      timeZone={timeZone}
      onSaved={onSaved}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        // `active:` as well as `hover:` — the hover variant compiles inside
        // `@media (hover: hover)` and so never runs on the phone this screen
        // exists for, leaving the row with no answer to a finger at all.
        className={`w-full rounded-xl bg-surface-card px-3 py-2.5 text-left outline-none transition-[opacity,scale] duration-[160ms] ease-out hover:opacity-85 focus-visible:opacity-85 active:scale-[0.97] ${
          state === 'cancelled' ? 'opacity-45' : ''
        }`}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate font-display text-[14px] font-semibold text-ink">
            {dayLabel(new Date(`${block.day}T00:00:00`))}
          </span>
          <span className="shrink-0 font-display text-[14px] font-medium text-ink">
            {block.range}
          </span>
        </span>

        <span className="mt-1 block truncate text-[14px] text-ink">
          {block.client}
        </span>

        <span className="mt-1 flex items-baseline justify-between gap-2 text-[12px]">
          {/* The status keeps the colour it has on the grid — `statusTone` is
              the one map both read, so a booking cannot be orange in one place
              and grey in the other. */}
          <span
            className={`flex min-w-0 items-center gap-1.5 font-medium ${statusTone(block.status)}`}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
            />
            <span className="truncate">{statusLabel(block.status)}</span>
          </span>
          <span className="shrink-0 text-muted">{formatPrice(block.price)}</span>
        </span>

        <span className="mt-0.5 block truncate text-[12px] text-muted">
          {block.service}
        </span>
      </button>
    </BookingDetail>
  )
}
