import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar03Icon } from '@hugeicons/core-free-icons'
import { dayKey } from '../../lib/dates'
import { getLocale } from '../../lib/i18n'
import { FIELD } from '../controls'
import MonthCalendar from './MonthCalendar'
import { PANEL_MOTION } from './panel'

/**
 * A date field that opens this project's own month, not the browser's.
 *
 * It was a native `<input type="date">`, which behaves impeccably and drops a
 * calendar drawn by Chrome: a white sheet with a blue selection, on a product
 * that has no blue and two colours. The same reason a native `<select>` was
 * turned down for the settings rows, and the same answer — take the behaviour
 * from Radix, draw the rest.
 *
 * **The month inside is `MonthCalendar`, the one already in the panel beside
 * this.** Not a second calendar written to look like it: two implementations of
 * "which day is today" would agree until the first time one of them was edited,
 * and this one would be the copy nobody remembers to fix.
 *
 * Choosing a day closes the popover. A calendar that stays open after the one
 * thing it exists for has happened is a calendar you then have to dismiss.
 */
export default function DateField({ value, onChange, label }) {
  const [open, setOpen] = useState(false)
  // `T00:00:00` is load-bearing: a bare `YYYY-MM-DD` is parsed as UTC, which is
  // the previous day for anyone west of Greenwich.
  const selected = value ? new Date(`${value}T00:00:00`) : null

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        aria-label={label}
        className={`${FIELD} flex h-9 items-center justify-between gap-2 text-[14px] outline-none`}
      >
        <span className={selected ? 'text-ink' : 'text-muted'}>
          {selected
            ? selected.toLocaleDateString(getLocale(), {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })
            : '--'}
        </span>
        <HugeiconsIcon
          icon={Calendar03Icon}
          size={16}
          strokeWidth={2}
          className="shrink-0 text-muted"
        />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          // Above the booking panel's own `z-[60]`, and tagged so one Escape
          // closes this month and not the panel behind it.
          data-nested-overlay
          className={`z-[70] w-[300px] rounded-xl border border-line bg-surface p-3 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] ${PANEL_MOTION}`}
        >
          <MonthCalendar
            // `null` while nothing is chosen, deliberately: `MonthCalendar`
            // marks the selection with a filled orange cell, so handing it
            // today would show a value the form does not have. It opens on the
            // current month from that same null, which is where a month has to
            // open when there is nothing else to go on.
            value={selected}
            onChange={(day) => {
              onChange(dayKey(day))
              setOpen(false)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
