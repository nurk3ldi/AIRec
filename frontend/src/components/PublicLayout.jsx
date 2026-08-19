import { useLocation, useOutlet } from 'react-router-dom'
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from 'motion/react'
import LandingHeader from './LandingHeader'

/**
 * The public shell, and the one place in the app with a page transition.
 *
 * It earns its place here and nowhere else because `/login` and `/signup` are
 * deliberately visual twins — same column width, same input stack, same divider
 * and social buttons. Swapped instantly they read as one page whose text
 * glitched; crossed over, they read as two states of the same surface, which is
 * what they are. `/forgot-password` → `/reset-password` is the same story a step
 * further along, so the transition belongs to the shell rather than to a pair of
 * hardcoded routes.
 *
 * `useOutlet()` rather than `<Outlet/>`: the outlet element has to be captured
 * into a keyed child, or the leaving page would render the *arriving* route's
 * content while it fades out — the classic React Router + AnimatePresence bug.
 *
 * `mode="wait"` so the two never overlap. Overlapping would stack two centred
 * columns on top of each other for 150ms, and on the short forms here that
 * looks like a double image rather than a dissolve.
 */
export default function PublicLayout() {
  const outlet = useOutlet()
  const { pathname } = useLocation()
  const reduce = useReducedMotion()

  // A pure cross-fade — no travel, and that is a fix as much as a choice.
  //
  // It began as fade + a 6px rise, which put a scrollbar on screen for the
  // length of every transition. Transforms don't affect layout, but they *do*
  // contribute to an ancestor's scrollable overflow: the public pages are
  // `min-height: calc(100vh - 64px)` under a 64px header, so the document is
  // exactly one viewport tall and translating it down by six pixels is six
  // pixels more than fits.
  //
  // Sliding was the wrong idea anyway. Login and signup are the same surface
  // with different text in it; nothing moves between them, so nothing should
  // look like it moved. Out fast, in a little slower — roughly 260ms end to
  // end, under the 300ms ceiling for something you sit through on every click.
  const transition = reduce
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } },
        exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeIn' } },
      }

  return (
    <div className="min-h-screen bg-white text-[#171215]">
      <LandingHeader />
      {/* `LazyMotion` + `m`, not the full `motion` component: `motion.div`
          carries every feature Motion has — layout projection, drag, scroll,
          SVG morphing — because a component supporting all of them cannot be
          tree-shaken. `domAnimation` is the transform/opacity subset, which is
          all this uses, and it costs ~46 kB less. */}
      <LazyMotion features={domAnimation} strict>
        {/* `initial={false}` so a hard load of /login paints immediately
            instead of fading in — the transition is about moving between
            pages, not about arriving at the site. */}
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={pathname} {...transition}>
            {outlet}
          </m.div>
        </AnimatePresence>
      </LazyMotion>
    </div>
  )
}
