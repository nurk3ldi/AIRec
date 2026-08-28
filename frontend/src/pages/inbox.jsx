import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon } from '@hugeicons/core-free-icons'
import { useT } from '../lib/i18n'
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
 * Being built in pieces. Right now this is the layout and nothing else — the
 * list, the thread and the controls come next.
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

export default function InboxPage() {
  const t = useT()
  /**
   * What is typed in the search box.
   *
   * Held here rather than inside the field because it is the *list* that
   * answers it, and the list is this page's to render. Nothing consumes it yet
   * — the rows come next — and it is deliberately not sent anywhere on its own:
   * `GET /conversations?query=` searches names, numbers and the text of every
   * message, and firing that at a screen with nothing to draw the answer on
   * would be a request nobody could read.
   */
  const [query, setQuery] = useState('')

  return (
    // **A definite height, not a minimum**, exactly as `/appointments` carries
    // one and for the same reason: the two panels each scroll inside
    // themselves, and `items-stretch` can only measure a child against a
    // height that is definite. Under a `min-height` the flex chain has an
    // indefinite cross size, every `flex-1` inside resolves to its own content,
    // and the page grows a scrollbar instead of the list having one.
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
        <div className="shrink-0 px-4 py-3">
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
      </aside>

      {/* The thread. Empty ground for now, and hidden below `sm` — on a phone
          this is a screen you go to rather than a panel you look at. */}
      <section className="hidden min-w-0 flex-1 flex-col overflow-hidden sm:flex" />
    </div>
  )
}
