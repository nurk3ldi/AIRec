import { useEffect, useState } from 'react'
import { getBusiness, getWorkingHours, listAppointments } from '../../lib/api'
import { toBlock } from '../../lib/appointments'
import { authed } from '../../lib/auth'
import { dayKey, sameDay, weekDays, weekdayLabels } from '../../lib/dates'
import { getLocale, useT } from '../../lib/i18n'
import { useSkeleton } from '../../lib/skeleton'
import { weekLoad } from '../../lib/workload'
import { CARD_EDGE } from '../card'
import Skeleton from '../Skeleton'

/** The panel's own rhythm for things that change while somebody is looking. */
const POLL_MS = 15000

/**
 * The fill of an hour cell. Monochrome, like the rest of the product: an open
 * empty hour is the faint track, a full one is solid ink, and the steps between
 * are ink at a rising share — so the darkest cells are the busiest without a
 * colour having to mean "busy".
 */
const fillOf = (share) =>
  `color-mix(in oklab, var(--color-ink) ${Math.round(8 + Math.min(1, share) * 92)}%, transparent)`

/**
 * «Загрузка» — how full this week is, as one number and a map of hours.
 *
 * **Columns are the days, rows the hours** the business is open in any of
 * them, so the map is the working week's own shape: a day off is an empty
 * column, a lunch break a gap across it. Closed hours draw nothing — not a
 * hatch, which at this size is noise — and only an hour with something booked
 * outside opening time fills a cell there.
 *
 * Reads `GET /business` (zone and capacity) and the week once, and the week's
 * bookings on mount and every 15 seconds while the tab is visible.
 */
export default function LoadCard({ className = '' }) {
  const t = useT()
  const [business, setBusiness] = useState(null)
  const [hours, setHours] = useState(null)
  const [bookings, setBookings] = useState(null)

  const days = weekDays(new Date())
  const from = dayKey(days[0])
  const to = dayKey(days[6])
  const timeZone = business?.timezone

  useEffect(() => {
    let alive = true
    authed(getBusiness)
      .then((row) => alive && setBusiness(row))
      .catch(() => {})
    authed(getWorkingHours)
      .then((rows) => alive && setHours(rows))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    // Placing a booking on a day needs the business's zone; reading before it
    // arrives would file a late-evening booking under the wrong date.
    if (!timeZone) return undefined
    let alive = true
    const read = () =>
      authed((token) => listAppointments(token, { from, to }))
        .then((rows) => alive && setBookings(rows.map((row) => toBlock(row, timeZone))))
        .catch(() => {})
    const wake = () => document.visibilityState === 'visible' && read()
    read()
    const timer = setInterval(wake, POLL_MS)
    document.addEventListener('visibilitychange', wake)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [from, to, timeZone])

  const loading = !business || !hours || !bookings
  const { pending, bars, reveal } = useSkeleton(loading)
  const load = loading
    ? null
    : weekLoad({ days, hours, bookings, capacity: business.capacity })

  return (
    <section className={`${CARD_EDGE} flex flex-col overflow-hidden p-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{t('home.load')}</h2>
        <p className="truncate text-[13px] text-muted">{t('home.loadWeek')}</p>
      </div>

      {pending ? (
        <LoadSkeleton visible={bars} />
      ) : load.first >= load.last ? (
        <p className="m-auto text-center text-[13px] text-muted">{t('home.loadNone')}</p>
      ) : (
        <LoadMap load={load} days={days} reveal={reveal} />
      )}
    </section>
  )
}

function LoadMap({ load, days, reveal }) {
  const t = useT()
  const now = new Date()
  const labels = weekdayLabels()
  const rows = load.last - load.first
  // Landmarks, not a ruler: a label every two hours on a working day, every
  // three when the week runs round the clock.
  const step = rows > 14 ? 3 : 2
  const number = new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 })
  const clock = (hour) => `${String(hour).padStart(2, '0')}:00`

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${reveal ? 'animate-content-reveal' : ''}`}
    >
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[24px] leading-none font-bold tracking-[-0.02em] text-ink tabular-nums">
          {load.percent}%
        </span>
        <span className="truncate text-[13px] text-muted tabular-nums">
          {t('home.loadHours', {
            used: number.format(load.takenMinutes / 60),
            open: number.format(load.openMinutes / 60),
          })}
        </span>
      </div>

      <div
        className="mt-4 grid min-h-0 flex-1 gap-[3px]"
        style={{
          gridTemplateColumns: 'auto repeat(7, minmax(0, 1fr))',
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr)) auto`,
        }}
        role="img"
        aria-label={`${t('home.load')}: ${load.percent}%`}
      >
        {Array.from({ length: rows }, (_, row) => {
          const hour = load.first + row
          return [
            <span
              key={`h${hour}`}
              className="-mt-1.5 pr-1.5 text-right text-[11px] leading-none text-muted tabular-nums"
            >
              {hour % step === 0 ? hour : ''}
            </span>,
            ...days.map((day, column) => {
              const cell = load.cells[column][row]
              const current = sameDay(day, now) && now.getHours() === hour
              const filled = cell.open || cell.share > 0
              return (
                <span
                  key={`${column}-${hour}`}
                  title={
                    filled
                      ? `${labels[column]} ${clock(hour)} — ${Math.round(Math.min(1, cell.share) * 100)}%`
                      : undefined
                  }
                  // The current hour's ring is two shadows — a gap in the
                  // card's own fill, then ink — rather than an outline: a
                  // shadow's corners grow from the cell's radius and stay
                  // concentric, where an offset outline drew them sharp.
                  className={`min-h-0 rounded-[6px] ${
                    current
                      ? 'shadow-[0_0_0_1.5px_var(--color-surface-raised),0_0_0_3px_var(--color-ink)]'
                      : ''
                  }`}
                  style={filled ? { background: fillOf(cell.share) } : undefined}
                />
              )
            }),
          ]
        })}

        <span />
        {days.map((day, column) => (
          <span
            key={`d${column}`}
            className={`pt-1 text-center text-[11px] leading-none ${
              sameDay(day, now) ? 'font-semibold text-ink' : 'font-medium text-muted'
            }`}
          >
            {labels[column]}
          </span>
        ))}
      </div>
    </div>
  )
}

/** The card's own shape while the week is on its way: the number, then the map. */
function LoadSkeleton({ visible }) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      aria-busy="true"
    >
      <Skeleton className="mt-3 h-6 w-28" />
      <Skeleton className="mt-4 min-h-0 w-full flex-1 rounded-[8px]" />
    </div>
  )
}
