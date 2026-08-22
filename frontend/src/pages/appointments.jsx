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
        {/* A wrapping row, not a grid of named columns. Every card is 300px —
            the width the calendar's seven cells want — and the browser puts as
            many on a line as fit and moves the rest down. That is the same
            answer at every viewport without a breakpoint anywhere doing
            arithmetic about how many 300px cards clear a 1024px screen.

            Below `sm` each card takes the full width instead, because a 300px
            card on a 343px phone is a card with a margin down one side only.

            Heights match for free: flex items stretch to their row, so the two
            empty cards take the calendar's height whenever they share its line.
            `min-h` on them is the floor for when they do not. */}
        <div className="flex flex-wrap gap-4">
          <div className="w-full sm:w-[300px]">
            <MonthCalendar value={selected} onChange={setSelected} />
          </div>
          <EmptyCard />
          <EmptyCard />
        </div>
      </div>
    </div>
  )
}

/**
 * A card with nothing in it yet.
 *
 * Two of these sit to the right of the calendar holding the space their
 * contents will need. They are deliberately bare — no heading, no icon, no
 * «скоро» — because a label would be a claim about what goes here, and that has
 * not been decided. An empty surface says "something is coming" without saying
 * what.
 *
 * The 302px floor is the calendar's own height, and it is arithmetic rather
 * than a guess: 32 padding + 32 header + 12 gap + 24 weekday row + 202 of grid
 * (six 32px rows and five 2px gaps). It only applies when a card is alone on
 * its line — sharing one with the calendar, the flex row matches them itself.
 */
function EmptyCard() {
  return (
    <div
      aria-hidden="true"
      className="min-h-[302px] w-full rounded-2xl border border-line bg-surface sm:w-[300px]"
    />
  )
}
