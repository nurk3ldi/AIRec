/**
 * An on/off switch that slides, the way iOS draws one: a pill track with a
 * round thumb that travels to the side it means. `role="switch"` with
 * `aria-checked`, so it is announced as the control it looks like. On is the
 * solid ink track with a surface thumb (white on black, black on white), off
 * is the quiet `ink/15` track.
 *
 * `size="sm"` is the one a list row carries — 36×20 instead of 44×26, so it
 * sits under a line of 12px text without making the row taller. It keeps the
 * 44pt touch area through `touch-target`.
 */
const SIZES = {
  md: { track: 'h-[26px] w-[44px]', thumb: 'top-[3px] left-[3px] h-5 w-5', on: 'translate-x-[18px]' },
  sm: { track: 'h-5 w-9', thumb: 'top-[2px] left-[2px] h-4 w-4', on: 'translate-x-4' },
}

export default function Switch({ checked, disabled, onChange, label, size = 'md' }) {
  const shape = SIZES[size]
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`touch-target relative shrink-0 rounded-full outline-none transition-[background-color,scale] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ink/30 active:scale-95 disabled:opacity-50 ${shape.track} ${
        checked ? 'bg-ink' : 'bg-ink/15'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[translate,background-color] duration-200 ease-out motion-reduce:transition-none ${shape.thumb} ${
          checked ? `${shape.on} bg-surface` : 'translate-x-0 bg-white'
        }`}
      />
    </button>
  )
}
