import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { formatDuration, formatPrice } from '../../lib/appointments'
import { FIELD, FIELD_ERROR } from '../controls'

/**
 * The service: type it, or open the price list and pick one.
 *
 * **Both, not either.** The list is what the business usually sells; a day
 * contains things it sells once — a one-off job, a favour, an amount agreed on
 * the phone — and making the list the only way in would mean inventing a
 * permanent service to record a single afternoon. So the field is an ordinary
 * text box and the list is a shortcut into it.
 *
 * It is a combobox rather than a `<select>` for the reason the styling rules
 * give: a select owns every keypress, and there is nowhere inside one for a
 * text field to live. Radix supplies the popover — anchoring, outside click,
 * collision — and nothing else.
 *
 * **The list filters as you type**, which is what keeps it useful past a
 * handful of services and is also what makes the two halves feel like one
 * control: the same keystrokes that write a name narrow the rows that could
 * have supplied it.
 */
export default function ServiceField({
  value,
  onChange,
  onPick,
  services,
  chosenId,
  invalid,
  label,
}) {
  const [open, setOpen] = useState(false)

  const query = value.trim().toLowerCase()
  const matches = query
    ? services.filter((item) => item.name.toLowerCase().includes(query))
    : services

  return (
    <Popover.Root open={open && matches.length > 0} onOpenChange={setOpen}>
      {/* An anchor, not a trigger: the input must keep the focus and the
          keystrokes, and a trigger would take both. */}
      <Popover.Anchor asChild>
        <div className="relative">
          <input
            value={value}
            onChange={(event) => {
              onChange(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            maxLength={120}
            autoComplete="off"
            aria-label={label}
            aria-expanded={open}
            className={`${invalid ? FIELD_ERROR : FIELD} h-9 pr-9 text-[14px]`}
          />

          {services.length > 0 && (
            <button
              type="button"
              // The list is the only thing this toggles, so it says so and
              // nothing more; the field beside it is already labelled.
              aria-label={label}
              onClick={() => setOpen((was) => !was)}
              className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted outline-none transition-colors hover:text-ink focus-visible:text-ink"
            >
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={16}
                strokeWidth={2}
                className={`transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          // The focus stays in the input: this is a list you are being offered
          // while typing, not a place you were sent.
          onOpenAutoFocus={(event) => event.preventDefault()}
          // Above the booking panel's own `z-[60]`, and tagged so one Escape
          // closes this list and not the panel behind it.
          data-nested-overlay
          className="z-[70] max-h-[196px] w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)]"
        >
          {matches.map((item) => {
            const chosen = item.id === chosenId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onPick(item)
                  setOpen(false)
                }}
                aria-pressed={chosen}
                // A service is a name, a length and a price, and the two
                // numbers are most of what decides which one this booking is —
                // so all three are on the row rather than the name alone.
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors ${
                  chosen
                    ? 'bg-surface-chip'
                    : 'hover:bg-ink/6 focus-visible:bg-ink/6'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {item.name}
                  </span>
                  <span className="block text-[12px] text-muted">
                    {formatDuration(item.duration_minutes)}
                  </span>
                </span>
                <span className="shrink-0 font-display text-[13px] font-semibold text-ink">
                  {formatPrice(item.price)}
                </span>
              </button>
            )
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
