/**
 * One booking in the grid.
 *
 * The reference's neutral card, taken as written: white, a hairline border,
 * the name in near-black above a muted time. Tinting every block by status was
 * tried and dropped — a week with thirty bookings became thirty coloured
 * rectangles, and the calendar started shouting instead of showing.
 *
 * The 2px top and bottom edges are black and stay black. They were coloured by
 * status for a while, and that put a different hue on every block for a
 * distinction the owner reads in the panel anyway; a fixed edge lets those two
 * lines do the one job that matters in the grid — marking exactly where the
 * booking starts and ends.
 *
 * Nothing about the block changes when it is opened, either: the panel sliding
 * in is the feedback, and re-colouring the block on top of that was a second
 * announcement of the same thing. `selected` survives for `aria-pressed` only,
 * so the state is still reported to a screen reader.
 *
 * The sides are declared separately from the top and bottom (`border-x` vs
 * `border-y`) rather than as an all-round border with overrides: that way the
 * neutral hairline and the black edge never compete over which class wins.
 */
export default function AppointmentBlock({ block, selected, onSelect }) {
  const dead = block.status === 'cancelled'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(block)}
      aria-pressed={selected}
      // `overflow-hidden` is what makes a fifteen-minute booking survive: it
      // shows as much of the three lines as its height allows and clips the
      // rest, rather than spilling over the booking below it.
      //
      // `flex flex-col justify-start` on purpose: a <button> centres its own
      // contents vertically, so in a tall block the name and the time floated
      // to the middle instead of starting at the top edge where the booking
      // actually begins.
      // `z-10` puts the block above the "now" line, so its opaque body cuts the
      // line where it crosses and lets it continue on the other side.
      className="absolute z-10 flex flex-col items-stretch justify-start overflow-hidden rounded-lg border-x border-y-2 border-x-[#999999]/30 border-y-[#171215] bg-white px-2.5 py-2 text-left outline-none transition-shadow hover:shadow-[0_2px_10px_rgba(23,18,21,0.10)]"
      style={{
        top: block.top,
        height: block.height,
        left: block.left,
        width: block.width,
      }}
    >
      {/* Two things only: who, and when. The service and the price were here
          and are gone — at a glance the owner is looking for a person and an
          hour, and everything else is a click away in the panel.

          The name wraps to a second line rather than being cut off mid-word:
          in a narrow column half the names would end in an ellipsis, and a
          half-read name is no use for recognising a client. Two lines is the
          ceiling, so it can never push the time out of the block. */}
      <p
        className={`line-clamp-2 shrink-0 text-[18px] leading-tight font-bold tracking-[-0.02em] break-words ${
          dead ? 'text-[#999999] line-through' : 'text-[#171215]'
        }`}
      >
        {block.client}
      </p>
      {/* Always broken over two lines, not left to wrap when it happens to be
          too wide: a column that wraps on Monday and not on Tuesday makes two
          identical bookings look like different things. */}
      <p className="mt-1.5 shrink-0 text-[15px] leading-tight text-[#999999]">
        {block.from} –<br />
        {block.to}
      </p>
    </button>
  )
}
