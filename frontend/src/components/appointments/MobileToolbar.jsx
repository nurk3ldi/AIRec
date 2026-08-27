import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  FilterHorizontalIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { useT } from '../../lib/i18n'
import BookingPopover from './BookingPopover'
import { CONTROLS_HEIGHT } from './grid'

/**
 * The phone's controls for `/appointments`, in the room the calendar reserves
 * for them — see `CONTROLS_HEIGHT` in `grid.js`.
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
 * **«+» and search work; the filter does not yet.** The add panel is finished
 * and works from a phone unchanged, and search takes the screen over — see
 * `MobileSearch`. The filter has nothing to filter until the calendar carries
 * markers, so it is placed rather than invented: it carries its real label and
 * will be wired to the thing that label names.
 */
export default function MobileToolbar({
  leading,
  services,
  week,
  timeZone,
  onDayChange,
  onSaved,
  onSearch,
}) {
  const t = useT()

  return (
    // **The bar carries its own height rather than filling its parent.** It
    // was `h-full`, which is right inside the calendar's reserved box and wrong
    // everywhere else: on the day screen the parent is the whole screen, so the
    // bar took all of it and `items-end` pushed the row to the bottom with the
    // grid shoved off below. A control bar is 96px tall wherever it is put.
    //
    // `justify-between` with nothing on the left still puts the pill on the
    // right, so the two arrangements are one row rather than two.
    <div
      style={{ height: CONTROLS_HEIGHT }}
      className="flex shrink-0 items-end justify-between gap-2 px-4 pb-2"
    >
      {leading}
      <div className="flex items-center gap-0.5 rounded-full bg-surface-card p-1">
        <ToolButton icon={FilterHorizontalIcon} label={t('appointments.filter')} />
        <ToolButton
          icon={Search01Icon}
          label={t('header.search')}
          onClick={onSearch}
        />

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
