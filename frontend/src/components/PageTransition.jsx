import { useLocation, useOutlet } from 'react-router-dom'
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from 'motion/react'

/**
 * Renders the matched route and crosses over when it changes. Both shells use
 * it in place of `<Outlet/>`, so every page in the app changes the same way.
 *
 * **`useOutlet()` rather than `<Outlet/>`.** The outlet element has to be
 * captured into a keyed child, or the page on its way out would render the
 * *arriving* route's content while it fades — the classic React Router plus
 * AnimatePresence bug, and it looks like a flicker rather than a transition.
 *
 * **`mode="wait"`**, so the two never overlap. Both shells centre their content
 * in a column, and two of those stacked for a moment reads as a double image
 * rather than a dissolve.
 *
 * **Opacity only — no slide, and that is a fix as much as a taste.** Every page
 * here is exactly one viewport tall (`min-height: calc(100vh - Npx)` under an
 * N-pixel header). A transform does not affect layout, but it *does* contribute
 * to an ancestor's scrollable overflow, so shifting the page down even six
 * pixels puts a scrollbar on screen for the length of every transition. It is
 * also the better effect: the routes replace each other in place, so nothing
 * actually travels and nothing should look like it did.
 *
 * The shells themselves — sidebar, header, the active nav item — sit outside
 * this and update instantly. A click should be acknowledged now; only the
 * content it swaps needs to cross over.
 */
export default function PageTransition() {
  const outlet = useOutlet()
  const { pathname } = useLocation()
  const reduce = useReducedMotion()

  // Out fast, in a little slower: leaving should get out of the way, arriving
  // should settle. ~280ms end to end, under the 300ms ceiling for something
  // you sit through on every click.
  const transition = reduce
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } },
        exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeIn' } },
      }

  return (
    // `LazyMotion` + `m`, not the full `motion` component: `motion.div` carries
    // every feature Motion has — layout projection, drag, scroll, SVG morphing
    // — because a component supporting all of them cannot be tree-shaken.
    // `domAnimation` is the transform/opacity subset, all this needs.
    <LazyMotion features={domAnimation} strict>
      {/* `initial={false}` so a hard load paints at once rather than fading in
          — this is about moving between pages, not about arriving at the app. */}
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={pathname} {...transition}>
          {outlet}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  )
}
