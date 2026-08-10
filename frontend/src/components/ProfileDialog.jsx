import { useEffect } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import AccountSettings from './profile/AccountSettings'
import { PROFILE_SECTIONS, SECTION_PLACEHOLDERS } from './profile/sections'
import ComingSoon from './ComingSoon'

/**
 * Settings dialog opened from `ProfileMenu`, showing exactly the section the
 * menu picked — switching sections means going back to the menu, so there is
 * no navigation inside.
 *
 * The panel is a fixed size regardless of which section is showing, so the
 * window never jumps between openings; overflowing content scrolls instead.
 * The max-* pair only kicks in on viewports smaller than the panel itself.
 *
 * Nothing here is a route — the whole profile area lives in this overlay, so
 * there are no `/profile/*` pages to keep in sync.
 */
export default function ProfileDialog({ section, onClose, onUserChange }) {
  const active = PROFILE_SECTIONS.find((s) => s.id === section) ?? PROFILE_SECTIONS[0]

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
      <div className="flex h-[580px] w-[560px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(23,18,21,0.35)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#999999]/20 px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#171215]">
              {active.label}
            </h2>
            <p className="mt-0.5 text-[13px] text-[#999999]">
              {active.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#999999] transition-colors hover:bg-[#F6F8FA] hover:text-[#171215]"
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

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {active.id === 'account' ? (
            <AccountSettings onUserChange={onUserChange} />
          ) : (
            <ComingSoon>{SECTION_PLACEHOLDERS[active.id]}</ComingSoon>
          )}
        </div>
      </div>
    </div>
  )
}
