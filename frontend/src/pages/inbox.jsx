import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon } from '@hugeicons/core-free-icons'
import {
  deleteConversation,
  getBusiness,
  listConversations,
  updateConversation,
} from '../lib/api'
import { authed } from '../lib/auth'
import { useT } from '../lib/i18n'
import ChatRow from '../components/inbox/ChatRow'
import styles from '../styles/Inbox.module.css'

/**
 * Диалоги — the conversations the assistant is having, and the one place the
 * owner can watch them.
 *
 * **The backend behind this is finished** — `conversations` and `messages`,
 * with the list, the filters, the search, unread counts, starring, archiving
 * and the assistant's own on/off switch per thread. What does not exist is the
 * WhatsApp channel itself: nothing is delivering messages in or out yet, so
 * every account's inbox is genuinely empty until it does. That is a real state
 * to design for, not a placeholder to fill with invented rows.
 *
 * **The shape is a list beside a thread**, which is what an inbox has settled
 * on everywhere: the list is where you decide what to look at and the pane
 * beside it is what you are looking at, and losing one to see the other is the
 * thing the two-pane layout exists to avoid.
 *
 * Being built in pieces. The list works against the real API — search,
 * filters and rows — and the pane beside it is still empty ground; the thread
 * itself comes next.
 */

/**
 * How wide the list is.
 *
 * **Provisional.** Wide enough for a name, a line of preview and a time on one
 * row without any of the three truncating early, and narrow enough that the
 * thread beside it keeps the screen. Written here rather than inline so it is
 * one number to argue with.
 */
const LIST_WIDTH = 'sm:w-[340px]'

/**
 * How far everything in the list panel sits from its left edge.
 *
 * **One value, read by everything in the column**, because the alignment is the
 * point: the search pill's edge, the filters under it and every row below them
 * start on the same line. Two `px-4`s written separately are two paddings that
 * agree until somebody adjusts one of them.
 */
const PANEL_X = 'px-4'

/**
 * Which threads the list is showing.
 *
 * **Keys, not words** — this is evaluated once at import, so a translated label
 * here would freeze in whichever language happened to load first and never
 * follow a change. The same rule `NAVIGATION` and `PROFILE_SECTIONS` follow.
 *
 * Both are things the API already answers: the default list is
 * `archived=false` and «Архив» is `archived=true`.
 *
 * **Two, because a filter has to divide the inbox.** «Избранное» was here and
 * is gone: pinning replaced it, and pinning is an *ordering* — a pinned thread
 * stays in the list it was already in and moves to the top of it. A segment
 * that showed only pinned threads would be asking a question nobody has, since
 * the answer is already the first rows of «Все».
 *
 * **There is deliberately no «Корзина».** `DELETE /conversations/{id}` removes
 * the row outright and cascades to its messages, and a bin was built and taken
 * back out: without a deadline it is a second archive under another name, and
 * with one it is a scheduler this project does not have. Deleting is rare and
 * guarded by two presses instead.
 */
const FILTERS = [
  { id: 'all', labelKey: 'inbox.all', params: {} },
  { id: 'archived', labelKey: 'inbox.archived', params: { archived: true } },
]

/**
 * How long the search waits before asking.
 *
 * `GET /conversations?query=` looks through names, numbers **and the text of
 * every message**, which is a real query — «Ай» on the way to «Айгерим» is
 * three of them for an answer nobody was going to read. The same 300ms the
 * calendar's search uses, so the two feel like one product.
 */
const DEBOUNCE_MS = 300

/* --- TEMPORARY: three invented threads ------------------------------------
 *
 * **Delete this block and the one line that reads it** (`const shown = …`
 * below) the moment the WhatsApp channel puts anything real in the inbox. The
 * list underneath is already wired to `GET /conversations` and works; this only
 * stands in front of it so the rows can be looked at and argued with.
 *
 * It is marked rather than trusted to be remembered because this project has
 * been here before: the `/dashboard` analytics screen was built on invented
 * figures and had to be removed whole. `/appointments` carries the same warning
 * over its own `DEMO_CHATS`, and these three continue those — same clients,
 * same conversations, so the two screens are not inventing different fictions.
 *
 * The three are chosen to show the three shapes a row can take, not to fill
 * space: one waiting on us, one the assistant has answered, and one from a
 * number that has never given a name.
 */
const demoAt = (hours, minutes) => {
  const at = new Date()
  at.setHours(hours, minutes, 0, 0)
  return at.toISOString()
}

const DEMO_CHATS = [
  {
    id: 'demo-akzere',
    client_name: 'Ақзере',
    client_phone: '+7 701 555 33 22',
    last_message_at: demoAt(16, 35),
    // The client spoke last, so no tick: this thread is waiting on us.
    last_message_author: 'client',
    last_message_preview: 'Можно перенести на завтра?',
    archived: false,
    pinned: false,
  },
  {
    id: 'demo-maksat',
    client_name: 'Мақсат',
    client_phone: '+7 705 118 40 90',
    last_message_at: demoAt(14, 20),
    // Answered by the assistant — the row carries the tick.
    last_message_author: 'assistant',
    last_message_preview: 'Записал вас на четверг, 15:00. До встречи!',
    archived: false,
    // Pinned, so it leads the list even though Ақзере wrote more recently —
    // which is the whole of what pinning does.
    pinned: true,
  },
  {
    id: 'demo-unknown',
    // No name at all, which is the ordinary case for a first message: the row
    // is titled by the number and the avatar falls back to its last two digits.
    client_name: null,
    client_phone: '+7 747 902 11 08',
    last_message_at: demoAt(11, 5),
    last_message_author: 'client',
    last_message_preview: 'Сколько стоит окрашивание?',
    archived: false,
    pinned: false,
  },
]

/**
 * The filter and the ordering, applied to the demo rows — the server does both
 * for real ones. Pinned first, then the newest message, which is exactly
 * `ConversationRepository.list`'s `ORDER BY`.
 */
const demoFor = (rows, filter) =>
  rows
    .filter((chat) => (filter === 'archived' ? chat.archived : !chat.archived))
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.last_message_at) - new Date(a.last_message_at),
    )

/**
 * The menu's actions, applied to the demo rows in memory.
 *
 * **The demo has to answer the menu or the menu looks broken.** These rows are
 * the only ones on screen until a channel exists, so a pin that does nothing to
 * them is a pin that does nothing at all as far as anybody can see. The same
 * three changes the server makes: a flag flipped, or the row gone.
 */
const demoAfter = (rows, chat, action) =>
  action === 'delete'
    ? rows.filter((row) => row.id !== chat.id)
    : rows.map((row) => (row.id === chat.id ? { ...row, ...action } : row))
/* --- end TEMPORARY ------------------------------------------------------- */

export default function InboxPage() {
  const t = useT()

  /**
   * What is typed in the search box.
   *
   * Held here rather than inside the field because it is the *list* that
   * answers it, and the list is this page's to render. It reaches the server
   * debounced — see `DEBOUNCE_MS` — because `?query=` searches names, numbers
   * and the text of every message, which is a real query rather than a filter
   * over rows already in memory.
   */
  const [query, setQuery] = useState('')

  /** Which of `FILTERS` is chosen. */
  const [filter, setFilter] = useState('all')

  /**
   * The threads themselves.
   *
   * `null` until the first answer lands, which is what separates "still asking"
   * from "asked, and there are none" — the empty state must not flash on the
   * way to a list that turns out to have rows in it.
   */
  const [chats, setChats] = useState(null)

  // TEMPORARY — state rather than the constant, so the menu can actually change
  // these. Delete with the block above.
  const [demoRows, setDemoRows] = useState(DEMO_CHATS)

  // Bumped after a menu action. A counter rather than a boolean, because two
  // actions in a row have to be two reloads and `true → true` is no change —
  // the same reason `/appointments` counts its reloads.
  const [reload, setReload] = useState(0)

  // The zone the business keeps its hours in, so a timestamp on a row is the
  // hour it happened *there*. The same reasoning as the calendar's: `undefined`
  // means the browser's own zone, which is right for anyone reading this from
  // inside the country and is corrected a moment later for everyone else.
  const [timeZone, setTimeZone] = useState(undefined)

  useEffect(() => {
    let alive = true
    authed(getBusiness)
      .then((row) => alive && setTimeZone(row.timezone))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const text = query.trim()
    let alive = true
    const timer = setTimeout(() => {
      const params = FILTERS.find((item) => item.id === filter)?.params ?? {}
      authed((token) =>
        listConversations(token, { ...params, query: text || undefined }),
      )
        .then((rows) => alive && setChats(rows))
        // Swallowed like every other read on this screen: an error banner over
        // an empty list says less than the empty list does, and the fix either
        // way is to look again.
        .catch(() => alive && setChats([]))
    }, DEBOUNCE_MS)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query, filter, reload])

  /**
   * What the row's menu asks for: a PATCH of the thread's own flags, or the
   * one action that is not a flag.
   *
   * The list is re-read afterwards rather than patched in place. Starring or
   * archiving can move a thread *out* of the filter it was listed under, and
   * working that out on the client would be a second copy of a rule the server
   * already applies.
   */
  const onAction = async (chat, action) => {
    // TEMPORARY — delete with the demo block above. These rows have no id on
    // the server, so the change is made here instead of being asked for.
    if (String(chat.id).startsWith('demo-')) {
      setDemoRows((rows) => demoAfter(rows, chat, action))
      return
    }

    try {
      if (action === 'delete') {
        await authed((token) => deleteConversation(token, chat.id))
      } else {
        await authed((token) => updateConversation(token, chat.id, action))
      }
      setReload((n) => n + 1)
    } catch {
      // Swallowed like the read above: the list is re-read either way, so a
      // failed action shows as the row simply not having changed.
      setReload((n) => n + 1)
    }
  }

  // **TEMPORARY.** Delete this line together with the block above and render
  // `chats` directly — it is the real answer and is already being fetched.
  //
  // Real threads win whenever there are any, so the demo only ever stands in
  // for an inbox that is genuinely empty. A search returns nothing rather than
  // the invented rows: the one thing worse than fake data is fake data that
  // answers a question you actually asked.
  const shown = chats?.length
    ? chats
    : query.trim()
      ? []
      : demoFor(demoRows, filter)

  return (
    // **A definite height, not a minimum**, exactly as `/appointments` carries
    // one and for the same reason: the two panels each scroll inside
    // themselves, and a child can only be measured against a height that is
    // definite. Under a `min-height` the flex chain has an indefinite cross
    // size, every `flex-1` inside resolves to its own content, and the page
    // grows a scrollbar instead of the list having one.
    //
    // The numbers are the module's own, written a second time as a real
    // height: 68px header plus the 50px bottom bar and the home indicator below
    // `sm`, and the header alone from `sm` up. The two must move together.
    <div
      className={`${styles.page} flex h-[calc(100vh-118px-env(safe-area-inset-bottom))] overflow-hidden sm:h-[calc(100vh-68px)]`}
      aria-label={t('nav.inbox')}
    >
      {/* **The list, on the left and the full height of the page.**
          A hairline on its right edge and no fill of its own: the panel is a
          region of the page rather than a card laid on it, which is the same
          call `/appointments` makes for its calendar column — a card with a
          radius cannot be 100% of anything without margins to float in.

          Full width below `sm`, where there is no room for two panels and the
          list is the whole screen; the thread will open over it there. */}
      <aside
        className={`flex w-full shrink-0 flex-col overflow-hidden border-line sm:border-r ${LIST_WIDTH}`}
      >
        {/* **Search sits above the list, not inside it.** It decides what the
            list contains, so it stays put while the rows underneath scroll —
            `shrink-0` is what keeps it out of the scrolling region once there
            is one.

            The pill is the shape this app already uses for a search on a
            filled ground, from `MobileSearch`: fully round, `surface-card` for
            a fill that separates it from the page without a border, and the
            glyph placed over it rather than inside a prefix box. */}
        <div className={`shrink-0 py-3 ${PANEL_X}`}>
          <div className="relative flex h-10 items-center">
            <span className="pointer-events-none absolute left-3 grid place-items-center text-muted">
              <HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={2} />
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder={t('header.search')}
              aria-label={t('header.search')}
              // 16px up to `sm` and 14 above it, like every other field in this
              // app: iOS magnifies the page when a smaller one takes focus and
              // never magnifies back. Below `sm` this panel is the whole
              // screen, so it is a field a thumb really does tap.
              //
              // No resting ring, unlike the header's — the fill is already
              // doing that job here. Focus still draws one: a field with no
              // focus state is one a keyboard cannot find.
              className="h-full w-full appearance-none rounded-full bg-surface-card pr-3 pl-9 text-[16px] text-ink outline-none transition-shadow duration-150 placeholder:text-muted focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)] sm:text-[14px] [&::-webkit-search-cancel-button]:appearance-none"
            />
          </div>
        </div>

        {/* **Three filters, and they replace the list's title.** «Диалоги» is
            already the page title in the header directly above, so a heading
            here was the same word twice; what the column actually needs at
            this point is the choice of *which* threads it is showing.

            **The app's own segmented control**, the one `/appointments` steers
            its day/week view with: a track that is a tint of ink, and the
            chosen segment *lifted* out of it in `surface-chip`. Not the
            accent — that is pure white on the dark theme, and marking a filter
            with it would put the loudest thing on the screen beside a choice
            that only says which threads are listed. A switch is not an action;
            the pill lifts, it does not light up.

            **`flex-1`, so the three share the column evenly.** The labels are
            not the same length in any two languages — «Избранное»,
            «Таңдаулы», «Starred» — and equal cells mean the control keeps its
            shape whichever is loaded, with no row that overflows in one of
            them.

            The gutter is this wrapper rather than a margin on the track: the
            track carries a fill of its own, and `PANEL_X` is a padding. */}
        <div className={`shrink-0 pb-3 ${PANEL_X}`}>
          <div
            role="group"
            aria-label={t('nav.inbox')}
            className="flex items-center gap-0.5 rounded-full bg-ink/6 p-0.5"
          >
            {FILTERS.map((item) => {
              const isActive = item.id === filter

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  aria-pressed={isActive}
                  className={`grid h-8 min-w-0 flex-1 place-items-center truncate rounded-full px-3 text-[14px] font-medium outline-none transition-colors ${
                    isActive
                      ? 'bg-surface-chip text-ink'
                      : 'text-muted hover:text-ink focus-visible:text-ink'
                  }`}
                >
                  {t(item.labelKey)}
                </button>
              )
            })}
          </div>
        </div>

        {/* **The rows, and the only thing on this panel that scrolls.**
            `min-h-0` is what lets it: a flex item refuses to shrink below its
            content without it, so the list would push the panel taller than the
            page instead of scrolling inside it. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          {shown === null ? null : shown.length > 0 ? (
            shown.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                timeZone={timeZone}
                onAction={onAction}
              />
            ))
          ) : (
            // **Two different nothings.** A search that found nothing is a
            // result; an inbox with no threads in it is a state the product is
            // in, and it is worth saying what will eventually fill it — there
            // is no WhatsApp channel yet, so this is what every account sees.
            <p className="px-8 pt-10 text-center text-[13px] text-muted">
              {query.trim()
                ? t('inbox.nothingFound')
                : `${t('inbox.empty')} — ${t('inbox.emptyHint')}`}
            </p>
          )}
        </div>
      </aside>

      {/* The thread. Empty ground for now, and hidden below `sm` — on a phone
          this is a screen you go to rather than a panel you look at. */}
      <section className="hidden min-w-0 flex-1 flex-col overflow-hidden sm:flex" />
    </div>
  )
}
