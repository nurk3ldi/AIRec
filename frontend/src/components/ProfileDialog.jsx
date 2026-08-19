import * as Dialog from '@radix-ui/react-dialog'
import { m, useReducedMotion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import AccountSettings from './profile/AccountSettings'
import SessionsSettings from './profile/SessionsSettings'
import { PROFILE_SECTIONS, SECTION_PLACEHOLDERS } from './profile/sections'
import ComingSoon from './ComingSoon'

/**
 * Settings dialog opened from `ProfileMenu`, showing exactly the section the
 * menu picked — switching sections means going back to the menu, so there is
 * no navigation inside.
 *
 * Built on Radix's dialog primitive rather than a bare `<div role="dialog">`.
 * What that buys is the part that was missing when this was hand-rolled: focus
 * moves into the panel on open, Tab is trapped inside it, and focus returns to
 * the trigger on close. Escape, the scroll lock and the outside-click dismissal
 * come with it. The styling is entirely ours — Radix ships behaviour, not looks.
 *
 * Every section shares one fixed panel size, so the window never jumps as you
 * move between them. The account section is the exception: it's a single narrow
 * column of controls, and a wide panel would leave it stranded in the middle —
 * it gets its own narrower box that grows downward with its content instead.
 * The max-* pairs only kick in on viewports smaller than the panel itself.
 *
 * Sections own their own padding and scrolling: the account form pins its Save
 * button to a footer that must sit *outside* the scroll area, which it can't do
 * if the dialog scrolls on its behalf.
 *
 * Nothing here is a route — the whole profile area lives in this overlay, so
 * there are no `/profile/*` pages to keep in sync.
 */
export default function ProfileDialog({ section, user, onClose, onUserChange }) {
  const active = PROFILE_SECTIONS.find((s) => s.id === section) ?? PROFILE_SECTIONS[0]
  const isAccount = active.id === 'account'

  // The avatar cropper is a modal *inside* this one. It lives in the dialog's
  // own subtree, so the focus trap already covers it and a click on its backdrop
  // never counts as "outside" — but Escape is global, and without this guard one
  // press would close both.
  const nestedOverlayOpen = () =>
    typeof document !== 'undefined' &&
    document.querySelector('[data-nested-overlay]') !== null

  const reduce = useReducedMotion()

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        {/* `asChild` on both, so Radix keeps its behaviour — focus trap, scroll
            lock, dismissal — and hands the element it would have rendered over
            to Motion. The two are timed apart on purpose: the backdrop is a
            plain 200ms fade, and the panel takes slightly longer with a little
            scale, so the dim reads as the room going dark and the panel as the
            thing arriving in it. Both fade rather than slide: the dialog is
            centred and comes from nowhere in particular, so travel would be
            inventing a direction that does not exist. */}
        <Dialog.Overlay asChild>
          <m.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[60] grid place-items-center bg-[#171215]/50 p-4"
          >
          <Dialog.Content
            asChild
            // No description element, and none is wanted — telling Radix so
            // keeps it from warning about a missing one.
            aria-describedby={undefined}
            onEscapeKeyDown={(event) => {
              if (nestedOverlayOpen()) event.preventDefault()
            }}
          >
          <m.div
            initial={reduce ? false : { opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            // Out faster than in, and without the rise: leaving should get out
            // of the way, arriving should settle.
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
            className={`flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(23,18,21,0.35)] outline-none ${
              isAccount ? 'w-[520px]' : 'h-[580px] w-[728px]'
            }`}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3">
              <Dialog.Title className="font-display text-[19px] font-semibold tracking-[-0.02em] text-[#171215]">
                {active.dialogLabel ?? active.label}
              </Dialog.Title>

              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Закрыть"
                  className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#999999] outline-none transition-colors hover:bg-[#171215]/6 hover:text-[#171215] focus-visible:bg-[#171215]/6 focus-visible:text-[#171215]"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              {isAccount ? (
                <AccountSettings onUserChange={onUserChange} onClose={onClose} />
              ) : active.id === 'security' ? (
                <SessionsSettings user={user} />
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                  <ComingSoon>{SECTION_PLACEHOLDERS[active.id]}</ComingSoon>
                </div>
              )}
            </div>
          </m.div>
          </Dialog.Content>
          </m.div>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
