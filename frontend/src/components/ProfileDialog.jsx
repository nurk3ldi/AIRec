import { useEffect } from 'react'
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

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      // A nested overlay (the avatar cropper) owns Escape while it's open.
      if (document.querySelector('[data-nested-overlay]')) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Настройки профиля"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#171215]/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(23,18,21,0.35)] ${
          isAccount ? 'w-[520px]' : 'h-[580px] w-[728px]'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3">
          <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-[#171215]">
            {active.dialogLabel ?? active.label}
          </h2>
          <button
            type="button"
            onClick={onClose}
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
      </div>
    </div>
  )
}
