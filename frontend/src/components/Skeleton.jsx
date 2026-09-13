import { useState } from 'react'

/**
 * How long one breath of a placeholder takes, in ms. Must equal the duration
 * of `animate-placeholder` in `globals.css`, or the shared phase below drifts.
 */
const BREATH_MS = 2000

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
 * **It breathes; it does not shimmer.** A shimmer is a gradient travelling
 * across the surface — a large object moving on every placeholder on screen at
 * once, which is exactly what Apple's reduced-motion guidance asks you not to
 * build, and what a loop near 0.2 Hz feels like. `animate-placeholder` (in
 * `globals.css`) is a 2s opacity cycle between 100% and 55% on an even
 * ease-in-out — Apple's redacted-content breath, where Tailwind's
 * `animate-pulse` it replaced dropped to 50% on a sharper curve and read as a
 * blink. All bars share its phase, and the fill is `--placeholder`, Apple's
 * system grey.
 *
 * Under `prefers-reduced-motion` the pulse stops and the bars stay. Reduced
 * motion means gentler, never nothing — a still skeleton is still the answer to
 * "what is happening", and it is the only one a reader has at that moment.
 *
 * **The delay hides the bars, not the block.** This was built the other way
 * round first and it flickered: for the first fraction of a second the screen
 * drew the real component with no data in it — «Сейчас никого», a business with
 * no name — then the skeleton, then the answer. Three states inside a third of
 * a second, two of them false. The block is drawn from the first frame so the
 * layout is settled and nothing claims anything; only the pulsing bars inside
 * it wait, and they fade in rather than appear.
 *
 * **And once they are up they stay up** — see `useSkeleton` for both halves of
 * that. A placeholder that appears and is taken away inside a blink is the
 * flash this whole file exists to avoid, and the delay alone never prevented
 * it: it decided whether the bars appeared, and nothing decided how long they
 * lasted.
 */
export default function Skeleton({ className = '', style }) {
  // **The default radius and fill apply only when the caller named none.** They
  // were baked into the string, and a class the caller added could not win:
  // two utilities for one property are decided by their order in the built
  // stylesheet, not in the attribute, and `.rounded-md` is emitted after
  // `.rounded-2xl` and `.rounded-full`. So every `rounded-full` avatar
  // placeholder in the app was drawn as a 6px-cornered square, and the rail's
  // `bg-rail-ink/10` never replaced `bg-ink/8`. Found on 2026-09-13 while
  // shaping `/inbox`'s thread placeholder after the bubbles it stands for.
  const names = className.split(/\s+/)
  const radius = names.some((name) => name.startsWith('rounded')) ? '' : 'rounded-md'
  // `bg-placeholder` — Apple's system fill, see `--placeholder` in globals.css.
  const fill = names.some((name) => name.startsWith('bg-')) ? '' : 'bg-placeholder'

  // **Every placeholder on screen breathes in one phase.** A CSS animation
  // starts when its element mounts, so the table's bars, the thread's bubbles
  // and a photo's frame — mounted at different moments — each dimmed on its
  // own beat, and the screen shimmered like a set of unrelated lights. Apple's
  // redacted content breathes as one surface. A negative delay equal to how
  // far into a breath the page clock already is puts each new bar on the
  // shared beat from its first frame. Read once, at mount, in a state
  // initialiser: a re-render must not restart it.
  const [phase] = useState(() =>
    typeof performance === 'undefined' ? 0 : -(performance.now() % BREATH_MS),
  )

  return (
    <div
      aria-hidden="true"
      style={{ animationDelay: `${phase}ms`, ...style }}
      className={`animate-placeholder ${radius} ${fill} ${className}`}
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
