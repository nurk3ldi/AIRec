import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight02Icon,
  Notification01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { getUnreadCount } from '../lib/api'
import { authed } from '../lib/auth'
import { useT } from '../lib/i18n'
import { PANEL_MOTION } from './appointments/panel'

/**
 * The notifications window's fill — one step off a card's, so the cards inside
 * it can wear the card fill and sit *in* the window rather than on top of it.
 * The notch has to be painted the same, so it is one constant.
 */
const WINDOW_FILL = 'color-mix(in oklab, var(--color-ink) 5%, var(--color-surface-raised))'
import TelegramIsland from './TelegramIsland'
import TelegramFeed from './notifications/TelegramFeed'
import { useTelegramFeed } from './notifications/useTelegramFeed'

// Translation keys rather than titles: this map is built once at import, so a
// translated string would freeze in whichever language loaded first.
//
// Profile has no entry here on purpose — it's an overlay opened from the
// sidebar, not a route, so the page underneath keeps its own title. (It is
// listed all the same because `/profile` *is* a route on a phone; the header is
// hidden there, which is why it never shows.)
const PAGE_TITLE_KEYS = {
  '/dashboard': 'nav.dashboard',
  '/notifications': 'nav.notifications',
  '/inbox': 'nav.inbox',
  '/appointments': 'nav.appointments',
  '/assistant': 'nav.assistant',
  '/notes': 'nav.notes',
  '/profile': 'nav.profile',
}

export default function Header({ className = '' }) {
  const t = useT()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const titleKey = PAGE_TITLE_KEYS[pathname]
  const title = titleKey ? t(titleKey) : 'AIRec'

  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const bellRef = useRef(null)
  const anchorRef = useRef(null)
  const notch = useBellNotch(notificationsOpen, bellRef, anchorRef)
  const unread = useUnread()
  const telegram = useTelegramFeed(notificationsOpen)

  return (
    // **The notifications window spans the whole screen, not the header.** It
    // lies over everything — the navigation rail included — at 99% of the
    // viewport's width, centred, with 0.5% of air at each edge. Its anchor is an
    // invisible, full-width line fixed at the header's bottom edge: Radix
    // centres the panel on it and reports its width as
    // `--radix-popover-trigger-width`, which is what the 99% is taken of (the
    // header itself stops at the rail, so it would have centred the panel
    // 32px off). The bell stays the trigger that opens and closes it.
    <Popover.Root open={notificationsOpen} onOpenChange={setNotificationsOpen}>
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
          <HeaderButton
            ref={bellRef}
            label={t('nav.notifications')}
            icon={Notification01Icon}
            dot={unread > 0}
          />
        </Popover.Trigger>
      </div>
    </header>

    <Popover.Anchor asChild>
      <div
        ref={anchorRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-[68px] h-0"
      />
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
        sideOffset={PANEL_OFFSET}
        avoidCollisions={false}
        aria-label={t('nav.notifications')}
        // Grows out of the bell rather than out of the middle of the screen —
        // the window came from that button, and the notch says so too.
        style={{ ...(notch ? { transformOrigin: `${notch.centre}px ${notch.top}px` } : {}), background: WINDOW_FILL }}
        className={`rounded-[20px] corner-smooth border border-card-edge ${PANEL_MOTION} z-[60] flex h-[60vh] w-[calc(var(--radix-popover-trigger-width)*0.99)] flex-col shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] outline-none`}
      >
        {notch && <BellNotch notch={notch} />}

        {/* **Four columns, each a heading card over a body card** — eight
            cards, empty for now. No edges: they sit inside a window that
            already has one, and a frame inside a frame is noise; a fill one
            step off the window's is what separates them. 8px of air all round,
            so their 12px corners run concentric with the window's 20px. On a
            phone four columns do not fit side by side, so they become a shelf
            that scrolls sideways, the next column peeking in. */}
        <div className="flex min-h-0 flex-1 snap-x gap-2 overflow-x-auto p-2 pb-0 sm:grid sm:grid-cols-4 sm:overflow-visible">
          {NOTIFICATION_COLUMNS.map((column) => (
            <div
              key={column}
              className="flex w-[78%] shrink-0 snap-start flex-col gap-1 sm:w-auto"
            >
              {/* The heading: the column's name with how many it holds, and
                  «Очистить всё» against the right edge — both as the reference
                  has them. The count is 0 and the button clears nothing yet,
                  there being nothing in the column. */}
              <div className="flex h-12 shrink-0 items-center justify-between gap-2 rounded-t-[12px] corner-smooth bg-surface-raised pr-2.5 pl-4">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[14px] font-medium text-ink">
                    {t(`notifications.${column}`)}
                  </span>
                  <span className="shrink-0 rounded-md bg-ink/8 px-1.5 text-[12px] leading-5 text-muted tabular-nums">
                    {column === 'telegram' ? (telegram?.length ?? 0) : 0}
                  </span>
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded-md px-1.5 py-1 text-[13px] font-medium text-ink outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97]"
                >
                  {t('notifications.dismissAll')}
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-b-[12px] corner-smooth bg-surface-raised">
                {column === 'telegram' && (
                  <TelegramFeed
                    rows={telegram}
                    onOpen={(id) => {
                      setNotificationsOpen(false)
                      navigate(`/inbox?chat=${id}`)
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* **The way to the whole list, and nothing else in the footer.** One
            text button held to the bottom centre, no strip behind it — the
            arrow says it leads somewhere rather than acting here. It closes the
            window as it goes, or the window would sit over the page it just
            opened. */}
        <div className="grid h-14 shrink-0 place-items-center">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen(false)
              navigate('/notifications')
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[14px] font-medium text-ink outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97]"
          >
            {t('notifications.viewAll')}
            <HugeiconsIcon icon={ArrowRight02Icon} size={16} strokeWidth={2} />
          </button>
        </div>
      </Popover.Content>
    </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * How many conversations have something unread, for the bell's dot.
 *
 * Read on mount and every 15 seconds while the tab is visible — the same rhythm
 * as «Диалоги»; a failure keeps the last answer rather than flashing the dot
 * off.
 */
function useUnread() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let alive = true
    const read = () =>
      authed(getUnreadCount)
        .then((value) => alive && setCount(Number(value) || 0))
        .catch(() => {})
    read()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') read()
    }, 15000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  return count
}

/**
 * The window's four columns, left to right. Keys, not labels — translated at
 * render. Telegram holds the right edge, where the bell that opens the window
 * is, with the assistant beside it: the two that speak for the business in
 * conversations sit nearest the thing you pressed.
 */
const NOTIFICATION_COLUMNS = ['system', 'news', 'assistant', 'telegram']

/** The notch's geometry, in px. */
const NOTCH_WIDTH = 18 // the caret's base, centred under the bell glyph
const NOTCH_GAP = 4 // air between the bottom of the glyph and the caret's tip
const NOTCH_TIP = 5 // how much the tip is rounded, along each side — enough to read blunt
const NOTCH_FLARE = 3 // the soft curve where each side meets the window's edge
const BELL_GLYPH = 18 // the icon's size inside the 36px button
// **Negative, so the window hangs close under the icon** rather than below the
// header: the anchor line is the header's bottom edge (68px), the bell glyph
// ends at 43px, and the window starts 14px under the glyph — over the lower
// band of the header, which it is allowed to cover since it lies over the site.
const PANEL_OFFSET = -11

/**
 * Where the notch goes, measured once per opening (and on resize) — not while
 * anything animates, so a scaled frame is never read. The window's own box is
 * known without measuring it: it hangs `PANEL_OFFSET` under the anchor line
 * and is 99% of its width, centred.
 */
function useBellNotch(open, bellRef, anchorRef) {
  const [notch, setNotch] = useState(null)

  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const bell = bellRef.current?.getBoundingClientRect()
      const anchor = anchorRef.current?.getBoundingClientRect()
      if (!bell || !anchor) return
      const panelLeft = anchor.left + (anchor.width * 0.01) / 2
      const panelTop = anchor.top + PANEL_OFFSET
      const centre = bell.left + bell.width / 2 - panelLeft
      // From the glyph, not the button: the button's 36px box is invisible
      // while closed, so a notch measured from it floated away from the icon.
      const glyphBottom = bell.top + bell.height / 2 + BELL_GLYPH / 2
      const top = glyphBottom + NOTCH_GAP - panelTop
      setNotch({
        left: centre - NOTCH_WIDTH / 2 - NOTCH_FLARE,
        top,
        // Down to the window's top edge and 1px past it, so the window's own
        // hairline is covered where the two become one shape.
        height: -top + 1,
        centre,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, bellRef, anchorRef])

  return open ? notch : null
}

/**
 * A small caret under the bell, joining it to the window it opened.
 *
 * **Under the icon, not around it, and pointed.** A tab wrapping the whole bell
 * was built first and read as a box pulled over the button, then a rounded bump
 * that read as a second button; what connects them is a triangle rising from
 * the window's top edge to just below the glyph, tip and joins softened, so the
 * window visibly points at the thing that opened it while the bell stays as
 * it is.
 *
 * An SVG, because the flares have to be a curved *line* as well as a curved
 * fill, and a border cannot bend inwards. The stroke leaves the bottom open,
 * which is where the notch and the window are the same surface.
 */
function BellNotch({ notch }) {
  const w = NOTCH_WIDTH
  const f = NOTCH_FLARE
  const t = NOTCH_TIP
  const h = notch.height
  const width = w + f * 2
  // The line runs along the middle of the window's own 1px top edge (`b`), so
  // the caret's stroke and the window's border are one line where they meet.
  const b = h - 0.5
  const tip = { x: width / 2, y: 0.5 }
  const leftBase = { x: f, y: b }
  const rightBase = { x: f + w, y: b }
  // Unit vector along the left side, from its base up to the tip; the right
  // side is its mirror.
  const side = Math.hypot(w / 2, b - tip.y)
  const ux = w / 2 / side
  const uy = (tip.y - b) / side
  const at = (point, dx, dy, k) => `${point.x + dx * k} ${point.y + dy * k}`
  // A triangle with its three joins softened: a short curve off the window's
  // edge on each side, and a rounded tip — a sharp point reads as a pixel
  // error at this size, a round one as a tab.
  const outline =
    `M 0 ${b} Q ${leftBase.x} ${leftBase.y} ${at(leftBase, ux, uy, f)} ` +
    `L ${at(tip, -ux, -uy, t)} Q ${tip.x} ${tip.y} ${at(tip, ux, -uy, t)} ` +
    `L ${at(rightBase, -ux, uy, f)} Q ${rightBase.x} ${rightBase.y} ${width} ${b}`

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={h}
      viewBox={`0 0 ${width} ${h}`}
      className="pointer-events-none absolute overflow-visible"
      style={{ left: notch.left, top: notch.top }}
    >
      {/* The fill runs 1px further down than the line, over the window's
          border, so no hairline shows across the join. */}
      <path d={`${outline} L ${width} ${h} L 0 ${h} Z`} style={{ fill: WINDOW_FILL }} />
      <path
        d={outline}
        fill="none"
        stroke="var(--color-card-edge)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
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
function HeaderButton({ label, icon, dot = false, ...props }) {
  // Every other prop is spread onto the button: Radix's `asChild` hands the
  // trigger its ref, its handlers and `data-state`, and a button that swallowed
  // them would never open anything.
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className="touch-target relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-ink outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-accent/8 focus-visible:bg-accent/8 active:scale-95"
    >
      <HugeiconsIcon
        icon={icon}
        size={18}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.15}
      />
      {/* Something unread. Red, because it is the one thing in the header that
          asks to be looked at; ringed in the header's own ground so it reads
          as sitting on the bell rather than smudged into it. */}
      {dot && (
        <span
          aria-hidden="true"
          className="absolute top-[7px] right-[8px] h-2 w-2 rounded-full bg-danger ring-2 ring-ground"
        />
      )}
    </button>
  )
}
