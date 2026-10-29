import { Link, useLocation } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { domMax, LazyMotion, m, useReducedMotion } from 'motion/react'
import { mediaUrl } from '../lib/api'
import BrandMark from './BrandMark'
import ProfileAvatar from './ProfileAvatar'
import { NAVIGATION } from './navigation'
import { useT } from '../lib/i18n'

/**
 * The desktop rail. Hidden below `sm`, where `BottomNav` takes over — the same
 * destinations, moved to the edge a thumb can reach.
 *
 * It owns no state any more: the profile menu and dialog are opened from here
 * *and* from the bottom bar, so both flags live in `DashboardLayout` and the
 * overlays are rendered there. This component is the rail and nothing else.
 */
export default function Sidebar({ user = null, isMenuOpen, onToggleMenu }) {
  const t = useT()
  const { pathname } = useLocation()
  const reduce = useReducedMotion()

  return (
    // `domMax`, not `domAnimation`: the sliding active marker below is a shared
    // layout animation, and layout projection is the one feature the smaller
    // bundle leaves out.
    <LazyMotion features={domMax} strict>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-16 flex-col overflow-visible border-r border-line-strong bg-rail text-rail-ink shadow-[6px_0_20px_rgba(23,18,21,0.08)] sm:flex">
        <div className="flex h-[68px] shrink-0 items-center justify-center border-b border-line-strong">
          <Link to="/dashboard" aria-label={t('nav.home')}>
            <BrandMark />
          </Link>
        </div>

        <nav
          className="flex flex-1 flex-col items-center gap-3.5 py-6"
          aria-label={t('nav.main')}
        >
          {NAVIGATION.map((item) => {
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                to={item.href}
                aria-label={t(item.labelKey)}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative grid h-9 w-9 place-items-center rounded-[10px] transition-colors duration-200 ${
                  isActive ? 'text-rail' : 'text-rail-ink hover:bg-rail-ink/10'
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
                    // `rail-ink`, not `accent`: the rail is dark in both themes, and the
                    // accent is black on a light ground — a black marker on a
                    // near-black rail would disappear. The glow went with the blue.
                    className="absolute inset-0 rounded-[10px] bg-rail-ink"
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
                {/* **The tooltips appear instantly, with no transition and no
                    4px slide.** These four are the app's own navigation — they
                    are pointed at tens of times a day, and an animation on
                    something seen that often is a small wait paid over and
                    over. It was `transition-all` besides, which put a slide and
                    a fade on the one label whose whole job is to be read the
                    moment the cursor arrives. Instant is what a tooltip is
                    supposed to be. */}
                <span className="relative z-10 grid place-items-center">
                  <HugeiconsIcon
                    icon={item.icon}
                    size={18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.15}
                  />
                </span>
                <span className="pointer-events-none absolute left-[46px] z-50 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 font-sans text-[11px] font-medium text-surface opacity-0 shadow-xl group-hover:opacity-100">
                  {t(item.labelKey)}
                </span>
              </Link>
            )
          })}
        </nav>

        <button
          type="button"
          data-profile-menu-toggle
          onClick={onToggleMenu}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label={t('nav.profile')}
          // No blue active state here, unlike the nav items above: the avatar is
          // already a picture, and a coloured frame around it reads as a stray
          // border rather than "this is selected".
          className="group relative mx-auto mb-[18px] grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-rail-ink outline-none transition-colors duration-200 hover:bg-rail-ink/10 focus-visible:bg-rail-ink/10"
        >
          <ProfileAvatar src={mediaUrl(user?.avatar_url)} />
          {/* Hidden while the menu is open — the panel already names everything
              it points at, so the tooltip would just overlap it. */}
          {!isMenuOpen && (
            <span className="pointer-events-none absolute left-[46px] z-50 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 font-sans text-[11px] font-medium text-surface opacity-0 shadow-xl group-hover:opacity-100">
              {t('nav.profile')}
            </span>
          )}
        </button>
      </aside>
    </LazyMotion>
  )
}
