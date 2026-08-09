import { useRouter } from 'next/router'

const pageTitles = {
  '/dashboard': 'Главная',
  '/inbox': 'Диалоги',
  '/appointments': 'Записи',
  '/analytics': 'Аналитика',
  // English by explicit request — the whole /profile section is in English,
  // so a Russian chrome title on top of it would read as a bug.
  '/profile': 'Profile',
}

function titleFor(pathname) {
  // /profile/* are sections of one page — the section's own name is rendered
  // by ProfileLayout, so the chrome keeps showing the parent title.
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
