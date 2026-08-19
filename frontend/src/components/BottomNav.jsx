import { Link, useLocation } from 'react-router-dom'
import { domMax, LazyMotion, m, useReducedMotion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { mediaUrl } from '../lib/api'
import { NAVIGATION } from './navigation'
import ProfileAvatar from './ProfileAvatar'

/**
 * The phone's navigation: five icons across the bottom edge, replacing the
 * desktop rail below `sm`.
 *
 * Bottom rather than a drawer behind a hamburger, because these four screens
 * are the app — a menu you have to open first turns every move between them
 * into two taps and hides the fact that the others exist. Bottom rather than
 * top, because that is the half of a phone a thumb reaches.
 *
 * Full width with a hairline above it, not the floating pill from
 * `design/bottom_nav_example2.jpeg` — that was built and taken back out. The
 * bar carries the page's own ground rather than white, so the hairline is the
 * only thing marking it off, which is all it needs.
 *
 * **No labels.** Words under five icons leave about 70pt each, which is where
 * Russian starts truncating, and with five destinations the glyphs carry it.
 * Every slot keeps an `aria-label`, so nothing is lost to a screen reader.
 *
 * The current slot wears a **grey surround that slides** between items, not a
 * colour: the accent is the app's way of saying *look here*, and a bar that is
 * permanently pointing at one of five things spends it on something you already
 * know. Grey says the same thing without claiming attention.
 *
 * The fifth slot is the profile, and here it *is* a link — to `/profile`, a
 * screen that exists for phones. The desktop rail opens a popup instead; a
 * 264px panel floating over a 390pt viewport is a desktop shape, and a route
 * means the back gesture works. It sits last for the same reason it sits at the
 * bottom of the rail — it is about you, not about the business.
 */
// One box per slot, whether or not it is current: the marker fills it, so the
// row's geometry never depends on which item is selected.
const SLOT = 'relative grid h-9 w-12 place-items-center'

/** The grey surround, shared across every slot. */
function Marker({ reduce }) {
  return (
    <m.span
      // The same `layoutId` on every active state is what lets Motion see it as
      // one element moving rather than two fading in and out, so it slides from
      // the slot you left to the one you picked — the rail's marker, on its
      // side. That travel is the animation; it draws the line between where you
      // were and where you are.
      layoutId="bottom-nav-active"
      className="absolute inset-0 rounded-full bg-[#171215]/8"
      // A spring rather than a duration: the gap between slots is the same
      // every time here, but the rail uses one for the same marker and two
      // navigations should not move at two different speeds.
      transition={
        reduce
          ? { duration: 0 }
          : { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }
      }
    />
  )
}

export default function BottomNav({ user }) {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  const isProfile = pathname === '/profile'

  return (
    // `domMax`, not `domAnimation`: the sliding marker is a shared layout
    // animation, and layout projection is the one feature the smaller bundle
    // leaves out. The rail already loads it, so it costs nothing here.
    <LazyMotion features={domMax} strict>
    <nav
      aria-label="Основная навигация"
      // 50px rather than the 56 it started at: the bar is anchored to the
      // bottom, so taking height off it moves both the hairline and the row of
      // glyphs down the screen together.
      //
      // `pb-[env(safe-area-inset-bottom)]` keeps the row clear of the home
      // indicator on an iPhone; everywhere else the inset is zero.
      className="fixed inset-x-0 bottom-0 z-50 flex h-[50px] border-t border-[#999999]/20 bg-[#F6F8FA] pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {NAVIGATION.map((item) => {
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            to={item.href}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            // Each slot takes an equal fifth and the full height of the bar, so
            // the tap target is the whole cell rather than the glyph in it.
            className={`flex flex-1 items-center justify-center transition-colors ${
              isActive ? 'text-[#171215]' : 'text-[#999999]'
            }`}
          >
            <span className={SLOT}>
              {isActive && <Marker reduce={reduce} />}
              {/* Above the marker: an absolutely positioned sibling paints over
                  static content whatever the DOM order. */}
              <span className="relative z-10 grid place-items-center">
                <HugeiconsIcon
                  icon={item.icon}
                  size={23}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // Weight as well as the surround, so it still reads to
                  // someone who cannot separate the two greys.
                  strokeWidth={isActive ? 2.4 : 1.9}
                />
              </span>
            </span>
          </Link>
        )
      })}

      {/* A link, not the popup the rail opens. On a phone the account is a
          screen of its own: a 264px panel floating over a 390pt viewport is a
          desktop shape, and a real route means the back gesture works. */}
      <Link
        to="/profile"
        aria-label="Профиль"
        aria-current={isProfile ? 'page' : undefined}
        className="flex flex-1 items-center justify-center"
      >
        <span className={SLOT}>
          {isProfile && <Marker reduce={reduce} />}
          <span
            className={`relative z-10 grid h-[23px] w-[23px] place-items-center overflow-hidden rounded-full ${
              isProfile ? '' : 'opacity-70'
            }`}
          >
            <ProfileAvatar src={mediaUrl(user?.avatar_url)} size={23} />
          </span>
        </span>
      </Link>
    </nav>
    </LazyMotion>
  )
}
