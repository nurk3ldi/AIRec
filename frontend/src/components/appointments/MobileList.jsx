import NowCard from './NowCard'
import UpNextCard from './UpNextCard'
import FreeSlotCard from './FreeSlotCard'
import ChatFeed from './ChatFeed'

/**
 * The other half of the day, on a phone: what is happening now, what is next,
 * where the next gap is, and who is messaging.
 *
 * **The same four things the desktop puts around its grid**, in one column
 * instead of a row and a side panel. On a wide screen they can sit beside the
 * timetable because there is room for both; on a phone there is not, so they
 * become somewhere you go rather than something you glance at — which is what
 * the switcher in the bar is for.
 *
 * **Each card keeps a definite height.** All three are written `h-full
 * min-h-0`, because on the desktop they fill a region the page has already
 * sized — and `UpNextCard`'s list scrolls inside that. Dropped into a column
 * that scrolls, `h-full` resolves to auto, the `flex-1` inside collapses and
 * the list stops scrolling. 180px is the same shape those cards were designed
 * at, and giving it to them here is what keeps their own behaviour intact.
 */

/** What one card gets. Enough for the countdown, two lines of a booking, or two
 *  rows of the queue — below that the cards start hiding their own content. */
const CARD_HEIGHT = 180

export default function MobileList({
  bookings,
  week,
  timeZone,
  controls,
  className = '',
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      {controls}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
        <div style={{ height: CARD_HEIGHT }}>
          <NowCard bookings={bookings} timeZone={timeZone} />
        </div>
        <div style={{ height: CARD_HEIGHT }}>
          <UpNextCard bookings={bookings} timeZone={timeZone} />
        </div>
        <div style={{ height: CARD_HEIGHT }}>
          <FreeSlotCard bookings={bookings} week={week} timeZone={timeZone} />
        </div>

        {/* **In the same column as the cards, not below in a region of its
            own.** It is the fourth thing you came here to check, and a feed
            with a scroll of its own inside a column that already scrolls is two
            scrolls fighting over one thumb. Given a height, it becomes another
            card in the stack — the last one, because the three above it are
            about the next hour and this is about everyone else. */}
        <div style={{ height: CARD_HEIGHT * 2 }}>
          <ChatFeed chats={null} timeZone={timeZone} className="flex" />
        </div>
      </div>
    </div>
  )
}
