import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { PANEL_MOTION } from '../appointments/panel'

/**
 * Several answers out of a short closed set, behind one line.
 *
 * **A popover of checkable rows, not a `<select multiple>` and not a row of
 * chips.** Nine payment methods as chips were two wrapped lines and most of the
 * card's height for a field that is set once; a native multiple select is a
 * scrolling box the operating system draws, in a product with no blue. This is
 * the shape the app already uses for a small closed set — the booking panel's
 * status row and the toolbar's view switch — with a tick where a single-choice
 * list would have a dot.
 *
 * **The trigger says the answer, not the count.** «Наличные, Kaspi QR» is what
 * was chosen; "2 выбрано" is a number you have to open the list to understand.
 * It truncates rather than wrapping, so the field stays one line however many
 * are ticked.
 */
export default function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  readOnly,
}) {
  const toggle = (option) =>
    onChange(
      value.includes(option)
        ? value.filter((item) => item !== option)
        : [...value, option],
    )

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] text-muted">{label}</span>

      <Popover.Root>
        <Popover.Trigger asChild>
          {/* The field's own ring, so this reads as the same kind of object as
              the text inputs beside it rather than as a button that wandered
              into the form. */}
          <button
            type="button"
            // Not pressable outside edit mode, and no ring reacting to a cursor
            // that has nothing to press — but the text keeps its full contrast,
            // because reading the answer is what the row is for.
            disabled={readOnly}
            className={`flex h-8 w-full items-center gap-2 rounded-xl bg-surface px-3 text-left text-[16px] text-ink shadow-[0_0_0_1px_var(--color-field)] outline-none transition-shadow duration-150 sm:text-[14px] ${
              readOnly
                ? 'cursor-default'
                : 'hover:shadow-[0_0_0_1px_var(--color-field-hover)] focus-visible:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)]'
            }`}
          >
            <span
              className={`min-w-0 flex-1 truncate ${
                value.length > 0 ? 'text-ink' : 'text-muted'
              }`}
            >
              {value.length > 0 ? value.join(', ') : placeholder}
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={16}
              strokeWidth={2}
              className="shrink-0 text-muted"
            />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            // Matched to the trigger, so the list lines up with the field it
            // belongs to instead of floating at a width of its own.
            className={`z-50 max-h-[280px] w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] outline-none ${PANEL_MOTION}`}
          >
            {options.map((option) => {
              const isOn = value.includes(option)

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggle(option)}
                  aria-pressed={isOn}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] text-ink outline-none transition-colors hover:bg-ink/6 focus-visible:bg-ink/6"
                >
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                  {/* The tick is the whole of the state, so the row keeps its
                      height whether or not it is there — `invisible`, not
                      absent. */}
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={16}
                    strokeWidth={2.4}
                    className={`shrink-0 ${isOn ? '' : 'invisible'}`}
                  />
                </button>
              )
            })}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </label>
  )
}
