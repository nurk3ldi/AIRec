import { useId } from 'react'
import { getLocale, useT } from '../../lib/i18n'
import { CARD_EDGE } from '../card'

/** The ring's geometry, in its own 120-unit box. */
const SIZE = 124
const STROKE = 18
// Two units of air each side so the marker's overhang is not clipped.
const RADIUS = (SIZE - STROKE) / 2 - 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * **Сақинаның түсі — оның орнына қарай**: 25%-ға дейін ақ (`ink`), 50-ге дейін
 * жасыл, 75-ке дейін сары, 100-ге дейін қызыл, ал аралары бір-біріне біркелкі
 * ауысады. Әр түс өз жолағының ортасында таза тұрады (12.5 / 37.5 / 62.5 /
 * 87.5), шекарада екеуі `color-mix`-пен араласады — `ink` тақырыппен бірге
 * ауысатын айнымалы болғандықтан, араластыру CSS-те жасалады, JS-те емес.
 */
const STOPS = [
  [12.5, 'var(--ink)'],
  [37.5, 'var(--ok)'],
  [62.5, '#EAB308'],
  [87.5, 'var(--danger)'],
]
const SEGMENTS = 100
const SEGMENT = CIRCUMFERENCE / SEGMENTS

function colorAt(position) {
  if (position <= STOPS[0][0]) return STOPS[0][1]
  for (let i = 1; i < STOPS.length; i += 1) {
    const [to, toColor] = STOPS[i]
    const [from, fromColor] = STOPS[i - 1]
    if (position <= to) {
      const share = Math.round(((to - position) / (to - from)) * 100)
      return `color-mix(in oklab, ${fromColor} ${share}%, ${toColor})`
    }
  }
  return STOPS[STOPS.length - 1][1]
}

/**
 * How much of the plan's limit is used, as a ring with the percentage in it.
 *
 * **There is no limit behind it yet** — no plans, no metering — so the page
 * passes `0` and the ring is honestly empty; the day usage is counted, only
 * `percent` changes. It is clamped to 0–100, so an overrun draws a full ring
 * rather than wrapping round.
 *
 * **The ring is coloured by how far round it is** — white, then green, yellow
 * and red, blending into each other (see `STOPS`), on an `ink/10` track.
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
  const maskId = `limit${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
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
            {/* The used part: the whole coloured ring, revealed by a mask
                whose own arc is what grows — so the colour at any point is
                fixed by its position, and filling up walks through white,
                green, yellow and red rather than repainting one arc. */}
            <mask id={maskId}>
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="white"
                strokeWidth={STROKE + 2}
                strokeDasharray={CIRCUMFERENCE}
                style={{ strokeDashoffset: CIRCUMFERENCE * (1 - value / 100) }}
                className={`transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none ${
                  value === 0 ? 'opacity-0' : ''
                }`}
              />
            </mask>
            <g mask={`url(#${maskId})`}>
              {Array.from({ length: SEGMENTS }, (_, index) => (
                <circle
                  key={index}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE}
                  // A hair longer than its share so neighbours overlap and no
                  // seam of the track shows between them.
                  strokeDasharray={`${SEGMENT + 0.4} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-index * SEGMENT}
                  style={{ stroke: colorAt(index + 0.5) }}
                />
              ))}
            </g>
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
