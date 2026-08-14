import { useState } from 'react'
import Head from 'next/head'
import DaysHeader from '../components/appointments/DaysHeader'
import MiniMonth from '../components/appointments/MiniMonth'
import TimeGrid from '../components/appointments/TimeGrid'
import Toolbar from '../components/appointments/Toolbar'
import styles from '../styles/Appointments.module.css'

export default function AppointmentsPage() {
  // The page owns the three things the whole screen is a function of, so the
  // calendar below can stay a pure view of them.
  const [date, setDate] = useState(() => new Date())
  const [view, setView] = useState('day')
  const [query, setQuery] = useState('')

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
                onCreate={() => {}}
              />
            </div>

            <div className="flex items-stretch border-t border-[#999999]/15">
              <MiniMonth date={date} onDateChange={setDate} />

              {/* A fixed height, not a minimum: the grid inside scrolls
                  through all twenty-four hours, and it can only do that if
                  something above it says where the viewport ends. */}
              <div className="flex h-[640px] min-w-0 flex-1 flex-col border-l border-[#999999]/15">
                <DaysHeader date={date} view={view} onDateChange={setDate} />
                <TimeGrid date={date} view={view} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
