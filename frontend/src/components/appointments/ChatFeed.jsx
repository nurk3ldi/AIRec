import { Link } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { clockOf } from '../../lib/appointments'
import { useT } from '../../lib/i18n'

/**
 * The conversations the assistant has open, under the calendar.
 *
 * **It fills the room the month leaves rather than being placed in it.** The
 * right panel is the page's full height and the calendar is a fixed 300px card
 * at the top of it; everything below was empty, on the one screen where the
 * owner is already looking. A feed is the right shape for that space — it has
 * no natural height, so it takes whatever is left and scrolls inside itself.
 *
 * **Why chats and not more bookings.** The three cards over the timetable
 * already answer every question the calendar can: who is in the chair, who is
 * next, when there is a gap. What none of them answers is the other half of the
 * day — somebody is messaging right now and has not been dealt with. That is
 * the thing you want visible while you are looking at the week, and it is
 * exactly the thing that is invisible until you leave for «Диалоги».
 *
 * **The feed is empty and honestly so.** There is no channel behind `/inbox`
 * yet and no message table under it, so nothing is fetched here and nothing is
 * invented: an analytics screen built on made-up figures was put on `/dashboard`
 * and taken back out for that reason. What exists is the shape, the row, and
 * the empty state a real new account would see anyway — the day the endpoint
 * lands, this takes a `chats` array and draws it.
 *
 * A chat is `{ id, at, client, preview, state }`, where `at` is an ISO instant
 * and `state` is one of `CHAT_TONE`'s keys. **They are drawn in the order they
 * are given and the newest belongs first** — this does no sorting of its own,
 * because the order a feed arrives in is the endpoint's answer to give, but a
 * feed that appends puts every new chat at the bottom of a box that scrolls,
 * which is the opposite of what "new chats drop in here" means.
 */

/**
 * What a chat's state is said in.
 *
 * The same rule the grid's `STATUS_TONE` follows and for the same reason: the
 * colour is the signal, so it is spent on the two states that need looking at
 * and withheld from the one that does not. `waiting` is `--now` — somebody is
 * on the other end *at this moment*, which is what that orange means everywhere
 * else in this product. `new` is `ok`: it arrived, nothing is wrong, and it is
 * not yet late. A chat already answered is muted, because it is the ordinary
 * case and a feed where every row is coloured is a feed that points nowhere.
 */
const CHAT_TONE = {
  waiting: 'text-now',
  new: 'text-ok',
}

const STATE_KEYS = {
  waiting: 'chat.waiting',
  new: 'chat.new',
  answered: 'chat.answered',
}

export default function ChatFeed({ chats, timeZone, className = '' }) {
  const t = useT()

  return (
    // `min-h-0` beside `flex-1` is what lets the list inside actually scroll:
    // without it a flex item refuses to shrink under its content and the
    // overflow lands on the page, which on this screen has nowhere to put it.
    //
    // `display` is deliberately *not* set here. The caller decides at which
    // breakpoint this exists at all, and a `flex` baked in would fight the
    // `hidden` it is given — so the class it passes carries both.
    <section
      className={`min-h-0 flex-1 flex-col ${className}`}
      aria-label={t('nav.inbox')}
    >
      {/* The heading and the way out of it, on one line — the same pairing the
          reference uses. «Все» goes to the screen this is a window onto, so the
          feed never has to grow a "show more" of its own. */}
      <header className="flex shrink-0 items-center justify-between gap-2 pb-2">
        <h2 className="font-display text-[15px] font-semibold text-ink">
          {t('nav.inbox')}
        </h2>
        <Link
          to="/inbox"
          className="flex items-center gap-0.5 rounded-lg py-1 text-[13px] text-muted outline-none transition-colors hover:text-ink focus-visible:text-ink"
        >
          {t('chat.all')}
          <HugeiconsIcon icon={ArrowRight01Icon} size={15} strokeWidth={2} />
        </Link>
      </header>

      {chats?.length ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {chats.map((chat) => (
            <ChatRow key={chat.id} chat={chat} timeZone={timeZone} />
          ))}
        </div>
      ) : (
        // Centred in what is left rather than sitting under the heading: an
        // empty state pinned to the top of a tall box reads as a list that
        // failed to load, where one in the middle reads as a box with nothing
        // in it yet.
        <p className="grid min-h-0 flex-1 place-items-center px-4 text-center text-[13px] text-muted">
          {t('chat.empty')}
        </p>
      )}
    </section>
  )
}

/**
 * One conversation.
 *
 * **The time is the loudest thing on the row**, as it is in the reference: a
 * feed is read down the left edge, and when something came in is what orders it
 * in the reader's head. The state sits opposite it, and the line underneath is
 * who and about what — the same order the booking cards use, which is what
 * keeps the two halves of this screen reading as one product.
 *
 * `surface-raised`, no border: the edgeless card this page already uses for the
 * three above the timetable. On the dark theme `surface` and `ground` are the
 * same black, so a card without a fill of its own would be nothing at all.
 */
function ChatRow({ chat, timeZone }) {
  const t = useT()
  const tone = CHAT_TONE[chat.state] ?? 'text-muted'

  return (
    <Link
      to="/inbox"
      className="block rounded-xl bg-surface-raised px-3 py-2.5 outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-display text-[17px] leading-none font-semibold tracking-[-0.01em] text-ink">
          {clockOf(chat.at, timeZone)}
        </span>
        <span
          className={`flex shrink-0 items-center gap-1.5 text-[12px] leading-none font-medium ${tone}`}
        >
          {t(STATE_KEYS[chat.state] ?? 'chat.answered')}
          {/* `currentColor`, so the dot and the word cannot drift apart. */}
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
          />
        </span>
      </span>

      <span className="mt-1.5 block truncate text-[13px] leading-tight text-ink">
        {chat.client}
      </span>

      {chat.preview && (
        <span className="mt-0.5 block truncate text-[12px] leading-tight text-muted">
          {chat.preview}
        </span>
      )}
    </Link>
  )
}
