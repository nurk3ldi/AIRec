import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import { FilterHorizontalIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { BOOKING_STATES } from '../../lib/appointments'
import { useT } from '../../lib/i18n'

/**
 * The label for each of the four states, keyed by the state's id.
 *
 * `BOOKING_STATES` carries Russian labels of its own, and they stay there for
 * the code that has no `t` to call. Here there is one, and a filter whose
 * options are in a language the rest of the panel is not in is a filter that
 * looks broken.
 */
const LABEL_KEYS = {
  confirmed: 'booking.active',
  completed: 'booking.completed',
  no_show: 'booking.noShow',
  cancelled: 'booking.cancelled',
}

/**
 * Which statuses the grid is showing.
 *
 * **Filtered here rather than re-fetched.** `GET /appointments` takes `status=`
 * and the temptation is to use it, but the page already holds the whole week —
 * asking the server again to show fewer of the rows it just sent is a round
 * trip for an answer already in memory, and it would make ticking a box feel
 * like loading a page.
 *
 * **Nothing ticked means everything shown**, not nothing shown. An empty filter
 * is the state you arrive in, and a calendar that starts blank until you tell
 * it what to display would be a calendar that hides the day by default.
 */
export default function StatusFilter({ value, onChange }) {
  const t = useT()

  const toggle = (id) => {
    const next = new Set(value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        // The pill the toolbar's other controls are: 32px, fully round,
        // `surface-chip`. It sits beside the heading rather than out with the
        // steppers because it changes *what the grid contains*, and everything
        // on the right changes which days are on screen.
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-surface-chip pr-3.5 pl-3 text-[13px] font-medium text-ink outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85"
      >
        <HugeiconsIcon
          icon={FilterHorizontalIcon}
          size={15}
          strokeWidth={2}
          className="shrink-0"
        />
        {t('appointments.filter')}
        {/* The count only appears once the filter is doing something. A badge
            reading 0 is a badge that has to be read before it can be ignored. */}
        {value.size > 0 && (
          <span className="font-display tabular-nums">{value.size}</span>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={12}
          data-nested-overlay
          className="z-[70] w-[196px] rounded-xl border border-line bg-surface p-1 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)]"
        >
          {BOOKING_STATES.map((state) => {
            const on = value.has(state.id)
            return (
              <button
                key={state.id}
                type="button"
                onClick={() => toggle(state.id)}
                aria-pressed={on}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] text-ink outline-none transition-colors hover:bg-ink/6 focus-visible:bg-ink/6"
              >
                <span className="min-w-0 flex-1 truncate">
                  {t(LABEL_KEYS[state.id])}
                </span>
                {/* A tick where there is one and nothing where there is not,
                    rather than an empty box: four empty boxes are four things
                    to read before finding the one that is ticked. */}
                {on && (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={15}
                    strokeWidth={2.4}
                    className="shrink-0"
                  />
                )}
              </button>
            )
          })}

          {value.size > 0 && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="mt-1 w-full rounded-lg border-t border-line px-2.5 pt-2 pb-1.5 text-left text-[13px] text-muted outline-none transition-colors hover:text-ink focus-visible:text-ink"
            >
              {t('appointments.filterClear')}
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
