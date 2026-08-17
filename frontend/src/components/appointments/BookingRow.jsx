/**
 * One booking as a line in the side column.
 *
 * Shared by the "what's next" panel and the search results so that a booking
 * looks like the same object wherever it is listed — a client found by name and
 * a client due in an hour are the same row, and only the reason for showing
 * them differs.
 *
 * The time sits in a fixed-width column so a run of rows reads down as a
 * schedule rather than as ragged text; the date goes under it, on the same
 * baseline as the service, so the two muted facts line up together.
 */
export default function BookingRow({ block, date, trailing, onSelect }) {
  const dead = block.status === 'cancelled'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(block)}
      className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-[#F6F8FA]"
    >
      <span className="w-[46px] shrink-0 pt-px">
        <span className="block text-[13px] text-[#999999] tabular-nums">
          {block.from}
        </span>
        {date && (
          <span className="mt-0.5 block text-[12px] text-[#999999]">{date}</span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[14px] font-medium ${
            dead ? 'text-[#999999] line-through' : 'text-[#171215]'
          }`}
        >
          {block.client}
        </span>
        <span className="block truncate text-[12px] text-[#999999]">
          {block.service}
        </span>
      </span>

      {trailing && (
        <span className="shrink-0 pt-px text-[12px] text-[#999999]">
          {trailing}
        </span>
      )}
    </button>
  )
}
