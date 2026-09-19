import { useEffect, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { ToolButton, ViewSwitch } from '../appointments/MobileToolbar'
import BookingPopover from '../appointments/BookingPopover'
import MobileSearch from '../appointments/MobileSearch'
import WeekStrip from '../appointments/WeekStrip'
import { getBusiness, getServices, getWorkingHours, listAppointments } from '../../lib/api'
import { toBlock } from '../../lib/appointments'
import { authed } from '../../lib/auth'
import { dayKey, dayLabel, sameDay, weekDays } from '../../lib/dates'
import { CROSSFADE, SPRING } from '../../lib/motion'
import { freeWindows } from '../../lib/schedule'
import { useT } from '../../lib/i18n'
import { CARD_EDGE } from '../card'

/**
 * «Записи» на главной — день, как его показывает телефон на `/appointments`.
 *
 * **Сверху одна строка дней во всю ширину карточки** — тот же `WeekStrip`, что
 * над списком на телефоне, без ручки, раскрывающей месяц: карточка в половину
 * экрана, и месяц съел бы место, ради которого она стоит. Под днями с записями
 * — точка; отменённые не считаются, как и на «Записях».
 *
 * Читает `GET /appointments` за неделю выбранного дня (и `GET /business` ради
 * часового пояса — запись около полуночи иначе встала бы не на тот день).
 */
/** Below this a gap is not a window anybody can sell — the agenda's own floor. */
const MIN_GAP_MINUTES = 15

export default function DayCard({ className = '' }) {
  const t = useT()
  const [day, setDay] = useState(() => new Date())
  const [timeZone, setTimeZone] = useState(undefined)
  const [bookings, setBookings] = useState([])
  // What the booking panel and the search need: the price list and the week.
  const [services, setServices] = useState(null)
  const [hours, setHours] = useState(null)
  const [searching, setSearching] = useState(false)
  // Calendar or list — the phone toolbar's own switch. The card draws the list
  // for now; the calendar view is what this choice will open next.
  const [view, setView] = useState('list')
  const [reload, setReload] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    let alive = true
    authed(getBusiness)
      .then((row) => alive && setTimeZone(row.timezone))
      .catch(() => {})
    authed(getServices)
      .then((rows) => alive && setServices(rows))
      .catch(() => {})
    authed(getWorkingHours)
      .then((rows) => alive && setHours(rows))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const week = weekDays(day)
  const from = dayKey(week[0])
  const to = dayKey(week[6])

  useEffect(() => {
    let alive = true
    authed((token) => listAppointments(token, { from, to }))
      .then((rows) => alive && setBookings(rows.map((row) => toBlock(row, timeZone))))
      .catch(() => alive && setBookings([]))
    return () => {
      alive = false
    }
  }, [from, to, timeZone, reload])

  // ‹ › step the strip a whole week, keeping the weekday: the strip shows a
  // week, so a week is what one press of its arrow moves.
  const shiftWeek = (weeks) =>
    setDay((was) => new Date(was.getFullYear(), was.getMonth(), was.getDate() + weeks * 7))

  const marked = new Set(
    bookings.filter((row) => row.status !== 'cancelled').map((row) => row.day),
  )

  const saved = () => setReload((n) => n + 1)

  // The day's counts, worked out the way the phone's agenda does them: a
  // cancelled booking gave its hour back, an open-ended one claims no stretch,
  // and today only the windows still ahead count.
  const now = new Date()
  const isToday = sameDay(day, now)
  const ofDay = bookings.filter((b) => b.day === dayKey(day))
  const busy = ofDay
    .filter((b) => b.status !== 'cancelled' && !b.open)
    .map((b) => [b.start, b.end])
  const dayHours = hours?.find((row) => row.weekday === (day.getDay() + 6) % 7)
  const gaps = freeWindows(
    dayHours,
    busy,
    isToday ? now.getHours() * 60 + now.getMinutes() : 0,
  ).filter(([from, to]) => to - from >= MIN_GAP_MINUTES)
  const counted = ofDay.filter((b) => b.status !== 'cancelled')

  return (
    <section
      className={`${CARD_EDGE} relative flex flex-col overflow-hidden p-4 ${className}`}
    >
      {/* Верхняя строка: неделя — компактно, у левого края; справа место
          для «Сегодня», поиска и «+», которые встанут туда следующими. */}
      <div className="flex items-start gap-4">
        {/* Up to 60% of the row, and it gives way first when the buttons
            beside it need the room — a fixed 60% pushed «+» off the card. */}
        <div className="min-w-0 max-w-[60%] flex-1">
          <WeekStrip
            day={day}
            onDayChange={setDay}
            marked={marked}
            compact
            className="-ml-2"
          />
        </div>
        {/* **Two capsules of one height, Apple Calendar's toolbar.** Moving
            through time is one group — ‹ Сегодня › — and acting on the card is
            the other — view, search, «+». Same 36px, same quiet fill, same
            32px buttons inside: before, two loose circles and a taller pill
            were three shapes arguing in one row. */}
        {/* Centred on the whole strip's height — letters and dates
            together — so the capsules sit in the middle of the calendar. */}
        <div className="ml-auto flex shrink-0 -translate-y-1.5 items-center gap-2 self-center">
          <div className="flex items-center rounded-full bg-ink/8 p-0.5">
            <ToolButton
              small
              icon={ArrowLeft01Icon}
              label={t('appointments.prev')}
              onClick={() => shiftWeek(-1)}
            />
            <button
              type="button"
              onClick={() => setDay(new Date())}
              aria-current={sameDay(day, new Date()) ? 'date' : undefined}
              className="touch-target relative h-8 rounded-full px-2.5 text-[13px] font-medium text-ink outline-none transition-[background-color,scale] duration-[160ms] ease-out hover:bg-ink/8 focus-visible:bg-ink/8 active:scale-[0.95]"
            >
              {t('appointments.today')}
            </button>
            <ToolButton
              small
              icon={ArrowRight01Icon}
              label={t('appointments.next')}
              onClick={() => shiftWeek(1)}
            />
          </div>

          <div className="flex items-center rounded-full bg-ink/8 p-0.5">
            <ViewSwitch small value={view} onChange={setView} />
            <ToolButton
              small
              icon={Search01Icon}
              label={t('header.search')}
              onClick={() => setSearching(true)}
            />
            <BookingPopover
              onDayChange={setDay}
              services={services}
              week={hours}
              timeZone={timeZone}
              onSaved={saved}
            >
              <ToolButton small icon={Add01Icon} label={t('appointments.create')} />
            </BookingPopover>
          </div>
        </div>
      </div>

      {/* The chosen day in words, under the strip on the left — «Сегодня»
          on today, «Воскресенье, 20 сентября» otherwise: the same rule the
          phone's agenda heading follows. */}
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-semibold text-ink">
          {isToday ? t('appointments.today') : dayLabel(day)}
        </p>
        {/* Against the right edge, what is in the day — a caption of the list
            below, so muted and one step smaller. */}
        <p className="shrink-0 text-[13px] text-muted">
          {[
            t('appointments.countBookings', { count: counted.length }),
            gaps.length ? t('appointments.countWindows', { count: gaps.length }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {/* Search takes the card over, from the top, and leaves the way it
          came — the phone's own search, laid over this card instead of the
          screen. */}
      <AnimatePresence>
        {searching && (
          <m.div
            key="search"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={reduce ? CROSSFADE.in : { y: SPRING, opacity: CROSSFADE.in }}
            className="absolute inset-0 z-10 flex flex-col bg-surface-raised pt-3"
          >
            <MobileSearch
              onClose={() => setSearching(false)}
              services={services}
              week={hours}
              timeZone={timeZone}
              onSaved={saved}
              compact
              className="min-h-0 flex-1"
            />
          </m.div>
        )}
      </AnimatePresence>
    </section>
  )
}
