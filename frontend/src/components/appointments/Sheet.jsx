import { useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { SCRIM_MOTION, SHEET_MOTION } from './panel'
import {
  project,
  rubberband,
  velocityFrom,
  VELOCITY_WINDOW,
} from '../../lib/motion'
import { haptic } from '../../lib/haptics'

/**
 * The phone's panel: full width, rising from the bottom edge, pulled down to
 * dismiss.
 *
 * **One implementation because there are two of them.** The booking form opens
 * this way and so does the booking's detail, and a sheet built twice is two
 * sheets that agree until one of them is adjusted — the geometry, the curve,
 * the drag threshold and the safe-area insets are all the kind of number that
 * gets tuned on one screen and forgotten on the other.
 *
 * **The header is a slot rather than a prop of parts**, because the two put
 * different things in it — a close, a title and a save on one; a close, a title
 * and an edit on the other — and it is also the drag handle, so it has to be
 * something this component can attach to rather than something it composes.
 */

/** Past this much of a *projected* throw, the sheet is more gone than not. */
const DISMISS_PX = 120

/**
 * How long the exit takes, so it leaves at roughly the speed the finger let go
 * at and there is no seam between the drag and the animation.
 *
 * **An approximation of velocity handoff, not the real thing.** A true handoff
 * feeds the release velocity into a spring as its initial velocity; this
 * component animates on a CSS keyframe by deliberate choice (see the note on
 * the drag below), and a keyframe has one dial. Matching the duration to
 * `remaining / velocity` makes the first frame leave at about the right speed,
 * which is the part the eye actually catches.
 *
 * Clamped at both ends: under 140ms the exit is a cut rather than a movement,
 * over 320ms a hard flick feels caught on its way out.
 */
const EXIT_MS = { min: 140, max: 320 }

function exitDuration(remaining, velocity) {
  if (velocity <= 0) return EXIT_MS.max
  const ideal = (remaining / velocity) * 1000
  return Math.round(Math.min(Math.max(ideal, EXIT_MS.min), EXIT_MS.max))
}

export default function Sheet({
  open,
  onOpenChange,
  label,
  header,
  children,
  trigger,
}) {
  /**
   * Pulling the sheet down to dismiss it.
   *
   * **Pointer events and an inline transform, not a drag library.** What this
   * has to do is follow a finger and decide once at the end; Motion would bring
   * `AnimatePresence` and `forceMount` with it, which is a different animation
   * scheme from the one every panel here already rides.
   *
   * **The grip is the header, not the whole sheet.** What is under it scrolls,
   * and a sheet that also drags from its body is a sheet that closes when
   * somebody meant to scroll. That is what a fixed row above a scrolling body
   * is *for*, and it is how a phone sheet with scrollable content behaves
   * everywhere else.
   *
   * **The decision is made on where the throw was heading, not on where the
   * finger stopped.** A distance threshold on its own gets both of the common
   * gestures wrong: a quick 50px flick — the clearest way anyone says "take
   * this away" — springs back because it is short, while a slow, deliberate
   * 130px drag by somebody reading what is underneath loses the sheet. The
   * release velocity is projected forward (`project`, Apple's own deceleration
   * curve) and the threshold is asked of *that*.
   *
   * **Nothing here is React state.** Everything the drag writes is a transform
   * on one node, and putting it through `useState` would re-render the whole
   * sheet — the booking form is seven fields and a price list — on every
   * `pointermove`, which is once a frame.
   */
  const grabbed = useRef(null)
  const trail = useRef([])
  const content = useRef(null)
  /**
   * Whether the finger is currently past the point of no return.
   *
   * Held so the buzz fires on the *crossing* rather than on every frame beyond
   * it — a haptic repeating sixty times a second is not feedback, it is a
   * broken phone. Only on the way in, too: the useful thing to be told is "let
   * go now and this closes", and a second tick on the way back out would make
   * hovering at the boundary a rattle.
   */
  const past = useRef(false)

  /** Writes the drag straight to the node, with or without the settle curve. */
  const slide = (y, animated) => {
    const node = content.current
    if (!node) return
    // On only while nothing is held: during a drag the sheet has to track the
    // finger exactly, and a transition there would make it lag behind by its
    // own duration.
    node.style.transition = animated
      ? 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)'
      : 'none'
    node.style.transform = y ? `translate3d(0, ${y}px, 0)` : ''
  }

  /**
   * How far the sheet has actually moved for a given finger travel.
   *
   * Downwards it is one-to-one — touch and content move together, and anything
   * else is the sheet arguing with the hand. Upwards there is nowhere to go,
   * and the answer is resistance rather than a wall: `Math.max(0, …)` stopped
   * the sheet dead at the top, which reads as the gesture having been dropped.
   * A rubber band says "still listening, but there is nothing more this way".
   */
  const followed = (raw) => {
    if (raw >= 0) return raw
    return -rubberband(-raw, grabbed.current?.height ?? 0)
  }

  const startDrag = (event) => {
    // **A press that lands on a button is not a drag.** The header carries
    // controls, and capturing the pointer for the whole row would move the
    // pointer stream to the row — the press would end somewhere the button
    // never sees and the tap would be swallowed.
    if (event.target.closest('button')) return
    // The height is read once, here, and not per frame: it is what the rubber
    // band and the exit duration are relative to, and a `getBoundingClientRect`
    // inside `pointermove` is a forced reflow on every frame of the drag. The
    // sheet cannot change height while it is being held.
    grabbed.current = {
      y: event.clientY,
      height: content.current?.getBoundingClientRect().height ?? 0,
    }
    past.current = false
    trail.current = [{ at: performance.now(), value: 0 }]
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onDrag = (event) => {
    if (grabbed.current === null) return
    const raw = event.clientY - grabbed.current.y
    const at = performance.now()

    // The trail is of the *finger*, not of the rubber-banded position: velocity
    // is a fact about the hand, and measuring it off the damped value would
    // report a throw as slower than it was exactly when it is past the edge.
    trail.current.push({ at, value: raw })
    // The one tick this gesture gets, on the frame the threshold is crossed —
    // the same frame the eye would see it snap on, which is what keeps the two
    // reading as one event rather than two.
    if (raw > DISMISS_PX && !past.current) {
      past.current = true
      haptic('snap')
    }
    while (
      trail.current.length > 2 &&
      at - trail.current[1].at > VELOCITY_WINDOW
    ) {
      trail.current.shift()
    }

    slide(followed(raw), false)
  }

  const endDrag = (event) => {
    if (grabbed.current === null) return
    const raw = event.clientY - grabbed.current.y
    const height = grabbed.current.height
    // Where the sheet actually *is* — read before `grabbed` is cleared, since
    // that is where the rubber band's dimension lives.
    const shown = followed(raw)
    const velocity = velocityFrom(trail.current)
    grabbed.current = null
    trail.current = []

    if (raw + project(velocity) <= DISMISS_PX) {
      slide(0, true)
      return
    }

    const node = content.current
    if (node) {
      // **Hand the exit its starting point.** `sheet-out` reads this custom
      // property, so the animation continues from where the finger let go
      // instead of snapping to the top and only then sliding away — the jump
      // that a `setPulled(0)` before the close used to put there, and the one
      // thing *Designing Fluid Interfaces* is most insistent about: animate
      // from the presentation value, never from the target value.
      node.style.setProperty('--sheet-pulled', `${shown}px`)
      node.style.animationDuration = `${exitDuration(height - shown, velocity)}ms`
    }
    onOpenChange?.(false)
  }

  /**
   * Cleared on the way *in*, not on the way out.
   *
   * Radix keeps the node mounted for the length of the exit animation, so
   * anything that resets the offset during a close is racing the animation that
   * reads it. Opening is the one moment where zero is unambiguously right.
   */
  useEffect(() => {
    if (!open) return
    const node = content.current
    if (!node) return
    node.style.transition = ''
    node.style.transform = ''
    node.style.animationDuration = ''
    node.style.removeProperty('--sheet-pulled')
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger}

      <Dialog.Portal>
        <Dialog.Overlay
          className={`fixed inset-0 z-[60] bg-scrim ${SCRIM_MOTION}`}
        />
        <Dialog.Content
          ref={content}
          // No description element and none wanted; telling Radix so keeps it
          // from warning about a missing one.
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            // The date, service and select popovers open into portals of their
            // own, so Escape has to be told which layer it is for — without
            // this a press meant for an open month closes the sheet with it.
            if (document.querySelector('[data-nested-overlay]')) {
              event.preventDefault()
            }
          }}
          // **Up to the indicators, with the top two corners rounded.** It was
          // 90% of the viewport, which is a proportion rather than a place: on
          // a tall phone that left a band of page showing with nothing in it,
          // and on a short one it ate the content. `top` and `bottom` instead,
          // so the sheet is defined by where it *stops* — twelve pixels clear
          // of the status bar, enough for the radius to be seen and to leave
          // somewhere to tap out, and no more.
          //
          // `env(safe-area-inset-top)` is added rather than assumed: 0 in a
          // browser tab, where the status bar is the browser's own chrome and
          // outside the viewport already, and the notch's height once this is
          // installed to a home screen.
          //
          // The bottom inset lives on the sheet rather than on the dim behind
          // it: padding the overlay would leave the strip showing the backdrop
          // instead of the sheet's own fill.
          className={`fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] bottom-0 z-[60] flex flex-col overflow-hidden rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] outline-none ${SHEET_MOTION}`}
        >
          {/* Radix names a dialog from its `Title`. The visible heading inside
              `header` cannot be one — the booking form renders that same
              element inside a popover on a desktop, where `Dialog.Title` would
              throw — so the name is given here and hidden. */}
          <Dialog.Title className="sr-only">{label}</Dialog.Title>

          <div
            onPointerDown={startDrag}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            // `touch-none` so a downward drag on the header belongs to the
            // sheet rather than to the page; the buttons inside still take
            // their taps, which are not drags.
            className="shrink-0 touch-none"
          >
            {header}
          </div>

          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
