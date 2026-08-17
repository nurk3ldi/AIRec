import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Chat01Icon,
  Clock01Icon,
} from '@hugeicons/core-free-icons'
import {
  bookingColor,
  byStart,
  formatDuration,
  formatPrice,
  statusLabel,
} from '../../lib/appointments'
import { DAY_NAMES, MONTHS_OF, dayKey } from '../../lib/dates'

/**
 * One day's bookings, beside the month.
 *
 * The reference's «Scheduled» column, in this product's terms: its meetings are
 * our appointments, its attendees are the one client who is coming, and its
 * category colours mark *which booking* — the same colour it wears in the month
 * beside it, because both order a day with `byStart`.
 *
 * Bookings are grouped under the hour they start in, and the hour label runs a
 * hairline out to the edge. That line is doing real work: without it a stack of
 * cards reads as a list of things, where the point of this column is *when*
 * each of them is.
 */

const hourOf = (block) => block.from.slice(0, 2)

export default function DayPanel({
  date,
  blocks,
  onDateChange,
  onCreate,
  onOpen,
}) {
  const key = dayKey(date)

  const mine = (blocks ?? [])
    .filter((block) => block.day === key)
    .sort(byStart)

  // Each booking's place in the whole day, kept before the list is cut into
  // hours: the colour belongs to the day's order, not to the group it lands in,
  // or the first booking of every hour would come out the same colour.
  const order = new Map(mine.map((block, index) => [block.id, index]))

  // Kept as a list of [hour, bookings] rather than an object, so the order is
  // the order they happen in and not whatever key order the runtime gives.
  const hours = []
  for (const block of mine) {
    const hour = hourOf(block)
    const last = hours[hours.length - 1]
    if (last && last[0] === hour) last[1].push(block)
    else hours.push([hour, [block]])
  }

  const step = (direction) => {
    const next = new Date(date)
    next.setDate(next.getDate() + direction)
    onDateChange(next)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-4">
        <div className="min-w-0">
          <h2 className="font-display truncate text-[22px] font-semibold tracking-[-0.02em] text-[#171215]">
            Записи
          </h2>
          <p className="mt-0.5 truncate text-[14px] text-[#999999]">
            {DAY_NAMES[date.getDay()]}, {date.getDate()}{' '}
            {MONTHS_OF[date.getMonth()]} {date.getFullYear()}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Books the day this column is showing. It opens the same panel a
              double-click on the grid does, anchored to that day in the month
              beside it — so the two ways in lead to exactly one form. */}
          <Round
            icon={Add01Icon}
            label="Новая запись"
            onClick={() => onCreate?.(date)}
          />
          <Round
            icon={ArrowLeft01Icon}
            label="Предыдущий день"
            onClick={() => step(-1)}
          />
          <Round
            icon={ArrowRight01Icon}
            label="Следующий день"
            onClick={() => step(1)}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 [scrollbar-color:#999999_transparent] [scrollbar-width:thin]">
        {mine.length === 0 ? (
          <p className="text-[14px] text-[#999999]">На этот день записей нет.</p>
        ) : (
          hours.map(([hour, group]) => (
            <section key={hour} className="pb-5 last:pb-0">
              <div className="flex items-center gap-3 pb-3">
                <span className="shrink-0 text-[13px] text-[#999999] tabular-nums">
                  {hour}:00
                </span>
                <span className="h-px flex-1 bg-[#999999]/20" />
              </div>

              <div className="space-y-3">
                {group.map((block) => (
                  <Booking
                    key={block.id}
                    block={block}
                    color={bookingColor(order.get(block.id))}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}

function Booking({ block, color, onOpen }) {
  const dead = block.status === 'cancelled'

  return (
    // A plain block, not a button. It holds a control of its own now, and a
    // button inside a button is invalid HTML and unreachable by keyboard — and
    // the card's own click had nothing to open in this version of the page
    // anyway, so it was an affordance promising something that never came.
    //
    // The same wash as the calendar's day tiles, for the same reason: at two
    // percent off white the card's edge had to be looked for. See the note in
    // `MonthCalendar`.
    <div className="relative rounded-2xl bg-[#999999]/15 p-5">
      {/* The whole card opens the booking, as one target stretched over it —
          not as a <button> wrapping everything, because the «Диалог» link
          inside would then be a link inside a button: invalid HTML, and
          unreachable by keyboard. This sits underneath instead, and the link
          is lifted above it. Both stay in the tab order, and each does one
          thing. */}
      <button
        type="button"
        onClick={() => onOpen?.(block, color)}
        aria-label={`Открыть запись: ${block.client}`}
        className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#3248F2]"
      />

      {/* The booking's own colour, as a bar across the top of the card — the
          same one the month draws beside its name, so the two views can be read
          against each other without matching up times.

          An inline style, not a class: the colour is chosen at runtime and
          Tailwind can only ship classes it can see written down. */}
      <span
        className="block h-1.5 w-full rounded-full"
        style={{ backgroundColor: color }}
      />

      {/* The status sits opposite the name, in the space the edit pencil used
          to hold. Deliberately *not* tinted by what it says: the colours on this
          screen mark which booking it is, and giving the status a palette of its
          own would put two colour systems on one card, each meaning something
          different. The word is the whole signal.

          `pointer-events-none` on the row so the card's own target underneath
          still receives the press; `relative` so it paints above it. */}
      <div className="pointer-events-none relative mt-4 flex items-start justify-between gap-2">
        <p
          className={`min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[-0.02em] ${
            dead ? 'text-[#999999] line-through' : 'text-[#171215]'
          }`}
        >
          {block.client}
        </p>
        <span className="mt-0.5 shrink-0 rounded-md bg-white px-2 py-1 text-[12px] font-medium text-[#171215]">
          {statusLabel(block.status)}
        </span>
      </div>
      <p className="pointer-events-none relative mt-1 truncate text-[14px] text-[#999999]">
        {block.service}
      </p>

      {/* Dashed, as in the reference — and it earns the difference here: these
          separate three readings of the same booking, where a solid line in
          this product separates two different subjects. */}
      <Row>
        <span className="flex min-w-0 items-center gap-2">
          <HugeiconsIcon
            icon={Clock01Icon}
            size={16}
            strokeWidth={2}
            className="shrink-0 text-[#999999]"
          />
          <span className="truncate text-[14px] text-[#171215] tabular-nums">
            {block.from} – {block.to}
          </span>
        </span>
        <span className="shrink-0 text-[13px] text-[#999999]">
          {formatDuration(block.minutes)}
        </span>
      </Row>

      <Row>
        {/* Where the reference puts its «Meet Link» — the one thing on the card
            you act on rather than read.

            The phone number was here and is gone: reading it off the screen and
            typing it into a phone is work the product can do itself. This goes
            to the conversation instead, which is where the client actually is.
            For now it lands on «Диалоги» as a whole; once that page can open one
            chat, this becomes a link straight to theirs. */}
        <Link
          href="/inbox"
          className="relative z-10 flex min-w-0 items-center gap-2 rounded-lg bg-white px-3 py-2 text-[13px] font-medium text-[#171215] transition-colors outline-none hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-[#3248F2]"
        >
          {/* Label first, icon after it: the icon here is pointing at where
              the button goes, and something that points forward belongs at the
              end of what it is pointing from. In the same near-black as the
              label, so the two read as one control rather than a grey mark
              beside a black word. */}
          <span className="truncate">Диалог</span>
          <HugeiconsIcon
            icon={Chat01Icon}
            size={15}
            strokeWidth={2}
            className="shrink-0 text-[#171215]"
          />
        </Link>

        <span className="shrink-0 text-[14px] font-medium text-[#171215]">
          {formatPrice(block.price)}
        </span>
      </Row>
    </div>
  )
}

function Row({ children }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-dashed border-[#999999]/35 pt-4">
      {children}
    </div>
  )
}

function Round({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // The same 36px as the month's own arrows across the divider: two
      // steppers at two sizes on one row would read as two different controls.
      className="grid h-9 w-9 place-items-center rounded-full border border-[#999999]/25 text-[#171215] transition-colors outline-none hover:bg-[#F6F8FA] focus-visible:ring-2 focus-visible:ring-[#3248F2]"
    >
      <HugeiconsIcon
        icon={icon}
        size={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </button>
  )
}
