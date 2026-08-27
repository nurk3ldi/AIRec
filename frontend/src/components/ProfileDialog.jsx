import * as Dialog from '@radix-ui/react-dialog'
import { m, useReducedMotion } from 'motion/react'
import { useMediaQuery } from '../lib/media'
import {
  PANEL_TIMING,
  SCRIM_TIMING,
  SHEET_TIMING,
} from './appointments/panel'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import AccountSettings from './profile/AccountSettings'
import SessionsSettings from './profile/SessionsSettings'
import AppearanceSettings from './profile/AppearanceSettings'
import { PROFILE_SECTIONS, SECTION_PLACEHOLDERS } from './profile/sections'
import ComingSoon from './ComingSoon'
import { useT } from '../lib/i18n'

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
  const t = useT()
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
  // Not a `sm:` class, because what differs is the *animation* — a value handed
  // to Motion — and not only the styling.
  const isDesktop = useMediaQuery('(min-width: 640px)')

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
            to Motion.

            **Every number here comes from `appointments/panel.js`**, which is
            where the booking panel, the month, the service list and the status
            filter all get theirs. This one had its own — a 240ms open, an
            exit that inherited it, and an 8px rise — so pressing «+» on the
            calendar and opening a profile section were two different gestures
            in one product, which is the thing `panel.js` exists to prevent. The
            classes cannot be shared (this panel is closed by its parent
            unmounting it, so Radix never writes a `data-[state=closed]` for a
            CSS animation to hang on), but the values can, and now are.

            The backdrop and the panel stay timed apart, as they are there: the
            dim reads as the room going dark and the panel as the thing arriving
            in it. And the rise is gone — the file already said travel would be
            inventing a direction a centred dialog does not have, while doing
            exactly that eight pixels' worth. */}
        <Dialog.Overlay asChild>
          <m.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{
              opacity: 1,
              transition: reduce ? { duration: 0 } : SCRIM_TIMING.in,
            }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, transition: SCRIM_TIMING.out }}
            // No dim on a phone. The sheet covers the viewport there, so the
            // backdrop is never seen *behind* it — but Safari tints its status
            // bar from the colour at the top of the page, and 50% black over
            // white sampled as the grey strip above the sheet. Transparent
            // below `sm` and the strip takes the sheet's white instead.
            className="fixed inset-0 z-[60] grid place-items-center sm:bg-scrim sm:p-4"
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
            // Two shapes, and the animation is what tells them apart. On a
            // desktop the panel fades and scales in the middle of the screen.
            // On a phone it *is* the screen — full bleed, square corners, rising
            // from the bottom edge over the navigation, so the section reads as
            // somewhere you went rather than as a card laid on the page. That is
            // also why it covers the bottom bar instead of sitting above it: a
            // sideways tap out of a form you opened on purpose is not a way out
            // worth offering.
            initial={
              reduce
                ? false
                : isDesktop
                  ? { opacity: 0, scale: PANEL_TIMING.scale }
                  : { y: '100%' }
            }
            animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            // Out faster than in: leaving should get out of the way, arriving
            // should settle.
            exit={
              reduce
                ? { opacity: 0 }
                : isDesktop
                  ? {
                      opacity: 0,
                      scale: PANEL_TIMING.scale,
                      transition: PANEL_TIMING.out,
                    }
                  : { y: '100%', transition: SHEET_TIMING.out }
            }
            // The phone sheet travels the whole height of the screen where the
            // desktop panel only scales in place, so the two cannot share one
            // duration — the same timing makes the one that goes furthest look
            // thrown. Both sets live in `appointments/panel.js`.
            //
            // `cubic-bezier(0.32, 0.72, 0, 1)` — the curve iOS uses for its own
            // sheets, and worth borrowing for its shape rather than its
            // pedigree: it eases *in* as well as out, so the panel gathers
            // speed instead of leaving from a standstill already at full pace.
            //
            // Springs were tried at both ends and neither worked. A soft one
            // read as sluggish — over a whole screen height, the tail of a slow
            // settle is time spent waiting. A stiff one read as rigid, because
            // a spring starts at maximum acceleration and that is the part the
            // eye calls abrupt. Closing stays a quick tween; a sheet you
            // dismissed should be gone.
            transition={
              reduce
                ? { duration: 0 }
                : isDesktop
                  ? PANEL_TIMING.in
                  : SHEET_TIMING.in
            }
            // The safe-area insets live *here*, not on the dim behind it: padding
            // the overlay left the phone's status-bar strip showing the dark
            // backdrop instead of the sheet. Padding the sheet keeps its fill
            // running edge to edge and only holds the content clear.
            //
            // The border is desktop-only, and it is what gives the panel an edge
            // in dark mode: the page is pure black, the panel is pure black, the
            // shadow is black-on-black and the scrim cannot darken what is
            // already at zero — so a hairline is the only thing left that says
            // one is floating over the other. On a phone the sheet fills the
            // screen and has no outside to be edged against.
            className={`flex h-full w-full flex-col overflow-hidden border-line bg-surface pb-[env(safe-area-inset-bottom)] outline-none sm:max-h-[calc(100vh-2rem)] sm:border sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl sm:pb-0 sm:shadow-[0_24px_60px_-12px_rgba(23,18,21,0.35)] ${
              isAccount ? 'sm:h-auto sm:w-[520px]' : 'sm:h-[580px] sm:w-[728px]'
            }`}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-3 sm:pt-5">
              <Dialog.Title className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
                {t(active.dialogLabelKey ?? active.labelKey)}
              </Dialog.Title>

              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label={t('form.close')}
                  className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted outline-none transition-colors hover:bg-ink/6 hover:text-ink focus-visible:bg-ink/6 focus-visible:text-ink"
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
              ) : active.id === 'settings' ? (
                <AppearanceSettings />
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                  <ComingSoon>{t(SECTION_PLACEHOLDERS[active.id] ?? 'comingSoon')}</ComingSoon>
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
