import { useState } from 'react'
import MonthCalendar from '../components/appointments/MonthCalendar'
import { useT } from '../lib/i18n'
import styles from '../styles/Appointments.module.css'

/**
 * Записи — being built again, third time.
 *
 * The first (a scrollable 24-hour scale) is in commit `1e0c045`; the second (a
 * full-width month calendar) lived under `src/archive/` until that folder was
 * deleted, and is in git history. Both were taken down whole rather than edited,
 * so this one inherits nothing from either.
 *
 * The shape this time is a **picker beside a day**: the month sits top-left and
 * chooses a date, and the column next to it will show what is booked on it.
 * That column is genuinely empty right now — the calendar is the first piece,
 * and inventing a placeholder card to fill the space would be drawing something
 * nobody asked for.
 *
 * The backend behind it is finished and untouched: `/appointments` CRUD,
 * `/appointments/slots` and archiving all work, and the rules underneath them
 * live in `lib/appointments.js`, `lib/dates.js` and `lib/schedule.js`.
 */
export default function AppointmentsPage() {
  const t = useT()
  const [selected, setSelected] = useState(() => new Date())

  return (
    <div className={styles.page} aria-label={t('nav.appointments')}>
      {/* No `mx-auto max-w-*`: a centred column on a wide screen left a couple
          of hundred pixels of empty ground to the left of the calendar and put
          it nowhere in particular.

          **`p-4`, one value on every side**, and that is the whole rule: the
          gap from the header's rule down to the card is the same 16px as the
          gap from the rail across to it. An even margin is what makes the card
          read as set into the corner rather than placed near it — and it is
          deliberately tighter than the header's own `sm:px-6 lg:px-8`, so the
          card does not line up under the page title. Aligning them was tried
          and still read as adrift: the title is a line of text with air around
          it, the card a filled block, and the same offset looks like more under
          a solid edge. */}
      <div className="w-full p-4">
        {/* One column on a phone, calendar-and-day from `lg`. 300px is what the
            grid wants: seven cells plus their gaps at a size a finger can hit,
            and no wider, because every pixel here is one the day beside it does
            not get. */}
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <MonthCalendar value={selected} onChange={setSelected} />
        </div>
      </div>
    </div>
  )
}
