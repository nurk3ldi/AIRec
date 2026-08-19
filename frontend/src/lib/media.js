import { useEffect, useState } from 'react'

/**
 * Whether a CSS media query currently matches, as state.
 *
 * Tailwind covers nearly everything responsive without JavaScript ever knowing
 * the viewport width, and that is the right default. This exists for the cases
 * where the *behaviour* differs rather than the styling — a dialog that slides
 * up from the bottom edge on a phone and fades in the middle of the screen on a
 * desktop is two different animations, and an animation is a value passed to
 * Motion, not a class you can put a breakpoint on.
 *
 * Reach for a `sm:` class first. Come here only when a prop has to change.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => globalThis.matchMedia?.(query).matches ?? false
  )

  useEffect(() => {
    const list = globalThis.matchMedia(query)
    const onChange = (event) => setMatches(event.matches)
    // Read once on mount too: the query may already have changed between the
    // initial state above and this effect running.
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}
