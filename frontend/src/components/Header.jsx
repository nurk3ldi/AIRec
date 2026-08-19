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
    <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-4 border-b border-[#999999]/25 bg-white px-4 sm:px-6 lg:px-8">
      {/* Just the page title. There was a breadcrumb here — a home icon, a
          chevron, then this — and it was a path of exactly two steps whose
          first step is already the sidebar's top item. A trail that never
          branches is chrome, not navigation. */}
      {/* Poppins, not the body face: setting headings in the display family is
          most of what gives the reference its look, and at this size the title
          stops being a label on the chrome and becomes the thing that says
          where you are. 24 rather than the reference's ~30 — our header bar is
          68px where its is far taller, and a 30px title in a 68px bar leaves no
          air above or below it. */}
      <h1 className="min-w-0 truncate font-display text-[24px] font-bold tracking-[-0.02em] text-[#171215]">
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
