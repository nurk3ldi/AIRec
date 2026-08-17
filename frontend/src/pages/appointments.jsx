import { useEffect, useState } from 'react'
import Head from 'next/head'
import AppointmentDetails from '../components/appointments/AppointmentDetails'
import MiniMonth from '../components/appointments/MiniMonth'
import NewAppointmentDialog from '../components/appointments/NewAppointmentDialog'
import NowNext from '../components/appointments/NowNext'
import TimeGrid from '../components/appointments/TimeGrid'
import Toolbar from '../components/appointments/Toolbar'
import { getWorkingHours, listAppointments } from '../lib/api'
import { getAccessToken } from '../lib/auth'
import { addDays, toBlock } from '../lib/appointments'
import { dayKey, weekDays } from '../lib/dates'
import styles from '../styles/Appointments.module.css'

// How far past today the "what's next" panel looks. A week is enough to have
// something to show on a quiet Sunday evening, and short enough that the answer
// is still about now rather than about the calendar.
const AHEAD_DAYS = 7

// Long enough that a name typed at speed is one request rather than six, short
// enough that the answer still feels like it arrives as you type.
const SEARCH_DELAY = 300

export default function AppointmentsPage() {
  // The page owns the three things the whole screen is a function of, so the
  // calendar below can stay a pure view of them.
  const [date, setDate] = useState(() => new Date())
  const [view, setView] = useState('day')
  const [query, setQuery] = useState('')

  const [appointments, setAppointments] = useState([])
  // Anchored to today rather than to whatever the calendar is showing — the
  // point of the panel is that looking ahead at next Thursday must not stop it
  // telling you someone is in the chair right now.
  const [ahead, setAhead] = useState([])
  // The seven-row week, so the grid can wash out the hours the business is
  // shut. Fetched once: opening hours change on the Бизнес page, not here.
  const [week, setWeek] = useState([])
  const [results, setResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  // Bumped after a booking is made, purely to make the load effects run again.
  const [reloads, setReloads] = useState(0)

  // The selection is an id, not the booking itself: an id survives the list
  // being reloaded, and a booking that has left both lists simply stops
  // resolving, which closes the dialog — right, since there is nothing left to
  // show it about.
  const [selectedId, setSelectedId] = useState(null)
  const selected =
    appointments.find((block) => block.id === selectedId) ??
    ahead.find((block) => block.id === selectedId) ??
    results.find((block) => block.id === selectedId) ??
    null

  /** Swap one booking for the version the server just returned, everywhere. */
  const replace = (row) => {
    const updated = toBlock(row)
    const swap = (current) =>
      current.map((block) => (block.id === updated.id ? updated : block))
    setAppointments(swap)
    setAhead(swap)
    setResults(swap)
  }

  /** Open a booking that may not be on screen — take the calendar to it first. */
  const openFromPanel = (block) => {
    const [year, month, day] = block.day.split('-').map(Number)
    setDate(new Date(year, month - 1, day))
    setSelectedId(block.id)
  }

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

  useEffect(() => {
    let cancelled = false

    // Quiet on failure, and the grid shades nothing until it arrives: greying
    // out a day the business may well be open is worse than showing plain
    // hours for a moment.
    getWorkingHours(getAccessToken())
      .then((rows) => {
        if (!cancelled) setWeek(rows)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const today = new Date()

    listAppointments(getAccessToken(), {
      from: dayKey(today),
      to: dayKey(addDays(today, AHEAD_DAYS)),
    })
      // Quiet on failure: the calendar beside it carries the error, and two
      // copies of the same message would only say the request failed twice.
      .then((rows) => {
        if (!cancelled) setAhead(rows.map(toBlock))
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [reloads])

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setResults([])
      setSearchLoading(false)
      return
    }

    let cancelled = false
    // Shown from the first keystroke rather than when the request goes out, so
    // the panel says "Ищем…" for the whole wait instead of showing the previous
    // client's results for another third of a second.
    setSearchLoading(true)

    const timer = setTimeout(() => {
      // No `from`/`to` on purpose: the server drops the date range when a query
      // arrives alone, and looking for a client means looking for every visit
      // they ever made.
      listAppointments(getAccessToken(), { query: term })
        .then((rows) => {
          if (!cancelled) setResults(rows.map(toBlock))
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false)
        })
    }, SEARCH_DELAY)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, reloads])

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
                results={results}
                searchLoading={searchLoading}
                onResultSelect={openFromPanel}
                overlayOpen={Boolean(selected) || creating}
                onCreate={() => setCreating(true)}
              />
              {error && (
                <p role="alert" className="mt-3 text-[13px] text-[#DC2626]">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-stretch border-t border-[#999999]/15">
              <div className="flex w-[300px] shrink-0 flex-col">
                <MiniMonth date={date} onDateChange={setDate} />
                {/* Stays put while a search is running: what is happening now
                    is still true, and searching for a client is no reason to
                    stop showing the one already in the chair. */}
                <NowNext blocks={ahead} onSelect={openFromPanel} />
              </div>

              {/* A fixed height, not a minimum: the grid inside scrolls
                  through all twenty-four hours, and it can only do that if
                  something above it says where the viewport ends. */}
              <div className="flex h-[640px] min-w-0 flex-1 flex-col border-l border-[#999999]/15">
                <TimeGrid
                  date={date}
                  view={view}
                  onDateChange={setDate}
                  appointments={appointments}
                  week={week}
                  selectedId={selectedId}
                  onSelect={(block) => setSelectedId(block.id)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* A dialog over the whole page, not a panel inside the card: clicking
            a block must leave the calendar underneath exactly as it was. */}
        {selected && (
          <AppointmentDetails
            block={selected}
            onClose={() => setSelectedId(null)}
            onUpdated={replace}
          />
        )}

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
