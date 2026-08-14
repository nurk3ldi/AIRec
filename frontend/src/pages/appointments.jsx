import { useEffect, useState } from 'react'
import Head from 'next/head'
import MiniMonth from '../components/appointments/MiniMonth'
import NewAppointmentDialog from '../components/appointments/NewAppointmentDialog'
import TimeGrid from '../components/appointments/TimeGrid'
import Toolbar from '../components/appointments/Toolbar'
import { listAppointments } from '../lib/api'
import { getAccessToken } from '../lib/auth'
import { toBlock } from '../lib/appointments'
import { dayKey, weekDays } from '../lib/dates'
import styles from '../styles/Appointments.module.css'

export default function AppointmentsPage() {
  // The page owns the three things the whole screen is a function of, so the
  // calendar below can stay a pure view of them.
  const [date, setDate] = useState(() => new Date())
  const [view, setView] = useState('day')
  const [query, setQuery] = useState('')

  const [appointments, setAppointments] = useState([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  // Bumped after a booking is made, purely to make the load effect run again.
  const [reloads, setReloads] = useState(0)

  // Whichever days are on screen, as `YYYY-MM-DD` — the shape the endpoint
  // takes, and stable strings rather than `Date` objects, so this effect runs
  // when the range really changes and not on every render that made a new one.
  const days = view === 'week' ? weekDays(date) : [date]
  const from = dayKey(days[0])
  const to = dayKey(days[days.length - 1])

  useEffect(() => {
    let cancelled = false

    listAppointments(getAccessToken(), { from, to })
      .then((rows) => {
        if (!cancelled) {
          setAppointments(rows.map(toBlock))
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [from, to, reloads])

  return (
    <>
      <Head><title>AIRec</title></Head>
      <div className={styles.page} aria-label="Страница записей">
        {/* Same padding as `/business`, and no max-width: the calendar below
            wants every pixel it can get, and a centred column would leave the
            toolbar inset from the header sitting directly above it. */}
        <div className="px-6 py-6 sm:px-8">
          {/* One card holding the whole calendar, divided inside by hairlines
              rather than split into several. The toolbar, the month picker and
              the grid are three views of one thing — separate cards would say
              they were three subjects that happen to sit near each other. */}
          <div className="overflow-hidden rounded-2xl bg-white">
            <div className="px-6 py-5">
              <Toolbar
                date={date}
                onDateChange={setDate}
                view={view}
                onViewChange={setView}
                query={query}
                onQueryChange={setQuery}
                onCreate={() => setCreating(true)}
              />
              {error && (
                <p role="alert" className="mt-3 text-[13px] text-[#DC2626]">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-stretch border-t border-[#999999]/15">
              <MiniMonth date={date} onDateChange={setDate} />

              {/* A fixed height, not a minimum: the grid inside scrolls
                  through all twenty-four hours, and it can only do that if
                  something above it says where the viewport ends. */}
              <div className="flex h-[640px] min-w-0 flex-1 flex-col border-l border-[#999999]/15">
                <TimeGrid
                  date={date}
                  view={view}
                  onDateChange={setDate}
                  appointments={appointments}
                />
              </div>
            </div>
          </div>
        </div>

        {creating && (
          <NewAppointmentDialog
            date={date}
            onClose={() => setCreating(false)}
            onCreated={() => {
              setCreating(false)
              setReloads((count) => count + 1)
            }}
          />
        )}
      </div>
    </>
  )
}
