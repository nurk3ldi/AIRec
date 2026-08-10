import { useRouter } from 'next/router'

// Profile has no entry here on purpose: it's an overlay opened from the
// sidebar, not a route, so the page underneath keeps its own title.
const pageTitles = {
  '/dashboard': 'Главная',
  '/inbox': 'Диалоги',
  '/appointments': 'Записи',
  '/analytics': 'Аналитика',
}

export default function Header() {
  const router = useRouter()
  const title = pageTitles[router.pathname] ?? 'AIRec'

  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center border-b border-[#999999]/25 bg-white px-4 sm:px-6 lg:px-8">
      <h1 className="truncate text-[16px] font-semibold tracking-[-0.025em] text-[#171215] sm:text-[18px]">
        {title}
      </h1>
    </header>
  )
}
