import { Link, useLocation } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { Notification01Icon, Wallet01Icon } from '@hugeicons/core-free-icons'
import { useT } from '../lib/i18n'

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
  '/business': 'nav.business',
  '/profile': 'nav.profile',
  '/notifications': 'nav.notifications',
  '/wallet': 'nav.wallet',
}

export default function Header({ className = '' }) {
  const t = useT()
  const { pathname } = useLocation()
  const titleKey = PAGE_TITLE_KEYS[pathname]
  const title = titleKey ? t(titleKey) : 'AIRec'
  const isOnNotifications = pathname === '/notifications'
  const isOnWallet = pathname === '/wallet'

  return (
    // No fill, but a rule. Dropping the white strip was right — a filled bar is
    // a box drawn around a title and one icon — and dropping the line with it
    // was not: without it the header and the page are one flat field, which is
    // most obvious in dark mode, where there is no shadow doing the work
    // either.
    //
    // It is still `sticky`, so it will need something behind it once a page can
    // actually scroll — the ground colour, or a blur — or content will run
    // underneath and show through.
    <header
      className={`sticky top-0 z-40 h-[68px] items-center justify-between gap-4 border-b border-line-strong px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {/* On a phone the wordmark, because the rail that normally carries it is
          not there and a screen with the product's name nowhere on it reads as
          a fragment. The page title is redundant at that width anyway — the
          bottom bar names the screen you are on, permanently. */}
      <span className="font-display text-[20px] font-bold tracking-[-0.03em] text-ink sm:hidden">
        AIRec
      </span>

      {/* The page title, from `sm` up. Poppins, not the body face: setting
          headings in the display family is most of what gives the reference its
          look. 24 rather than the reference's ~30 — our header bar is 68px
          where its is far taller, and a title near that size leaves no air
          above or below it. */}
      <h1 className="hidden min-w-0 truncate font-display text-[24px] font-bold tracking-[-0.02em] text-ink sm:block">
        {title}
      </h1>

      {/* Both live in the header rather than the sidebar rail, and for the
          same reason: these are things you *check*, not places you work. The
          four screens in the rail are where the day is spent; the wallet and
          the bell are glanced at and left.

          They are also why neither is in `NAVIGATION` — the bottom bar's five
          slots are full, and this row is present on a phone too, so both stay
          reachable there without a sixth glyph squeezing the others. */}
      <div className="flex shrink-0 items-center gap-1">
        <HeaderLink
          to="/wallet"
          label={t('nav.wallet')}
          icon={Wallet01Icon}
          isActive={isOnWallet}
        />
        <HeaderLink
          to="/notifications"
          label={t('nav.notifications')}
          icon={Notification01Icon}
          isActive={isOnNotifications}
        />
      </div>
    </header>
  )
}

/**
 * One of the header's icon buttons.
 *
 * Same 18px glyph at the same stroke weight as the sidebar rail, so the two
 * sets of navigation read as one family, and the active page keeps the tint
 * rather than gaining an outline — an icon in a row of icons says "you are
 * here" with a filled ground more quietly than a border does.
 */
function HeaderLink({ to, label, icon, isActive }) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-ink outline-none transition-colors ${
        isActive ? 'bg-accent/8' : 'hover:bg-accent/8 focus-visible:bg-accent/8'
      }`}
    >
      <HugeiconsIcon
        icon={icon}
        size={18}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.15}
      />
    </Link>
  )
}
