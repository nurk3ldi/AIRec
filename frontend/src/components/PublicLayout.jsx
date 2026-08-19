import { useLocation } from 'react-router-dom'
import LandingHeader from './LandingHeader'
import PageTransition from './PageTransition'

/**
 * Routes that drop the header on a phone.
 *
 * On a small screen these three are single, self-contained screens — a splash,
 * and two forms — and each already offers whatever the header would: the
 * landing page has both calls to action in its body, and the auth pages
 * cross-link to each other at the bottom. A 64px bar repeating those links is a
 * tenth of the viewport spent saying something the screen already says.
 *
 * `/forgot-password` and `/reset-password` keep it, and deliberately: they are
 * mid-flow, and the header is the way back out.
 */
const BARE_ON_MOBILE = new Set(['/', '/login', '/signup'])

/**
 * The marketing shell: header, then the page.
 *
 * The transition matters most here — `/login` and `/signup` are deliberately
 * visual twins, and swapped instantly they read as one page whose text
 * glitched. Crossed over, they read as two states of the same surface, which is
 * what they are.
 */
export default function PublicLayout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-white text-[#171215]">
      {/* Hidden, not unmounted: `display` is what the page modules measure
          against, and they add the 64px back at the same breakpoint. */}
      <LandingHeader
        className={BARE_ON_MOBILE.has(pathname) ? 'hidden sm:flex' : 'flex'}
      />
      <PageTransition />
    </div>
  )
}
