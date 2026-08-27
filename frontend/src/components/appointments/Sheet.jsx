import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { SCRIM_MOTION, SHEET_MOTION } from './panel'

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
   * Downwards only — pulling up would open nothing, the sheet is already at its
   * full height. Past 120px it closes; under it, it springs back, so a stray
   * drag on the way to a button costs nothing.
   */
  const grabbed = useRef(null)
  const [pulled, setPulled] = useState(0)

  const startDrag = (event) => {
    // **A press that lands on a button is not a drag.** The header carries
    // controls, and capturing the pointer for the whole row would move the
    // pointer stream to the row — the press would end somewhere the button
    // never sees and the tap would be swallowed.
    if (event.target.closest('button')) return
    grabbed.current = event.clientY
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onDrag = (event) => {
    if (grabbed.current === null) return
    setPulled(Math.max(0, event.clientY - grabbed.current))
  }

  const endDrag = (event) => {
    if (grabbed.current === null) return
    const distance = event.clientY - grabbed.current
    grabbed.current = null
    setPulled(0)
    if (distance > 120) onOpenChange?.(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger}

      <Dialog.Portal>
        <Dialog.Overlay
          className={`fixed inset-0 z-[60] bg-scrim ${SCRIM_MOTION}`}
        />
        <Dialog.Content
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
          style={{
            transform: pulled ? `translateY(${pulled}px)` : undefined,
            // On only while nothing is held: during a drag the sheet has to
            // track the finger exactly, and a transition there would make it
            // lag behind by its own duration.
            transition: grabbed.current
              ? 'none'
              : 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)',
          }}
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
