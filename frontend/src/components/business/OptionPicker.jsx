import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons'

/**
 * The picker behind every closed-set field on the business profile: city,
 * payment methods, service languages, time zone.
 *
 * Built on Popover + cmdk rather than Radix's select, because a select's
 * keyboard handling is *jump-to-letter*, not filtering — it owns every keypress
 * and there is nowhere for a search box to live.
 *
 * The search input is always rendered, and merely hidden when `searchable` is
 * false: it is what gives cmdk something to attach arrow keys and type-ahead
 * to, so a three-item list stays keyboard-navigable without showing a search
 * box nobody needs.
 *
 * Multi-value fields are stored as one comma-separated string, because that's
 * what the column holds — parsing on the way in and joining on the way out
 * keeps the API free of a list type it would otherwise need only here.
 */
const parse = (value) =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

export default function OptionPicker({
  value,
  options,
  onChange,
  disabled,
  label,
  multiple = false,
  searchable = false,
}) {
  const [open, setOpen] = useState(false)
  const selected = multiple ? parse(value) : []

  const isChecked = (option) =>
    multiple ? selected.includes(option) : option === value

  const handleSelect = (option) => {
    if (!multiple) {
      setOpen(false)
      if (option !== value) onChange(option)
      return
    }

    // Toggling: the menu stays open, since picking several is the whole point.
    const next = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option]
    // Kept in the order the options are listed rather than the order they were
    // clicked, so the stored string doesn't depend on how it was assembled.
    const ordered = options.filter((option) => next.includes(option))
    onChange(ordered.join(', ') || null)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled}
        aria-label={label}
        // `items-start` so a value that wraps to several lines keeps the
        // chevron pinned to the first one.
        className="group mt-1.5 flex w-full items-start justify-between gap-2 rounded-lg text-left outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {/* Several values read as several things, not as one long sentence
            with commas in it — so each gets its own chip and the row wraps. */}
        {multiple && selected.length > 0 ? (
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {selected.map((item) => (
              <span
                key={item}
                className="rounded-md bg-[#F6F8FA] px-2.5 py-1 text-[13px] font-medium text-[#171215]"
              >
                {item}
              </span>
            ))}
          </span>
        ) : (
          <span
            className={`min-w-0 flex-1 text-[16px] break-words ${
              value ? 'font-semibold text-[#171215]' : 'font-medium text-[#999999]'
            }`}
          >
            {value || 'Не указано'}
          </span>
        )}

        {/* Hidden until the row is hovered or focused, so nine permanent
            affordances don't compete for attention. */}
        <span className="-mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#999999] opacity-0 transition-all group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100">
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.2}
          />
        </span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-[60] w-[300px] overflow-hidden rounded-xl border border-[#999999]/25 bg-white shadow-[0_16px_40px_-8px_rgba(23,18,21,0.28)]"
        >
          <Command
            // Substring, not fuzzy scoring: on place names a fuzzy match
            // produces results nobody asked for.
            filter={(option, search) =>
              option.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
            }
          >
            <Command.Input
              autoFocus
              aria-label={`Поиск: ${label}`}
              className={
                searchable
                  ? 'h-10 w-full border-b border-[#999999]/20 bg-transparent px-3 text-[14px] text-[#171215] outline-none'
                  : 'sr-only'
              }
            />

            <Command.List className="max-h-[220px] overflow-y-auto p-1.5 [scrollbar-color:#3248F2_#F6F8FA] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#3248F2] [&::-webkit-scrollbar-track]:bg-[#F6F8FA] [&::-webkit-scrollbar]:w-2">
              <Command.Empty className="px-3 py-6 text-center text-[13px] text-[#999999]">
                Ничего не найдено
              </Command.Empty>

              {options.map((option) => {
                const checked = isChecked(option)

                return (
                  <Command.Item
                    key={option}
                    value={option}
                    onSelect={() => handleSelect(option)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-[#171215] outline-none select-none data-[selected=true]:bg-[#F6F8FA]"
                  >
                    <span className="min-w-0 flex-1 truncate">{option}</span>

                    {/* A square box, not a round radio: these fields hold
                        several values at once, and a radio would promise that
                        picking one drops the last. Single-value pickers keep
                        the plain tick instead — same side, lighter mark. */}
                    {multiple ? (
                      <span
                        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors ${
                          checked
                            ? 'border-[#3248F2] bg-[#3248F2] text-white'
                            : 'border-[#999999]/45'
                        }`}
                      >
                        {checked && (
                          <HugeiconsIcon
                            icon={Tick02Icon}
                            size={12}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                          />
                        )}
                      </span>
                    ) : (
                      checked && (
                        <span className="shrink-0 text-[#3248F2]">
                          <HugeiconsIcon
                            icon={Tick02Icon}
                            size={16}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.4}
                          />
                        </span>
                      )
                    )}
                  </Command.Item>
                )
              })}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
