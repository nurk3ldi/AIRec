import { getLocale, useT } from '../../lib/i18n'
import { CARD_EDGE } from '../card'

/** The ring's geometry, in its own 120-unit box. */
const SIZE = 124
const STROKE = 18
// Two units of air each side so the marker's overhang is not clipped.
const RADIUS = (SIZE - STROKE) / 2 - 2
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
/** «через 3 часа» / «через 20 минут» in the reader's language, the largest unit. */
function untilLabel(iso) {
  const seconds = Math.max(0, (Date.parse(iso) - Date.now()) / 1000)
  const format = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' })
  if (seconds < 3600) return format.format(Math.max(1, Math.ceil(seconds / 60)), 'minute')
  if (seconds < 86400) return format.format(Math.ceil(seconds / 3600), 'hour')
  return format.format(Math.ceil(seconds / 86400), 'day')
}

export default function LimitCard({ percent = 0, resetAt = null, className = '' }) {
  const t = useT()
  const value = Math.min(100, Math.max(0, Math.round(percent)))
  // Where the used arc ends, in the SVG's own (unrotated) angle: the dash
  // starts at 0 and runs with increasing angle, so the marker sits there.
  const angle = (2 * Math.PI * value) / 100
  const tick = (distance) => ({
    x: SIZE / 2 + distance * Math.cos(angle),
    y: SIZE / 2 + distance * Math.sin(angle),
  })
  const tickFrom = tick(RADIUS - STROKE / 2 - 2)
  const tickTo = tick(RADIUS + STROKE / 2 + 2)

  return (
    <section
      className={`${CARD_EDGE} flex flex-col items-center overflow-hidden p-4 ${className}`}
    >
      {/* The name, and against the right edge what matters about the limit
          now: used up, when it resets (or plainly that it is used up, when no
          reset time is known); otherwise how much is left. */}
      <div className="flex w-full items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{t('home.limit')}</h2>
        <p
          className="min-w-0 truncate text-[13px] font-medium text-ink"
        >
          {value >= 100
            ? resetAt
              ? t('home.limitReset', { when: untilLabel(resetAt) })
              : t('home.limitSpent')
            : t('home.limitLeft', { value: 100 - value })}
        </p>
      </div>

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
              // overshoot the value by half the ring's width at each end. At
              // 0% the zero-length dash still antialiases into a hairline at
              // the bottom, so nothing used draws nothing.
              className={`stroke-ink transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none ${
                value === 0 ? 'opacity-0' : ''
              }`}
            />
            {/* The marker line across the ring where the used part ends, a
                little past both edges — the reference's tick. Drawn at 0% too,
                where it is the one thing saying where counting starts. */}
            <line
              x1={tickFrom.x}
              y1={tickFrom.y}
              x2={tickTo.x}
              y2={tickTo.y}
              strokeWidth={1.5}
              className="stroke-ink"
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
