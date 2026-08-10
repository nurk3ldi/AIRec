import { useRouter } from 'next/router'

const pageTitles = {
  '/dashboard': 'Главная',
  '/inbox': 'Диалоги',
  '/appointments': 'Записи',
  '/analytics': 'Аналитика',
  // English by explicit request, unlike the rest of the dashboard chrome.
  '/profile': 'Profile',
}

function titleFor(pathname) {
  // Every /profile/* section renders its own heading; the chrome keeps showing
  // the parent title so the two don't repeat each other.
  if (pathname.startsWith('/profile')) return pageTitles['/profile']
  return pageTitles[pathname] ?? 'AIRec'
}

export default function Header() {
  const router = useRouter()
  const title = titleFor(router.pathname)

  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center border-b border-[#999999]/25 bg-white px-4 sm:px-6 lg:px-8">
      <h1 className="truncate text-[16px] font-semibold tracking-[-0.025em] text-[#171215] sm:text-[18px]">
        {title}
      </h1>
    </header>
  )
}
