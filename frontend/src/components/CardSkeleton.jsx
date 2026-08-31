import Skeleton, { SkeletonRegion } from './Skeleton'

/**
 * A card before the row behind it has arrived.
 *
 * **One component for every card that loads, not one each.** What a reader needs from a
 * placeholder is where the block is, how tall it is and roughly what is in it —
 * a heading, a control at the far end, and some number of labelled rows. That
 * is true of all four cards here, and a pixel-exact copy of each would be four
 * more files to keep in step with the cards they imitate, silently wrong the
 * first time one of them is edited.
 *
 * The two things it does copy exactly are the ones that would otherwise move
 * when the answer lands: the card's own padding and radius, and the height of a
 * row. `strip` is the one shape distinctive enough to be worth drawing — the
 * week on «График работы», which is unlike anything else on the page.
 *
 * Row widths are fixed rather than random. A placeholder that reshuffles on
 * every render is a placeholder that looks like it is doing something, and it
 * is not.
 */

/** How wide each row's value bar is, so the block reads as text and not a wall. */
const WIDTHS = ['w-[70%]', 'w-[52%]', 'w-[61%]', 'w-[45%]', 'w-[66%]', 'w-[57%]']

export default function CardSkeleton({
  rows = 4,
  strip = false,
  label,
  visible = true,
  className = '',
}) {
  return (
    // **The card's ground is not part of the fade.** Where the card is, is true
    // from the first frame; only what is written on it is still unknown. Fading
    // the whole thing would leave a hole in the layout for as long as the delay
    // lasts, which is the flicker this exists to avoid.
    <div
      className={`flex flex-col rounded-2xl bg-surface-raised p-4 ${className}`}
    >
      <SkeletonRegion
        label={label}
        visible={visible}
        className="flex min-h-0 flex-1 flex-col"
      >
      {/* The heading and the control at the far end — the row that is in the
          same place on every card here. */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <Skeleton className="h-4 w-[40%]" />
        <Skeleton className="h-4 w-16" />
      </div>

      {strip && (
        <div className="mt-4 flex gap-1">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-10 flex-1 rounded-lg" />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            {/* The label above the value, at the label's own size — the shape
                every field on this page has. */}
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className={`h-4 ${WIDTHS[index % WIDTHS.length]}`} />
          </div>
        ))}
      </div>
      </SkeletonRegion>
    </div>
  )
}
