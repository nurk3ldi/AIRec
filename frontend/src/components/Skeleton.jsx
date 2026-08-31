/**
 * The shape of what is coming, drawn while it is still on its way.
 *
 * **A skeleton, not a spinner**, wherever the result has a shape the screen
 * already knows: a spinner says "wait" and takes the layout with it, so the
 * page assembles itself under the reader the moment the answer lands. A
 * skeleton says "this is what is coming and where it will be", and because it
 * occupies the same box, nothing moves when it is replaced. A spinner is still
 * right for an action whose result has no shape — a save, a sign-in.
 *
 * **And a skeleton, not the empty state.** This is the failure that made it
 * worth building: with no bookings loaded yet, `/appointments` said «Сейчас
 * никого» and `/assistant` drew a business with no name. Both are claims, and
 * both were false — the screen had not asked yet. An empty state is an answer;
 * a skeleton is the absence of one.
 *
 * **It pulses; it does not shimmer.** A shimmer is a gradient travelling across
 * the surface — a large object moving on every placeholder on screen at once,
 * which is exactly what Apple's reduced-motion guidance asks you not to build,
 * and what a loop near 0.2 Hz feels like. Tailwind's `animate-pulse` is a 2s
 * opacity cycle: no travel, half a hertz, and nothing to hand-roll.
 *
 * Under `prefers-reduced-motion` the pulse stops and the bars stay. Reduced
 * motion means gentler, never nothing — a still skeleton is still the answer to
 * "what is happening", and it is the only one a reader has at that moment.
 *
 * **The delay hides the bars, not the block.** This was built the other way
 * round first and it flickered: for the first 150ms the screen drew the real
 * component with no data in it — «Сейчас никого», a business with no name —
 * then the skeleton, then the answer. Three states inside a third of a second,
 * two of them false. The block is drawn from the first frame so the layout is
 * settled and nothing claims anything; only the pulsing bars inside it wait,
 * and they fade in rather than appear.
 */
export default function Skeleton({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-ink/8 motion-reduce:animate-none ${className}`}
    />
  )
}

/**
 * Wraps a screen's placeholders so assistive technology is told once that the
 * region is loading, rather than being read a list of empty boxes.
 *
 * `aria-busy` is on the region and the bars themselves are `aria-hidden`: the
 * status is one fact about the whole block, not one per bar.
 */
export function SkeletonRegion({
  label,
  visible = true,
  className = '',
  children,
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}
