/**
 * Where the eyes and the screen sit on `/ai.png`, measured off the image
 * itself (1274×1234) and kept as fractions so they follow the robot at any
 * size. `ai-body.png` is the same picture with the eyes painted out, and the
 * eyes are drawn back over it here, where they can move.
 */
const IMAGE = { width: 1274, height: 1234 }
const EYE = { width: 44, height: 94 }
const LEFT_EYE_X = 513.5
const RIGHT_EYE_X = 751
const EYE_Y = 628.5
const SCREEN = { x: 632, y: 636 }

const pct = (value, of) => `${(value / of) * 100}%`

/**
 * The assistant's robot, alive: `state` is one of
 *
 * - **`on`** — the eyes are open, glance left and right on a slow loop and
 *   blink every few seconds (`animate-robot-look`, `animate-robot-blink`).
 * - **`off`** — switched off: the eyes shut to a line and go out like a
 *   screen, and the white shell dims to grey, the way a device looks
 *   powered down.
 * - **`limit`** — the limit is used up: the eyes go, and a spinner turns in
 *   the middle of the screen instead.
 *
 * **Photograph, not a redrawing.** The body is the original render with its
 * eyes removed, so the robot looks exactly as it did; only what moves is drawn
 * by the page. Everything that changes is `scale`, `translate`, `opacity` and
 * `filter`, and under reduced motion the eyes stop travelling and blinking
 * while the switch-off still fades.
 */
export default function RobotFace({ state = 'on', className = '' }) {
  const awake = state === 'on'

  return (
    <div
      className={`relative aspect-[1274/1234] ${className}`}
      aria-hidden="true"
    >
      <img
        src="/ai-body.png"
        alt=""
        draggable="false"
        className={`absolute inset-0 h-full w-full select-none transition-[filter] duration-700 ease-out ${
          state === 'off' ? 'brightness-[0.42] grayscale' : ''
        }`}
      />

      {/* The eyes, as one group so they look together. Going out is a CRT
          switch-off: the group flattens to a line, then the line fades. */}
      <div
        className={`absolute inset-0 transition-[scale,opacity] ease-in ${
          awake
            ? 'scale-y-100 opacity-100 duration-300'
            : 'scale-y-[0.04] opacity-0 duration-200 [transition-delay:0ms,150ms]'
        }`}
        style={{ transformOrigin: `${pct(SCREEN.x, IMAGE.width)} ${pct(EYE_Y, IMAGE.height)}` }}
      >
        <div className={`absolute inset-0 ${awake ? 'animate-robot-look' : ''}`}>
          {[LEFT_EYE_X, RIGHT_EYE_X].map((x) => (
            <span
              key={x}
              className={`absolute rounded-full bg-white shadow-[0_0_4px_1px_rgba(255,255,255,0.75)] ${
                awake ? 'animate-robot-blink' : ''
              }`}
              style={{
                left: pct(x - EYE.width / 2, IMAGE.width),
                top: pct(EYE_Y - EYE.height / 2, IMAGE.height),
                width: pct(EYE.width, IMAGE.width),
                height: pct(EYE.height, IMAGE.height),
              }}
            />
          ))}
        </div>
      </div>

      {/* Limit reached: a spinner where the eyes were. */}
      <svg
        viewBox="0 0 24 24"
        className={`absolute animate-spin text-white drop-shadow-[0_0_3px_rgba(255,255,255,0.7)] transition-opacity duration-300 ${
          state === 'limit' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          left: pct(SCREEN.x - 90, IMAGE.width),
          top: pct(SCREEN.y - 90, IMAGE.height),
          width: pct(180, IMAGE.width),
          height: pct(180, IMAGE.height),
        }}
      >
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
        <path
          d="M12 3a9 9 0 0 1 9 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
