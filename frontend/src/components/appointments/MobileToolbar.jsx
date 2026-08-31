import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Calendar03Icon,
  LeftToRightListBulletIcon,
  Search01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { useT } from '../../lib/i18n'
import BookingPopover from './BookingPopover'
import { CONTROLS_HEIGHT } from './grid'
import { PANEL_MOTION } from './panel'

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
 * All three do something now. The add panel is finished and works from a phone
 * unchanged, search takes the screen over — see `MobileSearch` — and the third
 * switches between the two things this screen can be: the calendar, or the day
 * around it. It was a filter with nothing to filter, which is a button waiting
 * for a feature; a switcher is what that slot turned out to be for.
 */
export default function MobileToolbar({
  leading,
  services,
  week,
  timeZone,
  onDayChange,
  onSaved,
  onSearch,
  view,
  onViewChange,
}) {
  const t = useT()

  return (
    // **The bar carries its own height rather than filling its parent.** It
    // was `h-full`, which is right inside the calendar's reserved box and wrong
    // everywhere else: on the day screen the parent is the whole screen, so the
    // bar took all of it and `items-end` pushed the row to the bottom with the
    // grid shoved off below. A control bar is 96px tall wherever it is put.
    //
    // **`ml-auto` on the pill, not `justify-between` on the row.** With one
    // child `justify-between` is `flex-start`, so the bar with nothing on its
    // left put the controls against the *left* edge — the arrangement was right
    // only in the case that happened to have two children in it. Pushing the
    // pill from its own side is true in both.
    <div
      style={{ height: CONTROLS_HEIGHT }}
      className="flex shrink-0 items-end gap-2 px-4 pb-2"
    >
      {/* **The wordmark, unless something more useful wants the slot.** This
          screen drops the app's header below `sm` to give its 68px to the
          grid, and the name went with it — a screen with the product's name
          nowhere on it reads as a fragment rather than as a place. The bar had
          an empty left third anyway.

          `leading` wins where it is given: on the day screen that slot is the
          way back, and a drill-down's left corner belongs to the way out of it
          rather than to a label. `h-12` so the name sits on the pill's centre
          line — the row is `items-end`, and text with no box of its own would
          hang from its baseline instead. */}
      {leading ?? (
        <span className="flex h-12 shrink-0 items-center font-display text-[20px] font-bold tracking-[-0.03em] text-ink">
          AIRec
        </span>
      )}
      <div className="ml-auto flex items-center gap-0.5 rounded-full bg-surface-card p-1">
        <ViewSwitch value={view} onChange={onViewChange} />
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
 * Which of the two this screen is: the calendar, or the day around it.
 *
 * **A menu of two rather than a segmented control**, which is what a desktop
 * would use. A segment needs room for both words permanently, and this bar has
 * a back button and two other controls in it on a 390pt screen; a menu spends
 * one 40px circle and shows the words only while the choice is being made.
 *
 * The glyph is the view you are *in*, not the one you would go to — a control
 * that shows its own state is read at a glance, where one that shows its effect
 * has to be worked out. The tick beside the open item says the same thing again
 * inside the menu, which is where somebody has come to check.
 */
function ViewSwitch({ value, onChange }) {
  const t = useT()
  const options = [
    {
      id: 'calendar',
      icon: Calendar03Icon,
      label: t('appointments.viewCalendar'),
    },
    {
      id: 'list',
      icon: LeftToRightListBulletIcon,
      label: t('appointments.viewList'),
    },
  ]
  const current = options.find((option) => option.id === value) ?? options[0]

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <ToolButton icon={current.icon} label={current.label} />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className={`z-[70] w-[196px] rounded-xl border border-line bg-surface p-1 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] ${PANEL_MOTION}`}
        >
          {options.map((option) => (
            <Popover.Close asChild key={option.id}>
              <button
                type="button"
                onClick={() => onChange?.(option.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[15px] text-ink outline-none transition-colors hover:bg-ink/6 focus-visible:bg-ink/6 active:bg-ink/10"
              >
                <HugeiconsIcon
                  icon={option.icon}
                  size={18}
                  strokeWidth={2}
                  className="shrink-0 text-muted"
                />
                {option.label}
                {option.id === current.id && (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={16}
                    strokeWidth={2.4}
                    className="ml-auto shrink-0 text-ink"
                  />
                )}
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
      // A deeper dip than the rows get: 0.97 of a 40px circle is under a pixel,
      // which is a press state you can measure and cannot see.
      className="grid h-10 w-10 place-items-center rounded-full text-ink outline-none transition-[background-color,scale] duration-[160ms] ease-out hover:bg-ink/8 focus-visible:bg-ink/8 active:scale-[0.95]"
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
