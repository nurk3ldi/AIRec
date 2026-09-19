import { useEffect, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PlusSignIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import BookingPopover from '../appointments/BookingPopover'
import MobileSearch from '../appointments/MobileSearch'
import WeekStrip from '../appointments/WeekStrip'
import { StepButton, ToolbarPill } from '../appointments/Timetable'
import { getBusiness, getServices, getWorkingHours, listAppointments } from '../../lib/api'
import { toBlock } from '../../lib/appointments'
import { authed } from '../../lib/auth'
import { dayKey, sameDay, weekDays } from '../../lib/dates'
import { CROSSFADE, SPRING } from '../../lib/motion'
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
export default function DayCard({ className = '' }) {
  const t = useT()
  const [day, setDay] = useState(() => new Date())
  const [timeZone, setTimeZone] = useState(undefined)
  const [bookings, setBookings] = useState([])
  // What the booking panel and the search need: the price list and the week.
  const [services, setServices] = useState(null)
  const [hours, setHours] = useState(null)
  const [searching, setSearching] = useState(false)
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
        <div className="flex shrink-0 gap-2 self-center">
          <StepButton
            label={t('appointments.prev')}
            icon={ArrowLeft01Icon}
            onClick={() => shiftWeek(-1)}
          />
          <StepButton
            label={t('appointments.next')}
            icon={ArrowRight01Icon}
            onClick={() => shiftWeek(1)}
          />
        </div>

        {/* Right edge: back to today, search the history, write a booking —
            the phone toolbar's three, as the desktop's round buttons. */}
        <div className="ml-auto flex shrink-0 items-center gap-2 self-center">
          <ToolbarPill
            fill="step"
            onClick={() => setDay(new Date())}
            aria-current={sameDay(day, new Date()) ? 'date' : undefined}
          >
            {t('appointments.today')}
          </ToolbarPill>
          <StepButton
            label={t('inbox.search')}
            icon={Search01Icon}
            onClick={() => setSearching(true)}
          />
          <BookingPopover
            onDayChange={setDay}
            services={services}
            week={hours}
            timeZone={timeZone}
            onSaved={saved}
          >
            <StepButton label={t('appointments.create')} icon={PlusSignIcon} />
          </BookingPopover>
        </div>
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
