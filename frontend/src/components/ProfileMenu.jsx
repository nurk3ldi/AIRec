import { useEffect, useRef } from 'react'
import { m, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { Logout01Icon, User02Icon } from '@hugeicons/core-free-icons'
import { PROFILE_SECTIONS } from './profile/sections'
import { logout as logoutRequest, mediaUrl } from '../lib/api'
import { clearTokens, getRefreshToken } from '../lib/auth'

/**
 * Popup anchored to the sidebar's profile button: identity on top, the profile
 * sections in the middle, sign-out pinned at the bottom.
 *
 * Section entries open `ProfileDialog` rather than navigating — the profile
 * area is an overlay, not a set of routes.
 *
 * Closing is owned here rather than by the caller — a menu that stays open
 * after you click away or press Escape reads as broken.
 */
export default function ProfileMenu({ user, onOpenSection, onClose }) {
  const navigate = useNavigate()
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
    navigate('/')
  }

  const avatarSrc = mediaUrl(user?.avatar_url)
  const reduce = useReducedMotion()

  return (
    <m.div
      ref={panelRef}
      role="menu"
      aria-label="Меню профиля"
      // Grows out of its own bottom-left corner, which is where the avatar
      // button that opened it sits — so the panel reads as coming *from* the
      // control rather than appearing over the page. The 4px shift toward the
      // rail is the same idea in the other axis.
      //
      // Safe to transform even though a stray six pixels put a scrollbar on
      // the public shell: this is `position: fixed`, and fixed elements are
      // laid out against the viewport rather than contributing to the
      // document's scrollable overflow.
      // Bottom-centre on a phone, bottom-left on a desktop: the control it
      // grows out of is the middle of the bottom bar in one and the avatar
      // beside the rail in the other.
      style={{ transformOrigin: 'bottom left' }}
      initial={reduce ? false : { opacity: 0, scale: 0.94, x: -6 }}
      animate={{
        opacity: 1,
        scale: 1,
        x: 0,
        // 320ms on a long ease-out: almost all the distance is covered early,
        // then it eases into place over the tail. That is what makes a slower
        // panel read as unhurried rather than as lag — the eye judges the
        // start, not the total.
        transition: { duration: reduce ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] },
      }}
      // Leaving stays quick. A menu you have dismissed should be gone, and
      // matching the opening time would make every close feel like a wait.
      exit={
        reduce
          ? { opacity: 0 }
          : {
              opacity: 0,
              scale: 0.97,
              x: -3,
              transition: { duration: 0.13, ease: 'easeIn' },
            }
      }
      // Desktop only: on a phone the account is `/profile`, a real screen. This
      // panel hangs off the rail's avatar button, and there is no rail below
      // `sm` for it to hang off.
      className="fixed bottom-4 left-[72px] z-50 w-[264px] overflow-hidden rounded-2xl border border-line bg-surface py-2 shadow-[0_16px_40px_-8px_rgba(23,18,21,0.28)]"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-ground ring-1 ring-line">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <HugeiconsIcon
              icon={User02Icon}
              size={17}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              className="text-muted"
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-ink">
            {user?.username || '—'}
          </p>
          <p className="truncate text-[12px] text-muted">
            {user?.email || ''}
          </p>
        </div>
      </div>

      <hr className="my-1 border-t border-line" />

      <nav className="px-1.5 py-0.5">
        {PROFILE_SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            onClick={() => onOpenSection(item.id)}
            // outline-none kills the browser's default ring on click;
            // focus-visible keeps a keyboard indicator, reusing the hover fill
            // so it reads as part of the design rather than a stray outline.
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[14px] text-ink outline-none transition-colors hover:bg-ground focus-visible:bg-ground"
          >
            <HugeiconsIcon
              icon={item.icon}
              size={17}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              className="shrink-0 text-ink/70"
            />
            {item.label}
          </button>
        ))}
      </nav>

      <hr className="my-1 border-t border-line" />

      <div className="px-1.5 pb-0.5">
        <button
          type="button"
          role="menuitem"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[14px] text-danger outline-none transition-colors hover:bg-danger/8 focus-visible:bg-danger/8"
        >
          <HugeiconsIcon
            icon={Logout01Icon}
            size={17}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            className="shrink-0"
          />
          Выйти
        </button>
      </div>
    </m.div>
  )
}
