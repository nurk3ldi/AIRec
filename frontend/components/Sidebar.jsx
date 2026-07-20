import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  Calendar,
  ChatBubbleEmpty,
  Group,
  Settings,
  User,
  ViewGrid,
} from 'iconoir-react'
import BrandMark from './BrandMark'

const navigation = [
  { label: 'Басты бет', href: '/', icon: ViewGrid },
  { label: 'Диалогтар', href: '/inbox', icon: ChatBubbleEmpty },
  { label: 'Жазбалар', href: '/appointments', icon: Calendar },
  { label: 'Клиенттер', href: '/clients', icon: Group },
  { label: 'Баптаулар', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const router = useRouter()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-16 flex-col overflow-visible border-r border-[#999999]/45 bg-[#171215] text-white shadow-[6px_0_20px_rgba(23,18,21,0.08)]">
      <div className="flex h-[68px] shrink-0 items-center justify-center border-b border-[#999999]/30">
        <Link href="/" aria-label="AIReca басты беті">
          <BrandMark />
        </Link>
      </div>

      <nav
        className="flex flex-1 flex-col items-center gap-3.5 py-6"
        aria-label="Негізгі навигация"
      >
        {navigation.map((item) => {
          const isActive = router.pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative grid h-9 w-9 place-items-center rounded-[10px] transition-all duration-200 ${
                isActive
                  ? 'bg-[#3248F2] text-white shadow-[0_8px_22px_rgba(50,72,242,0.38)]'
                  : 'text-[#999999] hover:bg-[#F6F8FA]/10 hover:text-[#FFFFFF]'
              }`}
            >
              <Icon width={17} height={17} strokeWidth={1.5} />
              <span className="pointer-events-none absolute left-[46px] z-50 whitespace-nowrap rounded-md bg-[#171215] px-2.5 py-1.5 font-sans text-[11px] font-medium text-white opacity-0 shadow-xl transition-all duration-150 group-hover:translate-x-1 group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <button
        type="button"
        className="group relative mx-auto mb-[18px] grid h-6 w-6 shrink-0 place-items-center overflow-visible rounded-full border border-[#F6F8FA] bg-[radial-gradient(circle_at_35%_25%,#999999_0%,#171215_70%)] text-white transition-transform hover:scale-105"
        aria-label="Профиль"
      >
        <User width={14} height={14} strokeWidth={1.5} />
        <span className="absolute bottom-[-1px] right-[-1px] h-1.5 w-1.5 rounded-full border border-[#171215] bg-[#3248F2]" />
        <span className="pointer-events-none absolute left-[34px] whitespace-nowrap rounded-md bg-[#171215] px-2.5 py-1.5 font-sans text-[11px] font-medium opacity-0 shadow-xl transition-all group-hover:translate-x-1 group-hover:opacity-100">
          Нұркелді
        </span>
      </button>
    </aside>
  )
}
