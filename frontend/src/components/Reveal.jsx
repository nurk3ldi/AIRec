/**
 * A block that opens and closes without anybody having to know how tall it is.
 *
 * **The one exception to this project's transform-and-opacity rule**, and the
 * same one `WeekStrip` already takes: `grid-template-rows: 0fr → 1fr` animates
 * to *content*, which is the only way to open something whose height is a
 * sentence in a language nobody has picked yet, or a list nobody has filled
 * yet. Measuring it first is the alternative, and a measurement is a number
 * that goes stale.
 *
 * **It stays mounted, which is what makes it work in both directions.** A CSS
 * animation can play on the way in; nothing can play on the way out of a node
 * React has already removed. So the caller passes `open` rather than rendering
 * this conditionally, and the transition runs each way from wherever it is.
 *
 * `axis="x"` is the same trick on columns — a control that a row opens up to
 * let in, rather than one that appears inside a row that jumps sideways to make
 * space for it.
 *
 * Why this is worth doing at all, in Apple's terms: a block that appears in one
 * frame does not say where it came from, and the layout under it moves before
 * the eye has found the thing that moved it. Opening says both — this is new,
 * and it is what pushed everything down.
 */
export default function Reveal({
  open,
  axis = 'y',
  className = '',
  children,
}) {
  const track =
    axis === 'x'
      ? open
        ? 'grid-cols-[1fr]'
        : 'grid-cols-[0fr]'
      : open
        ? 'grid-rows-[1fr]'
        : 'grid-rows-[0fr]'

  return (
    <div
      className={`grid transition-[grid-template-rows,grid-template-columns,opacity] duration-200 ease-out motion-reduce:transition-none ${track} ${
        open ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      {/* What the collapsed track clips against. Without it the content keeps
          its own height and the track has nothing to squeeze. */}
      <div className="min-h-0 min-w-0 overflow-hidden">{children}</div>
    </div>
  )
}
