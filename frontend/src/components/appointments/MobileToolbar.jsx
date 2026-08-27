import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  FilterHorizontalIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { useT } from '../../lib/i18n'
import BookingPopover from './BookingPopover'

/**
 * The phone's controls for `/appointments`, in the room the calendar reserves
 * for them — see `CONTROLS_HEIGHT` in `MonthScroller`.
 *
 * **Three in one pill against the right edge**, the shape the reference uses
 * and the one a thumb reaches: the right-hand third of the top of a phone is
 * where a hand already is, and a pill groups them as one control rather than
 * three things that happen to be near each other. The order runs from the least
 * to the most consequential — narrow the list, look for something, add
 * something — so the one that changes the day's record is furthest from an
 * accidental tap on the way to the others.
 *
 * `surface-card` for the pill, not `surface-raised`: this sits on the page's own
 * ground, which is pure black on the dark theme, and `#0e0e0e` there is a step
 * nobody can see.
 *
 * **Only «+» does anything yet, and the other two say so by being here at all.**
 * That is the trade this screen is at: the add panel is finished and works from
 * a phone unchanged, while the filter has nothing to filter until the calendar
 * carries markers, and search has no screen to put its results on. Both are
 * placed rather than invented — the layout is what was asked for — and neither
 * pretends: they carry their real labels and will be wired to the things those
 * labels name.
 */
export default function MobileToolbar({
  services,
  week,
  timeZone,
  onDayChange,
  onSaved,
}) {
  const t = useT()

  return (
    <div className="flex h-full items-end justify-end px-4 pb-2">
      <div className="flex items-center gap-0.5 rounded-full bg-surface-card p-1">
        <ToolButton icon={FilterHorizontalIcon} label={t('appointments.filter')} />
        <ToolButton icon={Search01Icon} label={t('header.search')} />

        {/* The panel is anchored to this button and rendered from here for that
            reason: Radix positions and traps focus against the element that
            opened it, so a trigger and its popover cannot live in different
            components. The day it writes for is the calendar's own selection. */}
        <BookingPopover
          onDayChange={onDayChange}
          services={services}
          week={week}
          timeZone={timeZone}
          onSaved={onSaved}
        >
          <ToolButton icon={Add01Icon} label={t('appointments.create')} />
        </BookingPopover>
      </div>
    </div>
  )
}

/**
 * One control in the pill.
 *
 * 40px, which clears the 44pt target once the pill's own padding is counted —
 * the two together are what a thumb actually lands on. Round, because the pill
 * is, and a square inside a capsule reads as a mistake at this size.
 *
 * It forwards every prop it is given: `BookingPopover` hands its trigger the
 * ref and the handlers Radix needs through `asChild`, and a button that ate
 * them would be a button that never opened anything. React 19 passes `ref` as
 * an ordinary prop, so the spread carries it without `forwardRef`.
 */
function ToolButton({ icon, label, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full text-ink outline-none transition-colors hover:bg-ink/8 focus-visible:bg-ink/8"
      {...rest}
    >
      <HugeiconsIcon
        icon={icon}
        size={21}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </button>
  )
}
