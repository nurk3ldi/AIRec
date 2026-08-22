import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import {
  dayKey,
  monthGrid,
  monthLabel,
  sameDay,
  sameMonth,
  shiftMonth,
  weekdayLabels,
} from '../../lib/dates'
import { useT } from '../../lib/i18n'

/**
 * The month picker that drives the «Записи» screen: pick a day on the left,
 * read that day's bookings beside it.
 *
 * **The grid is always six rows.** `monthGrid` returns 42 cells whatever the
 * month, so the card is the same height in February as in October. Sizing each
 * month to its own row count saves a row four times a year and pays for it with
 * the whole page shifting under the pointer every time you step a month — and
 * this control exists to be stepped through.
 *
 * Two departures from the reference it is drawn from, both deliberate:
 *
 * **The selected day is `accent`, not blue.** There is no brand hue in this
 * project — it runs on ink and surface, and emphasis is carried by contrast.
 * On a light page the selected day is a black square with white numerals, on a
 * dark one the inverse; either way it is the strongest mark on the card, which
 * is all the reference's blue was doing.
 *
 * **Weekends are not dimmed.** The reference greys Saturday and Sunday, and
 * here that would be a claim rather than a decoration: working hours are set
 * per day on `/business`, and a barbershop open on Saturday would be told its
 * busiest day is closed. When the schedule is wired in, the days to dim are the
 * ones actually marked closed — that is the same ink saying something true.
 */
export default function MonthCalendar({ value, onChange }) {
  const t = useT()
  // The month on screen, which is not the same thing as the day chosen: you
  // browse away from your selection and back without losing it.
  const [month, setMonth] = useState(() => new Date(value ?? Date.now()))

  const today = new Date()
  const days = monthGrid(month)
  const weekdays = weekdayLabels()

  const pick = (day) => {
    // Stepping onto a neighbouring month's day moves the view with it —
    // otherwise the day you just chose is the one cell you can no longer see.
    if (!sameMonth(day, month)) setMonth(shiftMonth(day, 0))
    onChange?.(day)
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      {/* `p-4`, not the card default of 24: seven columns of two-digit numbers
          are dense by nature, and the usual padding pushes the cells small
          enough that the tap target goes before the layout does. */}
      <header className="flex items-center justify-between gap-2">
        <StepButton
          label={t('calendar.prevMonth')}
          icon={ArrowLeft01Icon}
          onClick={() => setMonth(shiftMonth(month, -1))}
        />

        <h2 className="min-w-0 truncate font-display text-[15px] font-semibold text-ink">
          {monthLabel(month)}
        </h2>

        <StepButton
          label={t('calendar.nextMonth')}
          icon={ArrowRight01Icon}
          onClick={() => setMonth(shiftMonth(month, 1))}
        />
      </header>

      {/* The column headings take the same 11px uppercase muted step the tables
          elsewhere use for their heads, so a heading is a heading throughout. */}
      <div className="mt-4 grid grid-cols-7 gap-1">
        {weekdays.map((label) => (
          <span
            key={label}
            className="grid h-7 place-items-center text-[11px] font-medium tracking-wide text-muted"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const outside = !sameMonth(day, month)
          const isToday = sameDay(day, today)
          const isSelected = value ? sameDay(day, value) : false

          return (
            <button
              key={dayKey(day)}
              type="button"
              onClick={() => pick(day)}
              aria-label={day.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              aria-pressed={isSelected}
              // `aria-current` is what tells a screen reader which cell is
              // today; the tint alone says it only to someone who can see it.
              aria-current={isToday ? 'date' : undefined}
              className={`grid aspect-square place-items-center rounded-lg font-display text-[13px] font-medium outline-none transition-colors ${
                isSelected
                  ? 'bg-accent text-surface'
                  : outside
                    ? 'text-muted/60 hover:bg-ink/4'
                    : isToday
                      ? 'bg-ink/8 text-ink hover:bg-ink/12'
                      : 'text-ink hover:bg-ink/6'
              } focus-visible:bg-ink/10`}
            >
              {String(day.getDate()).padStart(2, '0')}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/**
 * One of the two month arrows.
 *
 * Round, because it does the same job in both directions and a circle has no
 * direction of its own — and **filled at rest**, not only under the cursor: a
 * glyph alone reads as a label until you happen to hover it, and these two are
 * the only things on the card you are meant to press repeatedly.
 *
 * The fill is an ink tint rather than `ground`, which on the dark theme is the
 * same black as the surface and would show nothing at all. **12%, not the 6 it
 * started at** — six reads as a smudge on a white card, and a circle you have to
 * look for is not doing the job the circle was added for.
 */
function StepButton({ label, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink/12 text-ink outline-none transition-colors hover:bg-ink/20 focus-visible:bg-ink/20"
    >
      <HugeiconsIcon
        icon={icon}
        size={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
    </button>
  )
}
