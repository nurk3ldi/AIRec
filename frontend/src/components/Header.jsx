import { useLocation } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Notification01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { useT } from '../lib/i18n'
import { PANEL_MOTION } from './appointments/panel'
import { CARD_EDGE } from './card'
import TelegramIsland from './TelegramIsland'

// Translation keys rather than titles: this map is built once at import, so a
// translated string would freeze in whichever language loaded first.
//
// Profile has no entry here on purpose — it's an overlay opened from the
// sidebar, not a route, so the page underneath keeps its own title. (It is
// listed all the same because `/profile` *is* a route on a phone; the header is
// hidden there, which is why it never shows.)
const PAGE_TITLE_KEYS = {
  '/dashboard': 'nav.dashboard',
  '/inbox': 'nav.inbox',
  '/appointments': 'nav.appointments',
  '/assistant': 'nav.assistant',
  '/notes': 'nav.notes',
  '/profile': 'nav.profile',
}

export default function Header({ className = '' }) {
  const t = useT()
  const { pathname } = useLocation()
  const titleKey = PAGE_TITLE_KEYS[pathname]
  const title = titleKey ? t(titleKey) : 'AIRec'

  return (
    // **The notifications window spans the whole screen, not the header.** It
    // lies over everything — the navigation rail included — at 99% of the
    // viewport's width, centred, with 0.5% of air at each edge. Its anchor is an
    // invisible, full-width line fixed at the header's bottom edge: Radix
    // centres the panel on it and reports its width as
    // `--radix-popover-trigger-width`, which is what the 99% is taken of (the
    // header itself stops at the rail, so it would have centred the panel
    // 32px off). The bell stays the trigger that opens and closes it.
    <Popover.Root>
    {/* No white strip, but a rule. Dropping the fill was right — a filled bar is
    // a box drawn around a title and one icon — and dropping the line with it
    // was not: without it the header and the page are one flat field, which is
    // most obvious in dark mode, where there is no shadow doing the work
    // either.
    //
    // **`bg-ground`, though, and that is not a fill in the visual sense.** It
    // is the colour the page behind it already is, so the header looks exactly
    // as it did with nothing behind it — until something scrolls up to it, and
    // then it is opaque instead of letting rows slide through the title. That
    // was the one thing left to do here: `sticky` without a background only
    // works while nothing beneath it can move.
    //
    // A blur (`bg-ground/80 backdrop-blur`) is the other way to do it and the
    // one to reach for if this should ever read as glass; it costs a
    // compositing layer and says "there is something under here", which is a
    // claim this header does not need to make. */}
    <header
      className={`sticky top-0 z-40 h-[68px] items-center justify-between gap-4 border-b border-line-strong bg-ground px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {/* On a phone the wordmark, because the rail that normally carries it is
          not there and a screen with the product's name nowhere on it reads as
          a fragment. The page title is redundant at that width anyway — the
          bottom bar names the screen you are on, permanently. */}
      <span className="font-display text-[20px] font-bold tracking-[-0.03em] text-ink sm:hidden">
        AIRec
      </span>

      {/* The page title, from `sm` up. The display role, which is the same
          face as the body now but still says what this line is: setting
          headings in the display family is most of what gives the reference its
          look. 24 rather than the reference's ~30 — our header bar is 68px
          where its is far taller, and a title near that size leaves no air
          above or below it. */}
      <h1 className="hidden min-w-0 truncate font-display text-[24px] font-bold tracking-[-0.02em] text-ink sm:block">
        {title}
      </h1>

      {/* A client's new Telegram message drops in over the middle of the bar
          and leaves by itself — see `TelegramIsland`. The header is `sticky`,
          so it is already the positioned box the island centres in. */}
      <TelegramIsland />

      {/* Search and the two icon links travel as one group, so the space
          between the title and the controls is a single gap rather than two
          competing ones. */}
      <div className="flex shrink-0 items-center gap-3">
        <HeaderSearch />

        {/* It lives in the header rather than the sidebar rail, and for the
            same reason: this is something you *check*, not a place you work.
            The four screens in the rail are where the day is spent; the bell is
            glanced at and left.

            That is also why it is not in `NAVIGATION` — the bottom bar's five
            slots are full, and this row is present on a phone too, so it stays
            reachable there without a sixth glyph squeezing the others.

            **A window, not a page, from 2026-09-15** — `/notifications` was
            removed; the bell opens the (still empty) window below. */}
        <Popover.Trigger asChild>
          <HeaderButton label={t('nav.notifications')} icon={Notification01Icon} />
        </Popover.Trigger>
      </div>
    </header>

    <Popover.Anchor asChild>
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-[68px] h-0" />
    </Popover.Anchor>

    <Popover.Portal>
      {/* **Empty for now**, on purpose: the window is the shape that was asked
          for, and what goes in it comes next. A floating layer, so it takes
          the floating shadow tier on top of the card edge, and it is capped to
          what fits under the header. Above the rail (`z-50`), because it lies
          over the whole site. */}
      <Popover.Content
        side="bottom"
        align="center"
        sideOffset={8}
        avoidCollisions={false}
        aria-label={t('nav.notifications')}
        className={`${CARD_EDGE} ${PANEL_MOTION} z-[60] h-[min(480px,calc(100vh-92px))] w-[calc(var(--radix-popover-trigger-width)*0.99)] shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] outline-none`}
      />
    </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * The header's search field.
 *
 * **It searches nothing yet, and nothing here pretends otherwise.** There is no
 * index and no endpoint behind it; what exists is the field, so you can click
 * it, focus it and type. It is a real `<input>` rather than a button styled to
 * look like one for exactly that reason — a button that does nothing when
 * pressed is a dead control, while a field that accepts text and has nowhere to
 * send it yet is simply unfinished.
 *
 * The reference carries a ⌘K badge on the right and this does not. A badge is a
 * promise about a key, and there is nothing on the other side of that key worth
 * opening yet — and binding one silently would be worse still, since Ctrl+K is
 * the browser's own and taking it without saying so is a shortcut nobody can
 * find and everybody trips over. It belongs here the day the field opens
 * something.
 *
 * Hidden below `sm`. A 240px pill will not share a 375px row with a wordmark
 * and two icons, and a search that reaches nothing does not earn a screen of
 * its own on a phone — when it does something, that is the moment to give it
 * one.
 */
function HeaderSearch() {
  const t = useT()

  return (
    <div className="relative hidden h-9 w-[240px] items-center sm:flex">
      <span className="pointer-events-none absolute left-3 grid place-items-center text-muted">
        <HugeiconsIcon
          icon={Search01Icon}
          size={16}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </span>

      {/* The same three-step ring every other input in the app wears, so this
          reads as the same kind of object — resting, hover, focus with a halo.
          A `box-shadow` and not a border: it sits outside the box model, so
          focus can thicken the edge without the pill growing a pixel and
          shunting the icons beside it along the row.
          `bg-surface`, not the reference's grey — the header has no fill of its
          own, so the pill sits straight on the page ground, and a pill the
          colour of the ground would be a shape you cannot see. */}
      <input
        type="search"
        placeholder={t('header.search')}
        aria-label={t('header.search')}
        className="h-full w-full appearance-none rounded-xl bg-surface pr-3 pl-9 text-[14px] text-ink shadow-[0_0_0_1px_var(--color-field)] outline-none transition-shadow duration-150 placeholder:text-muted hover:shadow-[0_0_0_1px_var(--color-field-hover)] focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)] [&::-webkit-search-cancel-button]:appearance-none"
      />
    </div>
  )
}

/**
 * One of the header's icon buttons.
 *
 * Same 18px glyph at the same stroke weight as the sidebar rail, so the two
 * sets of navigation read as one family. A button rather than a link: what it
 * opens is a window over the page, not a page.
 */
function HeaderButton({ label, icon, ...props }) {
  // Every other prop is spread onto the button: Radix's `asChild` hands the
  // trigger its ref, its handlers and `data-state`, and a button that swallowed
  // them would never open anything.
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className="touch-target relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-ink outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-accent/8 focus-visible:bg-accent/8 active:scale-95 data-[state=open]:bg-accent/8"
    >
      <HugeiconsIcon
        icon={icon}
        size={18}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.15}
      />
    </button>
  )
}
