import { useEffect, useState } from 'react'
import { FIELD } from '../controls'

const pad = (number) => String(number).padStart(2, '0')

/**
 * A clock field you type into. No list, no picker, no menu.
 *
 * **Three shapes were tried and this is the one that fits.** A menu of every
 * quarter hour was a list rather than a clock, and ninety-six identical rows to
 * find one of them. A native `<input type="time">` behaves perfectly but drops
 * a sheet the *browser* draws — white, with a blue bar through it, in a product
 * that has no blue. A hand-built pair of scrolling columns fixed the colours
 * and kept the wrong idea: choosing a time from a list is slower than saying
 * it, and everybody already knows how to say it.
 *
 * So: four digits. `1430` becomes `14:30` as it is typed, and the colon is put
 * in rather than asked for.
 *
 * The draft is held here rather than pushed up on every keystroke, because a
 * half-typed `14` is not a time and the form above must not see one. The parent
 * hears a value when four digits are in, or when focus leaves — and `useEffect`
 * pulls the prop back down for the case that matters: the end field, which is
 * re-proposed whenever the start or the service moves.
 */
export default function TimeField({ value, onChange, label, compact }) {
  const [draft, setDraft] = useState(value ?? '')

  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  /**
   * However many digits are in, read as a time.
   *
   * **The two halves are padded in opposite directions, and that is the whole
   * of it.** A lone `9` is nine o'clock — the hour is padded on the *left*,
   * because 9 is the hour itself. A lone `3` after the hour is half past — the
   * minute is padded on the *right*, because 3 there is the tens digit. Padding
   * the whole string one way turned `9` into `90` and then, clamped, into
   * 23:00.
   *
   * Clamped rather than rejected: `99` was a slip on the way to something, and
   * refusing the keystroke leaves the caret stuck with no explanation.
   */
  const settle = (digits) => {
    const hours = digits.length === 1 ? `0${digits}` : digits.slice(0, 2)
    const minutes = digits.length <= 2 ? '00' : digits.slice(2).padEnd(2, '0')
    return `${pad(Math.min(23, Number(hours)))}:${pad(Math.min(59, Number(minutes)))}`
  }

  const type = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    // The colon appears as soon as there is a minute to put after it, so the
    // field reads as a time from the third keystroke rather than at the end.
    setDraft(
      digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits,
    )

    if (digits.length === 4) onChange(settle(digits))
    else if (digits.length === 0) onChange('')
  }

  const finish = () => {
    const digits = draft.replace(/\D/g, '')
    if (!digits) {
      setDraft('')
      onChange('')
      return
    }
    // `9` on its own means 09:00, not nine of something unfinished — leaving a
    // stray digit in the box would be the field keeping a value the form does
    // not have.
    const next = settle(digits)
    setDraft(next)
    onChange(next)
  }

  return (
    <input
      value={draft}
      onChange={(event) => type(event.target.value)}
      onBlur={finish}
      // `numeric`, not `tel`: the phone keypad is right, the telephone one adds
      // `*` and `#` for a field that takes neither.
      inputMode="numeric"
      // Five, because the colon this puts in counts toward it.
      maxLength={5}
      // The label rather than `--:--`: the two fields are «Начало» and «Конец»,
      // and a pair of identical dash patterns said which *shape* was wanted
      // while leaving which of the two ends it was to be worked out.
      placeholder={label}
      aria-label={label}
      autoComplete="off"
      // **Half the row, because the other half is the other clock.** It was a
      // fixed 86px while it shared a line with a date field twice its length,
      // where splitting evenly would have given four characters the same room
      // as eighteen. The date has its own line now and the two clocks have
      // theirs, so an even split is exactly right: the pair is one span, and
      // one end of it is not more important than the other.
      // `compact` is for the assistant's schedule card, where four of these
      // share a 350px column. The 16px below `sm` is not part of it and must
      // not be: iOS magnifies the page when a smaller field takes focus and
      // never magnifies back.
      className={`${FIELD} min-w-0 flex-1 text-center font-display text-[16px] font-medium ${
        compact ? 'h-8 px-1.5 sm:text-[13px]' : 'h-9 px-2.5 sm:text-[14px]'
      }`}
    />
  )
}
