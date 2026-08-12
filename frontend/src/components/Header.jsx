import Link from 'next/link'
import { useRouter } from 'next/router'
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
  const router = useRouter()
  const title = pageTitles[router.pathname] ?? 'AIRec'
  const isOnNotifications = router.pathname === '/notifications'

  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-4 border-b border-[#999999]/25 bg-white px-4 sm:px-6 lg:px-8">
      <h1 className="truncate text-[16px] font-semibold tracking-[-0.025em] text-[#171215] sm:text-[18px]">
        {title}
      </h1>

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
