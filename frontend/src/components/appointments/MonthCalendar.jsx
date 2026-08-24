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
    // **No card.** No radius, no fill, no border — the month sits straight on
    // the page ground, the same treatment the timetable and the rail already
    // take. A picker is a control, not an object on the page, and boxing it
    // made it the loudest thing in a column whose subject is the grid.
    //
    // It carries no padding of its own either: the space around it belongs to
    // whatever holds it, so the gap from the edge is set in one place instead
    // of being the sum of two.
    // **`w-full`, and the proportions carried by ratios rather than by fixed
    // sizes.** It was pinned to the reference's own 282px so the measurements
    // taken off `design/calendar.png` meant something; now it fills whatever
    // panel holds it, and what is preserved from those measurements is the
    // *shape* — a cell 36 wide to every 40 tall, the gaps and the type scaled
    // with it. That is what lets the panel be resized without this needing a
    // new set of numbers each time.
    //
    // No card: no radius, no fill, no border, and no padding of its own — the
    // month sits straight on the page ground, exactly as it does there, and
    // the gap from the edge belongs to whatever holds it.
    <section className="w-full">
      {/* Circles centred over the first and last column: `justify-between`
          puts each one's centre half its own width in from the end, which is
          where those two columns are centred as long as the circle is about as
          wide as a cell. */}
      <header className="flex h-11 items-center justify-between gap-2">
        <StepButton
          label={t('calendar.prevMonth')}
          icon={ArrowLeft01Icon}
          onClick={() => setMonth(shiftMonth(month, -1))}
        />

        <h2 className="min-w-0 truncate font-display text-[20px] font-semibold text-ink">
          {monthLabel(month)}
        </h2>

        <StepButton
          label={t('calendar.nextMonth')}
          icon={ArrowRight01Icon}
          onClick={() => setMonth(shiftMonth(month, 1))}
        />
      </header>

      {/* 18px below the arrows, a 20px line, 7px above the grid — the three
          gaps the reference measures out between its header, its column names
          and its first row of days. The 11px uppercase muted step is the one
          the tables elsewhere use for their heads, so a heading is a heading
          throughout, and it is what the reference sets these at too.

          `muted/80`, not plain `muted`: the reference greys these to the same
          value it greys a day outside the month, and ours was a step lighter
          than both. */}
      <div className="mt-[22px] grid h-6 grid-cols-7 gap-x-[2px]">
        {weekdays.map((label) => (
          <span
            key={label}
            className="grid place-items-center text-[13px] font-medium tracking-wide text-muted/80"
          >
            {label}
          </span>
        ))}
      </div>

      {/* **Cells are 36 × 40, on a 41 × 48 pitch** — the reference's own
          numbers, and taller than they are wide rather than square. Not a
          coincidence of its layout: a row of seven two-digit numbers is read
          across, and a little extra height is what separates one week from the
          next without a rule between them.

          `gap-x-[5px]` / `gap-y-[8px]` are those pitches minus the cells. The
          uneven pair is the point — horizontally the gap only has to keep two
          numbers apart, vertically it has to keep two *weeks* apart. */}
      <div className="mt-[9px] grid grid-cols-7 gap-x-[2px] gap-y-[2px]">
        {days.map((day) => {
          const outside = !sameMonth(day, month)
          const isToday = sameDay(day, today)
          const isSelected = value ? sameDay(day, value) : false
          // **The reference greys Saturday and Sunday**, and greys them to
          // exactly the value it greys a day outside the month — one "not an
          // ordinary working day" state, not two. Copied here because it was
          // asked for; worth knowing it is a claim about the business: working
          // hours are per-day on `/business`, and a barbershop's Saturday is
          // its busiest day. If it ever reads wrong, `dim` is the one line to
          // change.
          const weekend = day.getDay() === 0 || day.getDay() === 6
          const dim = outside || weekend

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
              // **Square, and the gaps down to 2px** — the numbers were too
              // far apart once the calendar was scaled up. The reference's
              // 36 × 40 cell on a 5 / 8 gap is right at its own size; enlarged
              // by a third it carried the spacing up with it, and a month
              // whose rows are 62px apart reads as a list rather than a grid.
              //
              // Horizontal spacing is what is left over: seven columns share
              // the panel's width, so the only way to close the numbers up
              // sideways is a narrower calendar, not a smaller gap.
              //
              // `rounded-xl` rather than `lg`: 8px on a 36px pill and 8px on a
              // 47px one are not the same corner.
              //
              // **`#3178F4` is the reference's blue, hard-coded and the same in
              // both themes**, like `--now` on the timetable. It is a departure
              // from this project's rule that the selection wears `accent`,
              // which is monochrome — taken deliberately, because the ask was
              // for this drawing exactly. Swap the one class back to
              // `bg-accent text-surface` to undo it.
              className={`grid aspect-square place-items-center rounded-xl font-display text-[20px] font-medium outline-none transition-colors ${
                isSelected
                  ? 'bg-[#3178F4] text-white'
                  : isToday
                    ? `bg-ink/8 hover:bg-ink/12 ${dim ? 'text-muted/80' : 'text-ink'}`
                    : dim
                      ? 'text-muted/80 hover:bg-ink/4'
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
 *
 * 36px, up from 32. With the card gone there is no edge holding the header
 * together, so the two circles and the month name are the whole of it, and at
 * 32 they read as trim beside a 39px day cell rather than as the controls.
 */
function StepButton({ label, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink/[0.09] text-ink outline-none transition-colors hover:bg-ink/20 focus-visible:bg-ink/20"
    >
      <HugeiconsIcon
        icon={icon}
        size={22}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
    </button>
  )
}
