import { useEffect, useState } from 'react'
import { getBusiness, listAppointments } from '../../lib/api'
import { formatPrice, toBlock } from '../../lib/appointments'
import { authed } from '../../lib/auth'
import { dayKey, sameDay, weekDays, weekdayLabels } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import { weekRevenue } from '../../lib/revenue'
import { useSkeleton } from '../../lib/skeleton'
import { CARD_EDGE } from '../card'
import Skeleton from '../Skeleton'

/** The panel's own rhythm for things that change while somebody is looking. */
const POLL_MS = 15000

/**
 * «Выручка» — what this week has taken and booked, against last week.
 *
 * The companion of «Загрузка» beside it: that card says how much of the week's
 * time is spoken for, this one what that time is worth. Same week, same
 * bookings, so the two read as one row rather than two subjects.
 *
 * **One bar per day, and only today's is solid.** The accent means "look
 * here", and a week of solid bars has nothing left to point with — the rest
 * wear ink at a fifth, which still compares them against each other.
 *
 * Reads `GET /business` for the zone, then two weeks of bookings — this one and
 * the one before, for the comparison — on mount and every 15 seconds while the
 * tab is visible.
 */
export default function RevenueCard({ className = '' }) {
  const t = useT()
  const [timeZone, setTimeZone] = useState(null)
  const [bookings, setBookings] = useState(null)

  const days = weekDays(new Date())
  const first = days[0]
  const from = dayKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() - 7))
  const to = dayKey(days[6])

  useEffect(() => {
    let alive = true
    authed(getBusiness)
      .then((row) => alive && setTimeZone(row.timezone))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    // A booking near midnight belongs to whichever day the business's zone
    // says, so nothing is read until the zone is known.
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

  const { pending, bars, reveal } = useSkeleton(!bookings)

  return (
    <section className={`${CARD_EDGE} flex flex-col overflow-hidden p-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{t('home.revenue')}</h2>
        <p className="truncate text-[13px] text-muted">{t('home.loadWeek')}</p>
      </div>

      {pending ? (
        <RevenueSkeleton visible={bars} />
      ) : (
        <RevenueChart
          revenue={weekRevenue({ days, bookings })}
          days={days}
          reveal={reveal}
        />
      )}
    </section>
  )
}

function RevenueChart({ revenue, days, reveal }) {
  const t = useT()
  const now = new Date()
  const labels = weekdayLabels()
  const peak = Math.max(...revenue.perDay)
  const { change } = revenue

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${reveal ? 'animate-content-reveal' : ''}`}>
      <p className="mt-3 truncate text-[24px] leading-none font-bold tracking-[-0.02em] text-ink tabular-nums">
        {formatPrice(revenue.total)}
      </p>
      {/* The delta line: green up, red down, then what it is measured
          against. Hidden rather than «+∞%» when last week took nothing. */}
      <p className="mt-2 h-4 truncate text-[13px] leading-4 text-muted">
        {change !== null && (
          <>
            <span
              className={`font-medium tabular-nums ${
                change > 0 ? 'text-ok' : change < 0 ? 'text-danger' : 'text-muted'
              }`}
            >
              {change > 0 ? '+' : ''}
              {change}%
            </span>{' '}
            {t('home.revenueVs')}
          </>
        )}
      </p>

      <div
        className="mt-4 flex min-h-0 flex-1 items-end gap-2"
        role="img"
        aria-label={`${t('home.revenue')}: ${formatPrice(revenue.total)}`}
      >
        {days.map((day, index) => {
          const value = revenue.perDay[index]
          const today = sameDay(day, now)
          return (
            <div key={index} className="flex h-full min-w-0 flex-1 flex-col items-center">
              <div className="flex min-h-0 w-full flex-1 items-end justify-center">
                <div
                  title={formatPrice(value)}
                  className={`w-full max-w-7 rounded-full ${
                    today ? 'bg-ink' : value > 0 ? 'bg-ink/20' : 'bg-ink/8'
                  }`}
                  // A day with nothing is a stub of the track rather than no
                  // bar at all, so seven columns always read as a week.
                  style={{
                    height: peak > 0 && value > 0 ? `max(8px, ${(value / peak) * 100}%)` : '6px',
                  }}
                />
              </div>
              <span
                className={`pt-1.5 text-[11px] leading-none ${
                  today ? 'font-semibold text-ink' : 'font-medium text-muted'
                }`}
              >
                {labels[index]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The card's own shape while the weeks are on their way: total, delta, bars. */
function RevenueSkeleton({ visible }) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      aria-busy="true"
    >
      <Skeleton className="mt-3 h-6 w-36" />
      <Skeleton className="mt-2 h-4 w-28" />
      <Skeleton className="mt-4 min-h-0 w-full flex-1 rounded-[8px]" />
    </div>
  )
}
