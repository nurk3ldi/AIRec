import LandingHeader from './LandingHeader'
import PageTransition from './PageTransition'

/**
 * The marketing shell: header, then the page.
 *
 * The transition matters most here — `/login` and `/signup` are deliberately
 * visual twins, and swapped instantly they read as one page whose text
 * glitched. Crossed over, they read as two states of the same surface, which is
 * what they are.
 */
export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-white text-[#171215]">
      <LandingHeader />
      <PageTransition />
    </div>
  )
}
