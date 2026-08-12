import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Home01Icon,
  Chat01Icon,
  NoteIcon,
  Building03Icon,
} from '@hugeicons/core-free-icons'
import { mediaUrl } from '../lib/api'
import BrandMark from './BrandMark'
import ProfileAvatar from './ProfileAvatar'
import ProfileDialog from './ProfileDialog'
import ProfileMenu from './ProfileMenu'

const navigation = [
  { label: 'Главная', href: '/dashboard', icon: Home01Icon },
  { label: 'Диалоги', href: '/inbox', icon: Chat01Icon },
  { label: 'Записи', href: '/appointments', icon: NoteIcon },
  { label: 'Бизнес', href: '/business', icon: Building03Icon },
]

export default function Sidebar({ user = null, onUserChange }) {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // null = dialog closed; otherwise the section id it's showing.
  const [dialogSection, setDialogSection] = useState(null)

  // Navigating elsewhere should leave the menu closed behind you.
  useEffect(() => {
    setIsMenuOpen(false)
  }, [router.pathname])

  const openSection = (sectionId) => {
    setIsMenuOpen(false)
    setDialogSection(sectionId)
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-16 flex-col overflow-visible border-r border-[#999999]/45 bg-[#171215] text-white shadow-[6px_0_20px_rgba(23,18,21,0.08)]">
      <div className="flex h-[68px] shrink-0 items-center justify-center border-b border-[#999999]/30">
        <Link href="/dashboard" aria-label="Главная страница AIRec">
          <BrandMark />
        </Link>
      </div>

      <nav
        className="flex flex-1 flex-col items-center gap-3.5 py-6"
        aria-label="Основная навигация"
      >
        {navigation.map((item) => {
          const isActive = router.pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative grid h-9 w-9 place-items-center rounded-[10px] transition-all duration-200 ${
                isActive
                  ? 'bg-[#3248F2] text-white shadow-[0_8px_22px_rgba(50,72,242,0.38)]'
                  : 'text-white hover:bg-[#F6F8FA]/10'
              }`}
            >
              <HugeiconsIcon
                icon={item.icon}
                size={18}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.15}
              />
              <span className="pointer-events-none absolute left-[46px] z-50 whitespace-nowrap rounded-md bg-[#171215] px-2.5 py-1.5 font-sans text-[11px] font-medium text-white opacity-0 shadow-xl transition-all duration-150 group-hover:translate-x-1 group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <button
        type="button"
        data-profile-menu-toggle
        onClick={() => setIsMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-label="Профиль"
        // No blue active state here, unlike the nav items above: the avatar is
        // already a picture, and a coloured frame around it reads as a stray
        // border rather than "this is selected".
        className="group relative mx-auto mb-[18px] grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-white outline-none transition-colors duration-200 hover:bg-[#F6F8FA]/10 focus-visible:bg-[#F6F8FA]/10"
      >
        <ProfileAvatar src={mediaUrl(user?.avatar_url)} />
        {/* Hidden while the menu is open — the panel already names everything
            it points at, so the tooltip would just overlap it. */}
        {!isMenuOpen && (
          <span className="pointer-events-none absolute left-[46px] z-50 whitespace-nowrap rounded-md bg-[#171215] px-2.5 py-1.5 font-sans text-[11px] font-medium text-white opacity-0 shadow-xl transition-all duration-150 group-hover:translate-x-1 group-hover:opacity-100">
            Профиль
          </span>
        )}
      </button>

      {isMenuOpen && (
        <ProfileMenu
          user={user}
          onOpenSection={openSection}
          onClose={() => setIsMenuOpen(false)}
        />
      )}

      {dialogSection && (
        <ProfileDialog
          section={dialogSection}
          user={user}
          onClose={() => setDialogSection(null)}
          onUserChange={onUserChange}
        />
      )}
    </aside>
  )
}
