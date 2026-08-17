import Link from 'next/link'
import { useRouter } from 'next/router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  Home01Icon,
  Notification01Icon,
} from '@hugeicons/core-free-icons'

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
  const router = useRouter()
  const title = pageTitles[router.pathname] ?? 'AIRec'
  const isOnNotifications = router.pathname === '/notifications'
  const isOnDashboard = router.pathname === '/dashboard'

  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-4 border-b border-[#999999]/25 bg-white px-4 sm:px-6 lg:px-8">
      {/* A real breadcrumb, not a title styled to look like one: an ordered
          list, with the trail marked up as such, so it reads as a path out of
          here rather than as a heading. The last crumb stays the page's `h1` —
          it is still the only heading the page has. */}
      <nav aria-label="Навигация по разделам" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1">
          <li className="shrink-0">
            <Link
              href="/dashboard"
              aria-label="Главная"
              // Only the trail's own root is a link. On the dashboard itself
              // the icon still shows, so the path never starts halfway.
              aria-current={isOnDashboard ? 'page' : undefined}
              className="grid h-7 w-7 place-items-center rounded-lg text-[#999999] outline-none transition-colors hover:bg-[#171215]/6 hover:text-[#171215] focus-visible:bg-[#171215]/6 focus-visible:text-[#171215]"
            >
              <HugeiconsIcon
                icon={Home01Icon}
                size={16}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </Link>
          </li>

          <Separator />

          <li className="min-w-0">
            <h1
              aria-current="page"
              className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[#171215]"
            >
              {title}
            </h1>
          </li>
        </ol>
      </nav>

      {/* Lives in the header rather than the sidebar rail: notifications are
          about *right now*, so they belong next to the page you're on rather
          than in the list of places you can go. */}
      <Link
        href="/notifications"
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

/** The `›` between crumbs. Hidden from assistive tech — the list already says
 *  these are steps on a path, and reading "greater than" adds nothing. */
function Separator() {
  return (
    <li aria-hidden className="grid shrink-0 place-items-center text-[#999999]">
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </li>
  )
}
