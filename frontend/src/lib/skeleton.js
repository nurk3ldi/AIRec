import { useEffect, useState } from 'react'

/**
 * Whether to draw the skeleton at all.
 *
 * **A skeleton that appears and vanishes inside a tenth of a second is worse
 * than no skeleton**: it is a flash, and a flash reads as something going
 * wrong. So it is held back for `delay` milliseconds — long enough that a
 * warm local backend answering in 30ms never draws one, short enough that
 * anything a person would call a wait does.
 *
 * The timer runs only while `loading` is true and is cleared the moment it goes
 * false, so a fast answer leaves no timer behind to fire into a settled screen.
 */
export function useSkeleton(loading, delay = 150) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!loading) {
      setShow(false)
      return
    }

    const timer = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(timer)
  }, [loading, delay])

  return show
}
