import { HugeiconsIcon } from '@hugeicons/react'

/**
 * One of the two arrows a card pages itself with.
 *
 * **At the size every small square control on this page is** — 28px with a
 * 15px glyph, the same target the timetable's own ‹ › carry. Two cards hold a
 * pair now: `NowCard` pages parallel bookings and `UpNextCard` pages the queue,
 * and a second copy of a button is a button that agrees with the first until
 * one of them is restyled.
 *
 * Muted until it is reached for, because a control that is permanently lit is
 * one more thing competing with the number it sits above.
 */
export default function Step({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted outline-none transition-[color,background-color,border-color,scale] hover:bg-ink/6 hover:text-ink focus-visible:bg-ink/6 focus-visible:text-ink active:scale-[0.95]"
    >
      <HugeiconsIcon
        icon={icon}
        size={15}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
    </button>
  )
}
