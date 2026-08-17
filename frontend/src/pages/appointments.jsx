import { useEffect, useState } from 'react'
import Head from 'next/head'
import * as Dialog from '@radix-ui/react-dialog'
import DayPanel from '../components/appointments/DayPanel'
import MonthCalendar from '../components/appointments/MonthCalendar'
import BookingDetails from '../components/appointments/BookingDetails'
import BookingPanel from '../components/appointments/BookingPanel'
import { getBusiness, getWorkingHours, listAppointments } from '../lib/api'
import { getAccessToken } from '../lib/auth'
import { toBlock } from '../lib/appointments'
import { dayKey, monthGrid, sameMonth } from '../lib/dates'
import styles from '../styles/Appointments.module.css'

/**
 * Записи — version two.
 *
 * The first version is in `src/archive/appointments-v1/`, taken out of the app
 * on 2026-08-17 so this one could be designed without the first one's layout
 * deciding anything. Its README says what it did and how to put it back.
 *
 * The page owns the three things the whole screen is a function of — the month
 * on show, the day selected inside it, and the bookings — so the calendar and
 * the panel beside it can stay pure views of that state.
 */
export default function AppointmentsPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selected, setSelected] = useState(() => new Date())
  const [appointments, setAppointments] = useState([])
  // The business's zone and its week, fetched once. Both are set on the Бизнес
  // page, not here, so nothing on this screen can change them.
  //
  // `timeZone` starts undefined, which every time helper reads as "the
  // browser's" — the behaviour before a zone was available. That is the right
  // stand-in for the moment before it arrives, and wrong only for an owner
  // abroad, for one render.
  const [timeZone, setTimeZone] = useState(undefined)
  const [week, setWeek] = useState([])
  const [error, setError] = useState('')
  // The form that's open, or null: `{ date, centred, block }`. Held apart from
  // `selected` so closing it leaves the calendar exactly where it was. `block`
  // present means editing that booking; absent means writing a new one.
  //
  // `centred` is *where the same form appears*, and it follows from where it
  // was opened. A double-click lands on a day cell, so the form hangs off that
  // cell with the month still readable around it. The «+» in the day column has
  // no cell to hang off — so it opens in the middle of the screen over a dimmed
  // page, which is what a control outside the calendar can honestly point at.
  const [booking, setBooking] = useState(null)
  // The booking whose window is open, or null: `{ block, color }`. The colour
  // travels with it so the window can wear the same bar its card did, without
  // re-deriving the day's order a third time.
  const [viewing, setViewing] = useState(null)
  // Bumped after a booking is made, purely to make the load effect run again.
  const [reloads, setReloads] = useState(0)

  // The whole visible block, trailing days included — those cells are on screen
  // and will carry their own bookings, so fetching only the month itself would
  // leave the first and last rows looking empty when they are not.
  const days = monthGrid(month)
  const from = dayKey(days[0])
  const to = dayKey(days[days.length - 1])

  useEffect(() => {
    let cancelled = false
    const token = getAccessToken()

    // Quiet on failure for both: the calendar carries the booking error, and a
    // missing zone or week degrades to "the browser's zone" and "no day marked
    // closed" rather than to an empty screen.
    getBusiness(token)
      .then((row) => {
        if (!cancelled) setTimeZone(row.timezone || undefined)
      })
      .catch(() => {})

    getWorkingHours(token)
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

    listAppointments(getAccessToken(), { from, to })
      .then((rows) => {
        if (cancelled) return
        setAppointments(rows.map((row) => toBlock(row, timeZone)))
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [from, to, reloads, timeZone])

  /** Picking a day from the panel's arrows may walk out of the month on show. */
  const pickDay = (day) => {
    setSelected(day)
    if (!sameMonth(day, month)) {
      setMonth(new Date(day.getFullYear(), day.getMonth(), 1))
    }
  }

  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page} aria-label="Страница записей">
        {/* A fixed height rather than a minimum, so `flex-1` below has a
            quantity to divide.

            The inset is even on all four sides here, and tighter than
            `/business`'s: every pixel of it is a pixel the six rows of the
            calendar don't get, and unlike a page of cards there is nothing
            below to scroll to that would want a wider foot. */}
        <div className="flex h-[calc(100vh-68px)] flex-col p-3">
          <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl bg-white">
            {/* 70/30. The month is the page — it gets the width — and the
                remaining third lists the selected day. */}
            <div className="w-[70%] shrink-0 px-5 py-4">
              <MonthCalendar
                month={month}
                selected={selected}
                blocks={appointments}
                week={week}
                timeZone={timeZone}
                booking={booking?.centred ? null : (booking?.date ?? null)}
                onMonthChange={setMonth}
                onSelect={setSelected}
                onCreate={(date) => setBooking({ date, centred: false })}
                onBookingClose={() => setBooking(null)}
                onBooked={() => {
                  setBooking(null)
                  setReloads((count) => count + 1)
                }}
              />
            </div>

            <div className="min-w-0 flex-1 border-l border-[#999999]/15">
              {error ? (
                <p role="alert" className="px-5 py-4 text-[13px] text-[#DC2626]">
                  {error}
                </p>
              ) : (
                <DayPanel
                  date={selected}
                  blocks={appointments}
                  onDateChange={pickDay}
                  onCreate={(date) => setBooking({ date, centred: true })}
                  onOpen={(block, color) => setViewing({ block, color })}
                />
              )}
            </div>
          </div>
        </div>

        {/* Opened from the «+», with the page dimmed behind it. Radix owns the
            focus trap, Escape and the click outside here, which is why the
            panel is told to leave its own copies of those alone. */}
        {booking?.centred && (
          <Dialog.Root open onOpenChange={(open) => !open && setBooking(null)}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[60] grid place-items-center bg-[#171215]/50 p-4">
                <Dialog.Content
                  aria-describedby={undefined}
                  className="w-[460px] max-w-[calc(100vw-2rem)] outline-none"
                >
                  {/* The panel draws its own heading; this one is for the
                      accessibility tree, which Radix requires a dialog to
                      have and would otherwise warn about. */}
                  <Dialog.Title className="sr-only">
                    {booking.block ? 'Редактировать запись' : 'Новая запись'}
                  </Dialog.Title>
                  <BookingPanel
                    modal
                    date={booking.date}
                    booking={booking.block ?? null}
                    timeZone={timeZone}
                    className="w-full"
                    onClose={() => setBooking(null)}
                    onSaved={() => {
                      setBooking(null)
                      setReloads((count) => count + 1)
                    }}
                  />
                </Dialog.Content>
              </Dialog.Overlay>
            </Dialog.Portal>
          </Dialog.Root>
        )}

        {/* Opened from a card in the day column. Centred over a dimmed page,
            like the «+»: neither is anchored to a day cell, so neither has
            anything in the calendar to hang off. */}
        {viewing && (
          <Dialog.Root open onOpenChange={(open) => !open && setViewing(null)}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[60] grid place-items-center bg-[#171215]/50 p-4">
                <Dialog.Content
                  aria-describedby={undefined}
                  className="w-[460px] max-w-[calc(100vw-2rem)] outline-none"
                >
                  <Dialog.Title className="sr-only">Запись</Dialog.Title>
                  <BookingDetails
                    block={viewing.block}
                    color={viewing.color}
                    timeZone={timeZone}
                    onClose={() => setViewing(null)}
                    onSaved={() => {
                      setViewing(null)
                      setReloads((count) => count + 1)
                    }}
                  />
                </Dialog.Content>
              </Dialog.Overlay>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </div>
    </>
  )
}
