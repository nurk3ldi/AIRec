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

/**
 * The authenticated shell, in two shapes: a fixed rail on the left above `sm`,
 * a bar along the bottom below it.
 *
 * The profile overlays live here rather than inside either navigation, because
 * both of them open the same menu and there must be exactly one of it. That is
 * also why the flags are here — a second copy of `isMenuOpen` in the bar would
 * be a second menu that the rail's outside-click handler could not close.
 */
export default function DashboardLayout() {
  const verifiedUser = useRequireAuth()
  const { pathname } = useLocation()
  // Mirrored into state so edits made in the profile dialog (name, avatar)
  // show up in the sidebar without another `/auth/me` round trip.
  const [user, setUser] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // null = dialog closed; otherwise the section id it's showing.
  const [dialogSection, setDialogSection] = useState(null)

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

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#F6F8FA] text-[#171215]">
      <Sidebar
        user={user}
        isMenuOpen={isMenuOpen}
        onToggleMenu={() => setIsMenuOpen((open) => !open)}
      />

      {/* No left inset on a phone — the rail is not there — and room at the
          bottom for the bar, which is fixed and so occupies no layout height of
          its own — 50px plus the home indicator. The page modules subtract the
          same, or the two together overrun the viewport. */}
      <main className="min-h-screen bg-[#F6F8FA] pb-[calc(50px+env(safe-area-inset-bottom))] sm:pb-0 sm:pl-16">
        <Header />
        {/* The shells sit outside this and update instantly — a click should be
            acknowledged now; only the content it swaps needs to cross over. */}
        <PageTransition />
      </main>

      <BottomNav
        user={user}
        isMenuOpen={isMenuOpen}
        onToggleMenu={() => setIsMenuOpen((open) => !open)}
      />

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
