import { useEffect, useRef, useState } from 'react'

/**
 * How long a wait has to last before a placeholder is worth drawing.
 *
 * **Past the page's own entrance, deliberately.** `PageTransition` fades a
 * screen in over 180ms, and bars that began fading in at 150 were a second
 * animation starting inside the first — two overlapping fades on the same
 * pixels, which is the one thing that reads as a stutter rather than as a
 * screen arriving. Anything a warm local backend answers inside this window now
 * lands with no placeholder at all, which is also Apple's own order: show the
 * content, and only where that is impossible show its shape.
 */
const DELAY_MS = 260

/**
 * The shortest time a placeholder may stay once it has been drawn.
 *
 * **This is the flash.** The delay decides whether bars appear; nothing decided
 * how long they lasted, so an answer landing at 300ms put them on screen for
 * forty milliseconds — a blink, and a blink reads as something going wrong
 * rather than as something loading. Held, the same answer reads as a screen
 * that was working and finished.
 *
 * 420ms rather than a round half second: long enough to be read as a state,
 * short enough that it is never the reason anybody is waiting.
 */
const HOLD_MS = 420

/**
 * Whether to draw a skeleton, and whether its bars are showing yet.
 *
 * Two answers because they are two different questions, and the screen needs
 * both. `pending` is *the placeholder's own lifetime* — the block is on screen,
 * and the real component must not be built yet. `bars` is whether the pulsing
 * lines inside it have faded in. The block is drawn from the first frame so the
 * layout is settled and nothing claims anything; only the bars wait.
 *
 * **`pending` outlives `loading`, which is the point.** It stays true until the
 * answer has arrived *and* any bars that were shown have had their `HOLD_MS`,
 * so nothing on screen can appear and vanish inside a blink.
 *
 * ```jsx
 * const { pending, bars } = useSkeleton(!loaded)
 * return pending ? <CardSkeleton visible={bars} /> : <NowCard … />
 * ```
 */
export function useSkeleton(loading, { delay = DELAY_MS, hold = HOLD_MS } = {}) {
  const [bars, setBars] = useState(false)
  // `pending` starts wherever `loading` does: a screen that mounts already
  // loading must draw the block on its first frame, not one render later.
  const [pending, setPending] = useState(loading)
  // When the bars came up, so the hold is measured from the moment somebody
  // could first see them rather than from when the request started.
  const shownAt = useRef(0)

  useEffect(() => {
    if (loading) {
      setPending(true)
      const timer = setTimeout(() => {
        shownAt.current = Date.now()
        setBars(true)
      }, delay)
      return () => clearTimeout(timer)
    }

    // The answer has arrived. With no bars ever shown there is nothing to hold
    // and the content takes the frame — the fast path, and the common one.
    if (shownAt.current === 0) {
      setPending(false)
      return
    }

    const left = hold - (Date.now() - shownAt.current)
    if (left <= 0) {
      shownAt.current = 0
      setBars(false)
      setPending(false)
      return
    }

    const timer = setTimeout(() => {
      shownAt.current = 0
      setBars(false)
      setPending(false)
    }, left)
    return () => clearTimeout(timer)
  }, [loading, delay, hold])

  return { pending, bars }
}
