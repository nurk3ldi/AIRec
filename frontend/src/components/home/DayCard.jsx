import { useEffect, useState } from 'react'
import WeekStrip from '../appointments/WeekStrip'
import { getBusiness, listAppointments } from '../../lib/api'
import { toBlock } from '../../lib/appointments'
import { authed } from '../../lib/auth'
import { dayKey, weekDays } from '../../lib/dates'
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
  const [day, setDay] = useState(() => new Date())
  const [timeZone, setTimeZone] = useState(undefined)
  const [bookings, setBookings] = useState([])

  useEffect(() => {
    let alive = true
    authed(getBusiness)
      .then((row) => alive && setTimeZone(row.timezone))
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
  }, [from, to, timeZone])

  const marked = new Set(
    bookings.filter((row) => row.status !== 'cancelled').map((row) => row.day),
  )

  return (
    <section className={`${CARD_EDGE} flex flex-col overflow-hidden p-4 ${className}`}>
      {/* Верхняя строка: неделя — компактно, у левого края; справа место
          для «Сегодня», поиска и «+», которые встанут туда следующими. */}
      <div className="flex items-start gap-4">
        <WeekStrip
          day={day}
          onDayChange={setDay}
          marked={marked}
          compact
          className="-ml-2 w-[60%]"
        />
        <div className="ml-auto" />
      </div>
    </section>
  )
}
