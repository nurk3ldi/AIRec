import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
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
import {
  AnimatePresence,
  domMax,
  LazyMotion,
  m,
  useReducedMotion,
} from 'motion/react'
import ProfileMenu from './ProfileMenu'

const navigation = [
  { label: 'Главная', href: '/dashboard', icon: Home01Icon },
  { label: 'Диалоги', href: '/inbox', icon: Chat01Icon },
  { label: 'Записи', href: '/appointments', icon: NoteIcon },
  { label: 'Бизнес', href: '/business', icon: Building03Icon },
]

export default function Sidebar({ user = null, onUserChange }) {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // null = dialog closed; otherwise the section id it's showing.
  const [dialogSection, setDialogSection] = useState(null)

  // Navigating elsewhere should leave the menu closed behind you.
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  const openSection = (sectionId) => {
    setIsMenuOpen(false)
    setDialogSection(sectionId)
  }

  return (
    // `domMax`, not `domAnimation`: the sliding active marker below is a shared
    // layout animation, and layout projection is the one feature the smaller
    // bundle leaves out.
    <LazyMotion features={domMax} strict>
    <aside className="fixed inset-y-0 left-0 z-50 flex w-16 flex-col overflow-visible border-r border-[#999999]/45 bg-[#171215] text-white shadow-[6px_0_20px_rgba(23,18,21,0.08)]">
      <div className="flex h-[68px] shrink-0 items-center justify-center border-b border-[#999999]/30">
        <Link to="/dashboard" aria-label="Главная страница AIRec">
          <BrandMark />
        </Link>
      </div>

      <nav
        className="flex flex-1 flex-col items-center gap-3.5 py-6"
        aria-label="Основная навигация"
      >
        {navigation.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              to={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative grid h-9 w-9 place-items-center rounded-[10px] transition-colors duration-200 ${
                isActive ? 'text-white' : 'text-white hover:bg-[#F6F8FA]/10'
              }`}
            >
              {/* One marker for the whole rail, not a background on each item:
                  the same `layoutId` on every active state is what lets Motion
                  recognise it as the *same* element moving, so it slides from
                  the item you left to the one you picked instead of blinking
                  out here and in over there. That travel is the animation —
                  it draws the line between where you were and where you are. */}
              {isActive && (
                <m.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-[10px] bg-[#3248F2] shadow-[0_8px_22px_rgba(50,72,242,0.38)]"
                  // A spring rather than a duration: the distance between items
                  // varies, and a spring covers a long move and a short one in
                  // times that both feel right. Damped just short of a visible
                  // overshoot — this is a selection, not a bounce.
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }
                  }
                />
              )}
              {/* Above the marker: an absolutely positioned sibling paints over
                  static content whatever the DOM order, so the icon needs its
                  own stacking context or the blue square swallows it. */}
              <span className="relative z-10 grid place-items-center">
                <HugeiconsIcon
                  icon={item.icon}
                  size={18}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.15}
                />
              </span>
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

      {/* Each overlay gets its own `AnimatePresence` — separate boundaries, so
          closing the menu to open the dialog does not make Motion treat one as
          replacing the other. They live here rather than inside the components
          because both unmount when their flag clears, and a component cannot
          animate its own exit after React has removed it. */}
      <AnimatePresence>
        {isMenuOpen && (
          <ProfileMenu
            user={user}
            onOpenSection={openSection}
            onClose={() => setIsMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dialogSection && (
          <ProfileDialog
            section={dialogSection}
            user={user}
            onClose={() => setDialogSection(null)}
            onUserChange={onUserChange}
          />
        )}
      </AnimatePresence>
    </aside>
    </LazyMotion>
  )
}
