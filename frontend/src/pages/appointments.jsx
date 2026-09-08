import { useEffect, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import MonthCalendar from '../components/appointments/MonthCalendar'
import MonthScroller from '../components/appointments/MonthScroller'
import MobileToolbar from '../components/appointments/MobileToolbar'
import MobileSearch from '../components/appointments/MobileSearch'
import MobileDay from '../components/appointments/MobileDay'
import MobileList from '../components/appointments/MobileList'
import CardSkeleton from '../components/CardSkeleton'
import Skeleton, { SkeletonRegion } from '../components/Skeleton'
import { useSkeleton } from '../lib/skeleton'
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
import { useRemembered } from '../lib/viewState'
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
  const reduce = useReducedMotion()
  /**
   * **The screen remembers where it was.** Every route change unmounts this
   * page — `PageTransition` swaps the outlet — so without this, a click on
   * «Диалоги» and back put the calendar on today, the grid lowered and any open
   * day closed, however carefully all three had just been set.
   *
   * Kept for the length of the tab and no longer: which day is on screen is
   * worth surviving a click on the navigation and worth losing on a reload,
   * because a page opened fresh should open on today.
   *
   * The search is deliberately *not* remembered — see the note where it is
   * declared.
   */
  const [selected, setSelected] = useRemembered(
    'appointments.day',
    () => new Date(),
  )

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
  const [expanded, setExpanded] = useRemembered('appointments.expanded', false)

  // **Search takes the phone's screen rather than covering it.** A sheet over a
  // year of months would leave those months scrolling behind a list that has
  // nothing to do with them; swapping says plainly that this is another mode,
  // and the × in its bar is the one way back. The page holds the flag because
  // it owns which of the two is mounted.
  // **Not remembered, unlike the rest.** A search is something you were doing
  // rather than somewhere you were: coming back to this screen and finding the
  // calendar replaced by a box holding a query from ten minutes ago is the page
  // asking you to finish something you had already left.
  const [searching, setSearching] = useState(false)

  // **Which of the two the phone is on.** Tapping a day in the calendar opens
  // that day's hours; the back button in its bar comes here again. Both stay
  // mounted — the same reason the search does — so coming back lands where you
  // left rather than rebuilding a year of months.
  const [dayOpen, setDayOpen] = useRemembered('appointments.dayOpen', false)

  // **Which of the two the phone's ground floor is**, chosen from the bar's
  // third control. The calendar answers "which day"; the list answers "what is
  // happening in this one" — the three cards and the conversations the desktop
  // keeps around its grid, which a phone has no room to put beside anything.
  const [mobileView, setMobileView] = useRemembered(
    'appointments.mobileView',
    'calendar',
  )

  /**
   * Choosing a mode also puts away whatever is on top of it.
   *
   * **The day and the search are layers over the ground floor, not screens
   * beside it.** So switching from the calendar to the list while a day was
   * open changed the floor underneath and left the day sitting over it — the
   * switch appeared to do nothing, which is the worst kind of not working: the
   * control responded and the screen did not.
   *
   * Both directions, not only into the list. Picking a mode is saying what you
   * want to be looking at, and the answer to that cannot be "the thing you were
   * looking at before".
   */
  const chooseMobileView = (next) => {
    setMobileView(next)
    setDayOpen(false)
    setSearching(false)
  }

  // The bar is the same on both, so it is written once — and it has to be, or
  // the two would drift into two bars that look alike.
  const mobileBar = (
    <MobileToolbar
      services={services}
      week={week}
      timeZone={timeZone}
      onDayChange={setSelected}
      onSaved={() => setReload((n) => n + 1)}
      onSearch={() => setSearching(true)}
      view={mobileView}
      onViewChange={chooseMobileView}
    />
  )

  const [bookings, setBookings] = useState([])
  // Bumped after a save. A counter rather than a boolean, because two bookings
  // made in a row have to be two reloads and `true → true` is no change at all.
  const [reload, setReload] = useState(0)

  // **`bookings` starts `[]`, and `[]` is a real answer** — a day with nothing
  // on it. So unlike `/assistant`, where `null` already says "not asked yet",
  // the wait needs a flag of its own; without it the three cards said «Сейчас
  // никого» about a question the screen had not put yet.
  const [loaded, setLoaded] = useState(false)
  // Only whether the bars have waited long enough. The placeholders themselves
  // are drawn for the whole of `!loaded`, so the three cards never say «Сейчас
  // никого» about a question that has not been asked.
  const bars = useSkeleton(!loaded)

  // **The whole week, whichever view is showing.** The timetable switches
  // between one day and five without telling the page, and re-fetching on that
  // switch would trade a request for nothing: seven days of one business is a
  // small answer, and stepping between the two views is instant when both are
  // already here.
  // **The week the grid draws, widened to the month the calendars show.**
  // The timetable only ever needs seven days, and that is still all it reads —
  // but the month calendars mark which days have something on them, and a mark
  // can only be trusted if its absence means something. Fetching a week and
  // dotting a month would put marks on seven days and nowhere else, which reads
  // as "these are the only bookings" rather than as "this is all we asked for".
  //
  // The union rather than the month alone, because a week straddles two of
  // them: the days of the 28th–3rd are on screen together and the grid must
  // have them all. String comparison is enough to take the wider end — day keys
  // are `YYYY-MM-DD`, which sorts as it reads.
  const span = weekDays(selected)
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 0)
  const from = [dayKey(span[0]), dayKey(monthStart)].sort()[0]
  const to = [dayKey(span[6]), dayKey(monthEnd)].sort()[1]

  useEffect(() => {
    let alive = true
    authed((token) => listAppointments(token, { from, to }))
      .then((rows) => {
        // Read in the *business's* zone, not the browser's — a booking near
        // midnight lands on the wrong day of the grid otherwise. Before
        // `GET /business` answers, `undefined` means the browser's own zone,
        // which is right for everyone using this from inside the country and
        // is corrected a moment later for everyone else.
        if (alive) {
          setBookings(rows.map((row) => toBlock(row, timeZone)))
          setLoaded(true)
        }
      })
      .catch(() => {
        if (alive) {
          setBookings([])
          // A failed read is still an answer: the empty state is what the
          // screen has, and a skeleton that never resolves is a page that
          // looks broken rather than empty.
          setLoaded(true)
        }
      })
    return () => {
      alive = false
    }
  }, [from, to, timeZone, reload])

  /**
   * Which days have something on them, for the marks under the dates.
   *
   * **A `Set` of day keys and nothing more.** The calendars need to answer one
   * question per cell — is there anything here — and handing them the bookings
   * would make each of them filter the same list on every render of every day.
   *
   * **Cancelled bookings do not count.** A cancellation gave its hour back and
   * is not something on the day any more; it is kept so the owner can look back
   * at it, which is what the day's own list is for. That is the same line the
   * list's counts draw and the same one `BLOCKING_STATUSES` draws on the
   * server.
   *
   * A day outside `from`–`to` is simply absent, which is why the fetch above is
   * a month wide: an empty mark has to mean "nothing booked" rather than "not
   * asked for".
   */
  const marked = new Set(
    bookings.filter((row) => row.status !== 'cancelled').map((row) => row.day),
  )

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
      className={`${styles.page} relative flex h-[calc(100vh-50px-env(safe-area-inset-bottom))] flex-col items-stretch overflow-hidden sm:h-[calc(100vh-68px)] xl:flex-row`}
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
          {!loaded ? (
            <>
              <CardSkeleton
                rows={2}
                visible={bars}
                label={t('appointments.now')}
              />
              <CardSkeleton
                rows={3}
                visible={bars}
                label={t('appointments.upNext')}
              />
              <CardSkeleton
                rows={2}
                visible={bars}
                label={t('appointments.freeSlot')}
              />
            </>
          ) : (
            <>
              <NowCard bookings={bookings} timeZone={timeZone} />
              <UpNextCard bookings={bookings} timeZone={timeZone} />
              <FreeSlotCard
                bookings={bookings}
                week={week}
                timeZone={timeZone}
              />
            </>
          )}
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
      {mobileView === 'list' && !loaded ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 sm:hidden">
          {/* Outside the fade: the bar is real, and it works while the list is
              still on its way. */}
          {mobileBar}
          <SkeletonRegion
            label={t('nav.appointments')}
            visible={bars}
            className="flex flex-col gap-3"
          >
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex gap-3">
              {/* The span down the left, which is the column the eye runs — so
                  it is the one part of the row worth drawing exactly. */}
              <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-6 w-px rounded-none" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-[72px] flex-1 rounded-2xl" />
            </div>
          ))}
          </SkeletonRegion>
        </div>
      ) : mobileView === 'list' ? (
        <MobileList
          day={selected}
          marked={marked}
          onDayChange={setSelected}
          bookings={bookings}
          week={week}
          services={services}
          timeZone={timeZone}
          onSaved={() => setReload((n) => n + 1)}
          controls={mobileBar}
          className="min-h-0 flex-1 sm:hidden"
        />
      ) : (
        <MonthScroller
          value={selected}
          marked={marked}
          onChange={(chosen) => {
            setSelected(chosen)
            setDayOpen(true)
          }}
          controls={mobileBar}
          className="min-h-0 flex-1 sm:hidden"
        />
      )}

      {/* **A day arrives from the right, the way a drill-down does.** It is
          one step further in than the calendar — a month says which days exist,
          this says what is in one of them — and coming in from the side is what
          every phone means by that. Leaving to the right says it went back.

          Over the calendar rather than instead of it, for the reason the search
          is: a year of months does not need rebuilding because somebody looked
          at Thursday. */}
      <AnimatePresence initial={false}>
        {dayOpen && (
          <m.div
            key="day"
            initial={reduce ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.32, ease: [0.32, 0.72, 0, 1] }
            }
            className="absolute inset-0 z-20 flex flex-col bg-ground sm:hidden"
          >
            <MobileDay
              day={selected}
              marked={marked}
              onDayChange={setSelected}
              onBack={() => setDayOpen(false)}
              bookings={bookings}
              week={week}
              services={services}
              timeZone={timeZone}
              onSaved={() => setReload((n) => n + 1)}
              onSearch={() => setSearching(true)}
              view={mobileView}
              onViewChange={chooseMobileView}
              className="min-h-0 flex-1"
            />
          </m.div>
        )}
      </AnimatePresence>

      {/* **The search comes down over the calendar from the top edge.** It used
          to replace it outright, which is the same end state arrived at with no
          account of where it came from — the screen simply became something
          else. Sliding it down from the indicators says the field arrived from
          the top of the phone, which is where the bar it lands in already was,
          and leaving on the way it came says it went back there.

          Over rather than instead: the calendar stays mounted underneath, so it
          keeps its scroll position and the year of months is not rebuilt for a
          search somebody may close a second later. `bg-ground` is what stops it
          showing through.

          `m` without a `LazyMotion` of its own — `PageTransition` wraps every
          page in one, so the features are already above this. */}
      <AnimatePresence initial={false}>
        {searching && (
          <m.div
            key="search"
            initial={reduce ? false : { y: '-100%' }}
            animate={{ y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '-100%' }}
            // In on the sheet's own curve, which eases *in* as well as out so
            // the panel gathers speed rather than leaving at full pace; out
            // faster and on an ease-in, as everywhere else here — a thing you
            // dismissed should be getting out of the way.
            transition={
              reduce
                ? { duration: 0 }
                : {
                    duration: 0.36,
                    ease: [0.32, 0.72, 0, 1],
                  }
            }
            className="absolute inset-0 z-30 flex flex-col bg-ground sm:hidden"
          >
            <MobileSearch
              onClose={() => setSearching(false)}
              services={services}
              week={week}
              timeZone={timeZone}
              onSaved={() => setReload((n) => n + 1)}
              className="min-h-0 flex-1"
            />
          </m.div>
        )}
      </AnimatePresence>

      <aside className="hidden min-h-[300px] w-full shrink-0 flex-col gap-4 border-t border-line p-4 sm:flex xl:min-h-0 xl:w-[calc(300px+2rem)] xl:border-t-0 xl:border-l">
        <div className="shrink-0">
          <MonthCalendar
            value={selected}
            onChange={setSelected}
            marked={marked}
          />
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

            **It is handed nothing, so it draws its empty state.** The three
            invented rows that used to be here are gone — `/inbox` reads the
            real `GET /conversations` now, and this feed should show the same
            answer rather than a second, fictional one. Wiring it to that
            endpoint is the next thing it wants; until then an empty feed is
            true. */}
        <ChatFeed
          timeZone={timeZone}
          className="hidden xl:flex"
        />
      </aside>
    </div>
  )
}
