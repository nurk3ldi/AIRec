import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiBrain01Icon,
  Building03Icon,
  CreditCardIcon,
  Logout01Icon,
  Settings02Icon,
  User02Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons'
import { logout as logoutRequest, mediaUrl } from '../lib/api'
import { clearTokens, getRefreshToken } from '../lib/auth'

const MENU_ITEMS = [
  { href: '/profile/account', label: 'Account', icon: UserCircleIcon },
  { href: '/profile/subscription', label: 'Subscription', icon: CreditCardIcon },
  { href: '/profile/ai', label: 'AI Assistant', icon: AiBrain01Icon },
  { href: '/profile/business', label: 'Business', icon: Building03Icon },
  { href: '/profile/settings', label: 'Settings', icon: Settings02Icon },
]

/**
 * Popup anchored to the sidebar's profile button: identity on top, the profile
 * sections in the middle, sign-out pinned at the bottom.
 *
 * Closing is owned here rather than by the caller — a menu that stays open
 * after you click away or press Escape reads as broken.
 */
export default function ProfileMenu({ user, onClose }) {
  const router = useRouter()
  const panelRef = useRef(null)

  useEffect(() => {
    const onPointerDown = (event) => {
      // The toggle button handles its own click; ignoring it here stops the
      // menu closing and instantly reopening on the same press.
      if (event.target.closest('[data-profile-menu-toggle]')) return
      if (!panelRef.current?.contains(event.target)) onClose()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const handleSignOut = async () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      // Best effort: revoke server-side, but sign out locally either way.
      await logoutRequest(refreshToken).catch(() => {})
    }
    clearTokens()
    onClose()
    router.push('/')
  }

  const avatarSrc = mediaUrl(user?.avatar_url)

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Profile menu"
      className="fixed bottom-4 left-[72px] z-50 w-[264px] overflow-hidden rounded-2xl border border-[#999999]/20 bg-white py-2 shadow-[0_16px_40px_-8px_rgba(23,18,21,0.28)]"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#F6F8FA] ring-1 ring-[#999999]/20">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <HugeiconsIcon
              icon={User02Icon}
              size={17}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              className="text-[#999999]"
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-[#171215]">
            {user?.username || '—'}
          </p>
          <p className="truncate text-[12px] text-[#999999]">
            {user?.email || ''}
          </p>
        </div>
      </div>

      <hr className="my-1 border-t border-[#999999]/20" />

      <nav className="px-1.5 py-0.5">
        {MENU_ITEMS.map((item) => {
          const isActive = router.pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={onClose}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] transition-colors ${
                isActive
                  ? 'bg-[#F6F8FA] font-medium text-[#171215]'
                  : 'text-[#171215] hover:bg-[#F6F8FA]'
              }`}
            >
              <HugeiconsIcon
                icon={item.icon}
                size={17}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                className="shrink-0 text-[#171215]/70"
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <hr className="my-1 border-t border-[#999999]/20" />

      <div className="px-1.5 pb-0.5">
        <button
          type="button"
          role="menuitem"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[14px] text-[#DC2626] transition-colors hover:bg-[#DC2626]/8"
        >
          <HugeiconsIcon
            icon={Logout01Icon}
            size={17}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            className="shrink-0"
          />
          Sign out
        </button>
      </div>
    </div>
  )
}
