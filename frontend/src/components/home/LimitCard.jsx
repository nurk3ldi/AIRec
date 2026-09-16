import { useT } from '../../lib/i18n'
import { CARD_EDGE } from '../card'

/** The ring's geometry, in its own 120-unit box. */
const SIZE = 120
const STROKE = 26
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * How much of the plan's limit is used, as a ring with the percentage in it.
 *
 * **There is no limit behind it yet** — no plans, no metering — so the page
 * passes `0` and the ring is honestly empty; the day usage is counted, only
 * `percent` changes. It is clamped to 0–100, so an overrun draws a full ring
 * rather than wrapping round.
 *
 * **One value, so one colour**: a thick ring, ink on an `ink/10` track, the same
 * pair every quiet control here uses. Status colours stay out of it until a
 * limit exists that can actually be close to running out.
 */
export default function LimitCard({ percent = 0, className = '' }) {
  const t = useT()
  const value = Math.min(100, Math.max(0, Math.round(percent)))

  return (
    <section
      className={`${CARD_EDGE} flex flex-col items-center overflow-hidden p-4 ${className}`}
    >
      <h2 className="self-start text-[15px] font-semibold text-ink">{t('home.limit')}</h2>

      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <figure
          className="relative aspect-square h-[85%] max-h-full max-w-full"
          role="img"
          aria-label={`${t('home.limit')}: ${value}%`}
        >
          {/* Turned a quarter clockwise, so the arc starts at the bottom and
              fills through the left side upwards — the reference's direction. */}
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full rotate-90">
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-ink/10"
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - value / 100)}
              // Flat ends, as in the reference: a thick round cap would
              // overshoot the value by half the ring's width at each end.
              className="stroke-ink transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
            />
          </svg>
          <figcaption className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[26px] leading-none font-bold tracking-[-0.02em] text-ink tabular-nums">
              {value}%
            </span>
            <span className="mt-1 text-[12px] text-muted">{t('home.limitUsed')}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
