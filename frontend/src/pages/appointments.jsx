import { useEffect, useState } from 'react'
import MonthCalendar from '../components/appointments/MonthCalendar'
import MonthScroller from '../components/appointments/MonthScroller'
import MobileToolbar from '../components/appointments/MobileToolbar'
import ChatFeed from '../components/appointments/ChatFeed'
import NowCard from '../components/appointments/NowCard'
import FreeSlotCard from '../components/appointments/FreeSlotCard'
import UpNextCard from '../components/appointments/UpNextCard'
import Timetable from '../components/appointments/Timetable'
import {
  getBusiness,
  getServices,
  getWorkingHours,
  listAppointments,
} from '../lib/api'
import { toBlock } from '../lib/appointments'
import { authed } from '../lib/auth'
import { dayKey, weekDays } from '../lib/dates'
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
/* --- TEMPORARY: three invented chats -------------------------------------
 *
 * **Delete this block and the `chats={DEMO_CHATS}` below when `/inbox` gets a
 * backend.** It exists so the feed's layout can be looked at and argued with;
 * it is not a placeholder that should survive into anything real. Invented
 * figures are how the `/dashboard` analytics screen ended up being built and
 * then removed whole, so this one is marked rather than trusted to be
 * remembered.
 *
 * The times are built from *today* rather than written as literals, so the
 * rows read as this afternoon whenever the page is opened instead of quietly
 * becoming a date in the past.
 *
 * **Newest first**, because that is what the feed is for: a chat that has just
 * opened has to arrive where the eye already is, and a list that appends puts
 * every new one at the bottom of a box that scrolls. The one still waiting for
 * an answer is the most recent here on purpose — that is the row the colour is
 * spent on, and burying it under four answered ones would be spending it on
 * something nobody can see.
 */
const demoAt = (hours, minutes) => {
  const day = new Date()
  day.setHours(hours, minutes, 0, 0)
  return day.toISOString()
}

const DEMO_CHATS = [
  {
    id: 'demo-waiting',
    at: demoAt(16, 35),
    client: 'Ақзере',
    preview: 'Можно перенести на завтра?',
    state: 'waiting',
  },
  {
    id: 'demo-new-price',
    at: demoAt(15, 10),
    client: '+7 747 902 11 08',
    preview: 'Сколько стоит окрашивание?',
    state: 'new',
  },
  {
    id: 'demo-answered-bye',
    at: demoAt(14, 20),
    client: 'Мақсат',
    preview: 'Спасибо, до встречи',
    state: 'answered',
  },
  {
    id: 'demo-new',
    at: demoAt(11, 5),
    client: '+7 707 415 22 90',
    preview: 'Здравствуйте, есть свободное время сегодня?',
    state: 'new',
  },
  {
    id: 'demo-answered',
    at: demoAt(9, 40),
    client: 'Нұрдәулет',
    preview: 'Подтверждаю, буду в 18:00',
    state: 'answered',
  },
]

export default function AppointmentsPage() {
  const t = useT()
  const [selected, setSelected] = useState(() => new Date())

  // **The week the business actually works**, so the grid can shade the hours
  // nobody is there. Seven rows keyed by `weekday`, `0 = Monday`, straight from
  // `GET /business/working-hours`; the backend creates them on first read, so
  // this never comes back short.
  //
  // A failure is swallowed on purpose. Nothing here is the point of the page —
  // without the week the grid draws every hour as ordinary, which is exactly
  // what it did before this existed. An error banner over a booking calendar
  // because a *shading* request failed would be the louder mistake.
  const [week, setWeek] = useState(null)

  // The price list, and the zone the business keeps its hours in. Both are
  // settings rather than content: they are read once and do not change while
  // the page is open.
  const [services, setServices] = useState(null)
  const [timeZone, setTimeZone] = useState(undefined)

  useEffect(() => {
    let alive = true

    authed(getWorkingHours)
      .then((rows) => alive && setWeek(rows))
      .catch(() => {})
    authed(getServices)
      .then((rows) => alive && setServices(rows))
      .catch(() => {})
    authed(getBusiness)
      .then((row) => alive && setTimeZone(row.timezone))
      .catch(() => {})

    return () => {
      alive = false
    }
  }, [])

  /* --- the bookings themselves --------------------------------------- */

  // Whether the grid is pulled up over the cards. The page holds it because
  // the two regions it sizes live on either side of this component.
  const [expanded, setExpanded] = useState(false)

  const [bookings, setBookings] = useState([])
  // Bumped after a save. A counter rather than a boolean, because two bookings
  // made in a row have to be two reloads and `true → true` is no change at all.
  const [reload, setReload] = useState(0)

  // **The whole week, whichever view is showing.** The timetable switches
  // between one day and five without telling the page, and re-fetching on that
  // switch would trade a request for nothing: seven days of one business is a
  // small answer, and stepping between the two views is instant when both are
  // already here.
  const span = weekDays(selected)
  const from = dayKey(span[0])
  const to = dayKey(span[6])

  useEffect(() => {
    let alive = true
    authed((token) => listAppointments(token, { from, to }))
      .then((rows) => {
        // Read in the *business's* zone, not the browser's — a booking near
        // midnight lands on the wrong day of the grid otherwise. Before
        // `GET /business` answers, `undefined` means the browser's own zone,
        // which is right for everyone using this from inside the country and
        // is corrected a moment later for everyone else.
        if (alive) setBookings(rows.map((row) => toBlock(row, timeZone)))
      })
      .catch(() => {
        if (alive) setBookings([])
      })
    return () => {
      alive = false
    }
  }, [from, to, timeZone, reload])

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
      // inside it. The numbers match the module's own, and below `sm` there is
      // **no header on this route** — only the 50px bottom bar and the home
      // indicator under it come off. Above `sm` the header is back and it is
      // the usual 68.
      className={`${styles.page} flex h-[calc(100vh-50px-env(safe-area-inset-bottom))] flex-col items-stretch overflow-hidden sm:h-[calc(100vh-68px)] xl:flex-row`}
      aria-label={t('nav.appointments')}
    >
      {/* A column, so the timetable can take everything the cards above it do
          not. `min-h-0` on both this and the timetable is what lets it: a flex
          item defaults to its content's size and will not shrink past it
          otherwise, which is exactly how a "no scrolling" page ends up
          scrolling. */}
      {/* **`justify-end`: the timetable is held to the bottom of the column,
          not laid out from the top of it.** It takes 65% of the height (see
          `Timetable`), and the 35% above is left empty on purpose — that is
          where the cards go. Pinning it down rather than letting it sit under
          whatever happens to be above means the grid stays where the eye last
          found it: add a card, remove one, change their height, and the hours
          do not move.

          It is not a card either: its top rule is a horizontal line beginning
          exactly where the rail's vertical one ends. */}
      {/* **Everything but the calendar is `hidden sm:flex`.** On a phone this
          screen is the calendar and nothing else — see `MonthScroller`. The
          three cards, the timetable and the chat feed are all built for a
          screen you can put two columns on; stacked into 390 points they were
          six regions fighting over one viewport that is not allowed to scroll.

          Hidden rather than unmounted, exactly as `/profile`'s header is: the
          breakpoint decides what is drawn, and a component that is torn down
          and rebuilt at 640px is one whose clocks restart and whose scroll
          position is lost every time the window is dragged. */}
      <div className="hidden min-h-0 min-w-0 flex-1 flex-col justify-end sm:flex">
        {/* **Three cards, empty, and edgeless.** They hold the 35% above the
            grid — see the note on `justify-end`. Empty because what goes in
            them is not decided; drawn anyway because the shape of the row is,
            and a blank gap tells the next reader nothing about what belongs
            there.

            **`bg-surface-raised`, not `bg-surface` with a border.** In dark
            mode `surface` and `ground` are the same black, so a card without a
            hairline drawn in it is invisible — which is why the project's card
            pattern carries `border border-line`. The token is the other way to
            separate a block from the page: a fill a step off the ground,
            white on light and #0e0e0e on dark. No line, no shadow, no ring.

            `flex-1` rather than a second percentage: the grid below states its
            share and this takes what is left, so the two cannot add up to
            anything but the column. */}
        {/* **An explicit 35%, not `flex-1`**, so raising the grid is a change
            between two percentages and can therefore be animated. `flex-1`
            would have been a change of *how* the height is decided, which has
            no midpoint to draw.

            `h-0` rather than unmounting: the cards keep their clocks running
            and their scroll position, and coming back down is the same
            transition in reverse rather than three components rebuilding. */}
        <div
          className={`grid min-h-0 shrink-0 grid-cols-3 gap-4 overflow-hidden transition-[height,padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
            expanded ? 'h-0 p-0' : 'h-[35%] p-4'
          }`}
          aria-hidden={expanded}
        >
          {/* Now, next, and where somebody could still be fitted in — the
              three questions asked with a client on the phone, in the order
              they come up. */}
          <NowCard bookings={bookings} timeZone={timeZone} />
          <UpNextCard bookings={bookings} timeZone={timeZone} />
          <FreeSlotCard bookings={bookings} week={week} timeZone={timeZone} />
        </div>

        <Timetable
          selected={selected}
          onSelect={setSelected}
          week={week}
          bookings={bookings}
          services={services}
          timeZone={timeZone}
          onSaved={() => setReload((n) => n + 1)}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((was) => !was)}
        />
      </div>

      {/* The right panel: full height, flush rather than rounded, and now the
          calendar's home. A card with a radius cannot be 100% of anything
          without margins to float in, and margins are the opposite of what
          "full height" asks for — so the panel itself takes the same treatment
          the rail and the timetable have, a hairline and no box, and the card
          inside it keeps its own radius.

          **The picker moved off the grid's column, which is the point.** Beside
          the timetable it was a 300px card sitting above thirteen hours of
          grid, taking height the one scrolling thing on the page had to give
          up; over here it costs the grid nothing, and the two controls that
          answer "which day" — this and the toolbar's arrows — are no longer
          stacked one above the other.

          `p-4`, one value on every side, so the card reads as set into the
          corner of the panel rather than placed near it.

          **Its width is the calendar's width plus that padding, written as the
          sum rather than as the total it comes to.** The two have to agree —
          any slack shows as the panel's rule standing off from the month by a
          few pixels, which reads as a mistake rather than as a margin — and
          written as `332px` they would agree only until one of them was next
          edited. `2rem` is the `p-4` on both sides; 300px is the cap on
          `MonthCalendar`, and that is the one number to change.

          Below `xl` it moves under the timetable at full width and the divider
          moves to its top edge. That is also where this layout is still
          unfinished: the page does not scroll, so on a narrow screen the
          calendar is below the fold rather than reachable. A small-screen
          layout is still to be designed — see the note on the page element. */}
      {/* The phone's whole screen. `min-h-0` beside `flex-1` is what lets it
          scroll inside the page rather than growing it: this page has a
          *definite* height and `overflow-hidden`, so a child that will not
          shrink below its content puts a year of months where there is nowhere
          to put them. */}
      <MonthScroller
        value={selected}
        onChange={setSelected}
        controls={
          <MobileToolbar
            services={services}
            week={week}
            timeZone={timeZone}
            onDayChange={setSelected}
            onSaved={() => setReload((n) => n + 1)}
          />
        }
        className="min-h-0 flex-1 sm:hidden"
      />

      <aside className="hidden min-h-[300px] w-full shrink-0 flex-col gap-4 border-t border-line p-4 sm:flex xl:min-h-0 xl:w-[calc(300px+2rem)] xl:border-t-0 xl:border-l">
        <div className="shrink-0">
          <MonthCalendar value={selected} onChange={setSelected} />
        </div>

        {/* **The room under the month, which was empty.** The panel is the
            page's full height and the calendar is a fixed card at the top of
            it; a feed is the right thing to put in the rest because it has no
            height of its own to insist on — it takes the leftover and scrolls
            inside itself.

            `hidden xl:flex`: below `xl` the three regions stack and the page
            still does not scroll, so anything added under the calendar there
            goes below the fold and takes the calendar with it. That layout is
            still to be designed — see the note on the page element — and this
            waits for it rather than pretending the problem is not there.

            **`DEMO_CHATS` is temporary and marked as such** — see the block
            above. `/inbox` has no channel and no message table behind it, so
            there is nothing real to hand this yet; the three rows are here to
            be looked at, and the fetch replaces them the day the endpoint
            exists. Passing `null` instead is what draws the honest empty
            state. */}
        <ChatFeed
          chats={DEMO_CHATS}
          timeZone={timeZone}
          className="hidden xl:flex"
        />
      </aside>
    </div>
  )
}
