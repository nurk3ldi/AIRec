import { useState } from 'react'
import MonthCalendar from '../components/appointments/MonthCalendar'
import WeekTimetable from '../components/appointments/WeekTimetable'
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
    // A flex row *on the page element itself*, so `items-stretch` measures
    // against the module's `min-height` and the right panel really is the full
    // height of the page. Wrapped in a plain div instead it would only be as
    // tall as its own contents, which for an empty panel is nothing at all.
    <div
      className={`${styles.page} flex flex-col items-stretch xl:flex-row`}
      aria-label={t('nav.appointments')}
    >
      <div className="min-w-0 flex-1">
        {/* `p-4`, one value on every side: the gap from the header's rule down
            to the first card is the same 16px as the gap from the rail across
            to it. An even margin is what makes the row read as set into the
            corner rather than placed near it. */}
        <div className="p-4">
          {/* A wrapping row of fixed 300px cards — the browser puts as many on
              a line as fit and moves the rest down, which is the same answer at
              every viewport without a breakpoint doing arithmetic about how
              many clear a 1024px screen. Heights match for free: flex items
              stretch to their row, so the empty two take the calendar's height
              whenever they share its line. */}
          <div className="flex flex-wrap gap-4">
            <div className="w-full sm:w-[300px]">
              <MonthCalendar value={selected} onChange={setSelected} />
            </div>
            <EmptyCard />
            <EmptyCard />
          </div>
        </div>

        {/* Outside the padding rather than negatively margined out of it, so it
            runs the full width of this column on its own terms. It is not a
            card: its top rule is a horizontal line beginning exactly where the
            rail's vertical one ends. */}
        <WeekTimetable selected={selected} />
      </div>

      {/* The right panel: full height, empty, and flush rather than rounded.
          A card with a radius cannot be 100% of anything without margins to
          float in, and margins are the opposite of what "full height" asks
          for — so it takes the same treatment the rail and the timetable have,
          a hairline and no box.

          Below `xl` it moves under the timetable at full width, and the divider
          moves to its top edge: at that width a 300px column beside a five-day
          grid leaves neither of them enough room. */}
      <aside className="min-h-[300px] w-full shrink-0 border-t border-line xl:min-h-0 xl:w-[300px] xl:border-t-0 xl:border-l" />
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
