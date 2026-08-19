import { Link, useLocation } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { Notification01Icon } from '@hugeicons/core-free-icons'

// Profile has no entry here on purpose: it's an overlay opened from the
// sidebar, not a route, so the page underneath keeps its own title.
const pageTitles = {
  '/dashboard': 'Главная',
  '/inbox': 'Диалоги',
  '/appointments': 'Записи',
  '/business': 'Бизнес',
  '/notifications': 'Уведомления',
}

export default function Header() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] ?? 'AIRec'
  const isOnNotifications = pathname === '/notifications'

  return (
    // No fill and no rule at any width: the header sits straight on the page's
    // own ground, the way the bottom bar does. A white strip with a line under
    // it is a box drawn around a title and one icon, and the grey ground below
    // already separates the content from everything above it.
    //
    // It is still `sticky`, so it will need something behind it once a page can
    // actually scroll — the ground colour, or a blur — or content will run
    // underneath and show through.
    <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      {/* On a phone the wordmark, because the rail that normally carries it is
          not there and a screen with the product's name nowhere on it reads as
          a fragment. The page title is redundant at that width anyway — the
          bottom bar names the screen you are on, permanently. */}
      <span className="font-display text-[20px] font-bold tracking-[-0.03em] text-[#171215] sm:hidden">
        AIRec
      </span>

      {/* The page title, from `sm` up. Poppins, not the body face: setting
          headings in the display family is most of what gives the reference its
          look. 24 rather than the reference's ~30 — our header bar is 68px
          where its is far taller, and a title near that size leaves no air
          above or below it. */}
      <h1 className="hidden min-w-0 truncate font-display text-[24px] font-bold tracking-[-0.02em] text-[#171215] sm:block">
        {title}
      </h1>

      {/* Lives in the header rather than the sidebar rail: notifications are
          about *right now*, so they belong next to the page you're on rather
          than in the list of places you can go. */}
      <Link
        to="/notifications"
        aria-label="Уведомления"
        aria-current={isOnNotifications ? 'page' : undefined}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[#171215] outline-none transition-colors ${
          isOnNotifications
            ? 'bg-[#3248F2]/8'
            : 'hover:bg-[#3248F2]/8 focus-visible:bg-[#3248F2]/8'
        }`}
      >
        {/* Same size and stroke weight as the sidebar rail icons, so the two
            sets of navigation read as one family. */}
        <HugeiconsIcon
          icon={Notification01Icon}
          size={18}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.15}
        />
      </Link>
    </header>
  )
}
