import { Link, useLocation } from 'react-router-dom'
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
 * The fifth slot is the profile, and here it *is* a link — to `/profile`, a
 * screen that exists for phones. The desktop rail opens a popup instead; a
 * 264px panel floating over a 390pt viewport is a desktop shape, and a route
 * means the back gesture works. It sits last for the same reason it sits at the
 * bottom of the rail — it is about you, not about the business.
 */
export default function BottomNav({ user }) {
  const { pathname } = useLocation()
  const isProfile = pathname === '/profile'

  return (
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
              isActive ? 'text-[#3248F2]' : 'text-[#999999]'
            }`}
          >
            <HugeiconsIcon
              icon={item.icon}
              size={23}
              strokeLinecap="round"
              strokeLinejoin="round"
              // The references mark the current tab by swapping an outline
              // glyph for a filled one; the free icon set ships strokes only,
              // so the accent and a heavier line carry it instead. Weight as
              // well as colour, so it still reads without colour vision.
              strokeWidth={isActive ? 2.4 : 1.9}
            />
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
        {/* Ringed when current — the avatar is a photograph, and the
            stroke-weight trick the glyphs use has nothing to act on here. */}
        <span
          className={`grid h-[23px] w-[23px] place-items-center overflow-hidden rounded-full transition-shadow ${
            isProfile
              ? 'ring-2 ring-[#3248F2] ring-offset-2 ring-offset-[#F6F8FA]'
              : 'opacity-70'
          }`}
        >
          <ProfileAvatar src={mediaUrl(user?.avatar_url)} size={23} />
        </span>
      </Link>
    </nav>
  )
}
