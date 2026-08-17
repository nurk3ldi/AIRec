/**
 * One booking in the grid.
 *
 * The shape is the reference's: a rounded rectangle, a hairline border and a
 * barely-there fill in one hue, the client's name in that hue above the time.
 * What differs is what the hue *means* — the reference colours by category, and
 * a receptionist's calendar has no categories worth five colours. Here it is
 * the status, which is the one thing on this screen the owner acts on.
 *
 * Classes are written out per status rather than built from a variable: Tailwind
 * only ships the classes it can see spelled out in the source.
 */
const STATUS_STYLE = {
  // Booked by the assistant, not yet looked at — the one that wants attention,
  // and so the only one that gets the accent.
  pending: {
    box: 'border-[#3248F2]/35 bg-[#3248F2]/[0.06]',
    title: 'text-[#3248F2]',
    meta: 'text-[#3248F2]/70',
    ring: 'ring-[#3248F2]/50',
  },
  confirmed: {
    box: 'border-[#16A34A]/35 bg-[#16A34A]/[0.06]',
    title: 'text-[#16A34A]',
    meta: 'text-[#16A34A]/70',
    ring: 'ring-[#16A34A]/50',
  },
  completed: {
    box: 'border-[#999999]/30 bg-[#999999]/[0.08]',
    title: 'text-[#171215]',
    meta: 'text-[#999999]',
    ring: 'ring-[#171215]/35',
  },
  no_show: {
    box: 'border-[#DC2626]/35 bg-[#DC2626]/[0.06]',
    title: 'text-[#DC2626]',
    meta: 'text-[#DC2626]/70',
    ring: 'ring-[#DC2626]/50',
  },
  // No fill at all: the time is free again, and a tinted block would keep
  // claiming it.
  cancelled: {
    box: 'border-[#999999]/30 bg-transparent',
    title: 'text-[#999999] line-through',
    meta: 'text-[#999999]',
    ring: 'ring-[#999999]/50',
  },
}

export default function AppointmentBlock({ block, selected, onSelect }) {
  const style = STATUS_STYLE[block.status] ?? STATUS_STYLE.completed

  return (
    <button
      type="button"
      onClick={() => onSelect?.(block)}
      aria-pressed={selected}
      // `overflow-hidden` is what makes a fifteen-minute booking survive: it
      // shows as much of the three lines as its height allows and clips the
      // rest, rather than spilling over the booking below it.
      //
      // The open one is marked by a ring in its own hue rather than by a
      // different colour: it is the same booking, being looked at.
      className={`absolute overflow-hidden rounded-lg border px-2 py-1.5 text-left outline-none transition-shadow hover:shadow-[0_2px_10px_rgba(23,18,21,0.10)] ${style.box} ${
        selected ? `ring-2 ${style.ring}` : ''
      }`}
      style={{
        top: block.top,
        height: block.height,
        left: block.left,
        width: block.width,
      }}
    >
      <p className={`truncate text-[13px] leading-tight font-semibold ${style.title}`}>
        {block.client}
      </p>
      <p className={`mt-1 truncate text-[11px] leading-tight ${style.meta}`}>
        {block.range}
      </p>
      {/* Service and price share a line rather than taking one each: four
          facts still fit inside a half-hour block that way, and the price is
          a short number that would waste a whole row of its own. */}
      <div
        className={`mt-0.5 flex items-baseline justify-between gap-2 text-[11px] leading-tight ${style.meta}`}
      >
        <span className="truncate">{block.service}</span>
        <span className="shrink-0 tabular-nums">
          {block.price.toLocaleString('ru-RU')} ₸
        </span>
      </div>
    </button>
  )
}
