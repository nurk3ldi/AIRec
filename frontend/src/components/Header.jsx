import { useRouter } from 'next/router'

const pageTitles = {
  '/': 'Главная',
  '/inbox': 'Диалоги',
  '/appointments': 'Записи',
  '/analytics': 'Аналитика',
  '/profile': 'Профиль',
}

export default function Header() {
  const router = useRouter()
  const title = pageTitles[router.pathname] ?? 'AIReca'

  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center border-b border-[#999999]/25 bg-white px-4 sm:px-6 lg:px-8">
      <h1 className="truncate text-[16px] font-semibold tracking-[-0.025em] text-[#171215] sm:text-[18px]">
        {title}
      </h1>
    </header>
  )
}
