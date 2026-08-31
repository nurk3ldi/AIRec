import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, domAnimation, LazyMotion } from 'motion/react'
import { useRequireAuth } from '../lib/auth'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import Header from './Header'
import PageTransition from './PageTransition'
import ProfileMenu from './ProfileMenu'
import ProfileDialog from './ProfileDialog'
import Skeleton, { SkeletonRegion } from './Skeleton'
import { useSkeleton } from '../lib/skeleton'

/**
 * The authenticated shell, in two shapes: a fixed rail on the left above `sm`,
 * a bar along the bottom below it.
 *
 * The profile overlays live here rather than inside either navigation, because
 * both of them open the same menu and there must be exactly one of it. That is
 * also why the flags are here — a second copy of `isMenuOpen` in the bar would
 * be a second menu that the rail's outside-click handler could not close.
 */
/**
 * The screens that draw no header below `sm`.
 *
 * A set rather than a chain of comparisons: it is read once per render and the
 * next screen to join is a line, not an edit to a condition.
 */
const HEADERLESS = new Set(['/profile', '/appointments', '/assistant'])

/**
 * The shell with nothing in it yet.
 *
 * **The chrome and not the content.** Nothing here comes from the session — no
 * name, no avatar, no page — so it can be drawn before the answer arrives
 * without showing anybody anything they have not been cleared for, which is the
 * whole reason the shell used to render `null`.
 *
 * It copies the three fixed measurements exactly, so nothing moves when the
 * real shell replaces it: the 64px rail from `sm`, the 68px header, and the
 * 50px bar plus the home indicator below `sm`.
 */
function ShellSkeleton({ visible }) {
  return (
    <SkeletonRegion
      label="AIRec"
      visible={visible}
      className="min-h-screen bg-ground"
    >
      <div className="fixed inset-y-0 left-0 hidden w-16 flex-col items-center gap-4 bg-rail py-4 sm:flex">
        <Skeleton className="h-9 w-9 rounded-xl bg-rail-ink/10" />
        <div className="mt-2 flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-9 w-9 rounded-xl bg-rail-ink/10"
            />
          ))}
        </div>
        <Skeleton className="mt-auto h-9 w-9 rounded-full bg-rail-ink/10" />
      </div>

      <div className="min-h-screen sm:pl-16">
        <div className="flex h-[68px] items-center justify-between border-b border-line px-4 sm:px-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 flex h-[calc(50px+env(safe-area-inset-bottom))] items-start justify-around border-t border-line px-6 pt-3 sm:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-6 rounded-lg" />
        ))}
      </div>
    </SkeletonRegion>
  )
}

export default function DashboardLayout() {
  const verifiedUser = useRequireAuth()
  const { pathname } = useLocation()
  // Mirrored into state so edits made in the profile dialog (name, avatar)
  // show up in the sidebar without another `/auth/me` round trip.
  const [user, setUser] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // null = dialog closed; otherwise the section id it's showing.
  const [dialogSection, setDialogSection] = useState(null)
  // **The whole app is blank until the session is confirmed** — `/auth/me`,
  // and a `/auth/refresh` behind it when the access token has expired, which is
  // two round trips on the slowest path there is. It rendered `null` for all of
  // it. `null` is right about the *content* — protected content must never
  // flash before it is allowed — and wrong about the room around it: a page
  // that is white for a second and then complete is a page you assume failed.
  const showShell = useSkeleton(!user)

  useEffect(() => {
    if (verifiedUser) setUser(verifiedUser)
  }, [verifiedUser])

  // Navigating elsewhere should leave the menu closed behind you.
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  const openSection = (id) => {
    setIsMenuOpen(false)
    setDialogSection(id)
  }

  if (!user) return <ShellSkeleton visible={showShell} />

  return (
    <div className="min-h-screen bg-ground text-ink">
      <Sidebar
        user={user}
        isMenuOpen={isMenuOpen}
        onToggleMenu={() => setIsMenuOpen((open) => !open)}
      />

      {/* No left inset on a phone — the rail is not there — and room at the
          bottom for the bar, which is fixed and so occupies no layout height of
          its own — 50px plus the home indicator. The page modules subtract the
          same, or the two together overrun the viewport. */}
      <main className="min-h-screen bg-ground pb-[calc(50px+env(safe-area-inset-bottom))] sm:pb-0 sm:pl-16">
        {/* Hidden on `/profile` below `sm`: that screen is about you, and the
            phone header carries the app's name and a bell, neither of which
            belongs above it. Hidden rather than unmounted — the page module
            measures against the same breakpoint.

            **`/appointments` joins it below `sm`, for a different reason.**
            That screen is a grid that must fit the viewport exactly — it is the
            one page in the app with a *definite* height rather than a minimum —
            so 68px spent on a bar carrying a wordmark and two icons is 68px the
            hours do not get. The bottom bar still says which screen this is and
            still leads to the other four, which is what the header was doing
            there. Above `sm` it comes back: a desktop has the room, and the
            page title and search belong on it.

            **`/assistant` is the third, and the reason is what the bar says
            rather than what it costs.** Below `sm` the header carries the
            wordmark and a bell — it does not carry the page title, which only
            appears from `sm`. So on a phone it is 68px pinned to the top of a
            long scrolling form, naming neither the app's screen nor anything
            you came for, while the bottom bar already says where you are. That
            screen carries its own large title instead, in the flow, which
            scrolls away once you are past it. */}
        <Header
          className={
            HEADERLESS.has(pathname) ? 'hidden sm:flex' : 'flex'
          }
        />
        {/* The shells sit outside this and update instantly — a click should be
            acknowledged now; only the content it swaps needs to cross over. */}
        <PageTransition
          context={{ user, onUserChange: setUser, onOpenSection: openSection }}
        />
      </main>

      {/* No menu props: on a phone the profile slot is a link to `/profile`,
          a real screen, so the popup below is the rail's alone. */}
      <BottomNav user={user} />

      {/* Each overlay gets its own `AnimatePresence` — separate boundaries, so
          closing the menu to open the dialog does not make Motion treat one as
          replacing the other. They live outside both components because each
          unmounts when its flag clears, and a component cannot animate its own
          exit after React has removed it. */}
      <LazyMotion features={domAnimation} strict>
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
              onUserChange={setUser}
            />
          )}
        </AnimatePresence>
      </LazyMotion>
    </div>
  )
}
