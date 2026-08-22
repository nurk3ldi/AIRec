import { useState } from 'react'
import MonthCalendar from '../components/appointments/MonthCalendar'
import Timetable from '../components/appointments/Timetable'
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
    // The flex row is *on the page element itself*, so `items-stretch` has the
    // page's own height to measure against and the right panel really is full
    // height. Wrapped in a plain div instead it would be as tall as its
    // contents, which for an empty panel is nothing at all.
    <div
      // **A definite `height`, not just the module's `min-height`** — this is
      // the whole fix, and it is not interchangeable. A flex container whose
      // height is `auto` has an *indefinite* cross size however large a
      // `min-height` clamps it to afterwards, so `flex-1` children inside it
      // never get a leftover to fill: every one of them sizes to its own
      // content, the grid renders all thirteen of its 56px hours, the column
      // adds up past the viewport, and Chrome puts a scrollbar down the side of
      // the whole app — with `overflow-hidden` powerless, because that clips
      // content, it does not cap a box that grew.
      //
      // With a real height the chain resolves: the page is the viewport, the
      // grid gets what is left, and the only scrollbar on the screen is the one
      // inside it. The numbers match the module's own — 68px of header, and
      // below `sm` the 50px bottom bar and the home indicator under it.
      className={`${styles.page} flex h-[calc(100vh-118px-env(safe-area-inset-bottom))] flex-col items-stretch overflow-hidden sm:h-[calc(100vh-68px)] xl:flex-row`}
      aria-label={t('nav.appointments')}
    >
      {/* A column, so the timetable can take everything the cards above it do
          not. `min-h-0` on both this and the timetable is what lets it: a flex
          item defaults to its content's size and will not shrink past it
          otherwise, which is exactly how a "no scrolling" page ends up
          scrolling. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* `p-4`, one value on every side: the gap from the header's rule down
            to the first card is the same 16px as the gap from the rail across
            to it. An even margin is what makes the row read as set into the
            corner rather than placed near it. */}
        {/* `shrink-0`, so the calendar keeps its size and the difference comes
            out of the grid below instead. 300px is what its seven cells want,
            and full width below `sm` — a 300px card on a 343px phone is a card
            with a margin down one side only. */}
        <div className="shrink-0 p-4">
          <div className="w-full sm:w-[300px]">
            <MonthCalendar value={selected} onChange={setSelected} />
          </div>
        </div>

        {/* Outside the padding rather than negatively margined out of it, so it
            runs the full width of this column on its own terms. It is not a
            card: its top rule is a horizontal line beginning exactly where the
            rail's vertical one ends. */}
        <Timetable selected={selected} onSelect={setSelected} />
      </div>

      {/* The right panel: full height, empty, and flush rather than rounded.
          A card with a radius cannot be 100% of anything without margins to
          float in, and margins are the opposite of what "full height" asks
          for — so it takes the same treatment the rail and the timetable have,
          a hairline and no box.

          Below `xl` it moves under the timetable at full width, and the divider
          moves to its top edge: at that width a 300px column beside a five-day
          grid leaves neither of them enough room. */}
      <aside className="min-h-[300px] w-full shrink-0 border-t border-line xl:min-h-0 xl:w-[450px] xl:border-t-0 xl:border-l" />
    </div>
  )
}
