import { useRef } from 'react'

/**
 * Six single-character boxes for a numeric confirmation code.
 *
 * Typing advances to the next box, Backspace in an empty box steps back, and a
 * paste anywhere fills the whole row — people copy these codes out of an email
 * far more often than they retype them.
 *
 * Shared by the password-reset page and the profile's email-change step; the
 * value is a plain string so callers just check `code.length === 6`.
 */
export default function OtpInput({ value, onChange, hasError, autoFocus }) {
  const inputRefs = useRef([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')

  const handleChange = (index) => (event) => {
    const raw = event.target.value.replace(/\D/g, '')
    const next = value.split('')
    while (next.length < 6) next.push('')

    if (!raw) {
      next[index] = ''
      onChange(next.join(''))
      return
    }

    next[index] = raw.slice(-1)
    onChange(next.join(''))
    if (index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index) => (event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    event.preventDefault()
    onChange(pasted)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  // Square boxes, and the gap is what makes them fit: six 48px cells plus five
  // 6px gaps is 318px inside a 328px column, so the row never has to shrink a
  // cell to squeeze in.
  return (
    <div className="flex justify-center gap-1.5" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          autoFocus={autoFocus && index === 0}
          value={digit}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          // The same three-step ring the text fields wear, so a box here reads
          // as the same kind of object — resting, hover, focus with a halo. The
          // edge is a `box-shadow`, so focus thickens it without the box
          // growing and shunting the other five along the row.
          // The ring is the only thing that moves, so it is the only thing named
          // — `transition-all` here put every other property on the transition
          // for nothing.
          className={`h-12 w-12 rounded-md bg-surface text-center text-[20px] font-semibold text-ink outline-none transition-shadow duration-150 ${
            hasError
              ? 'shadow-[0_0_0_1px_var(--color-danger)] focus:shadow-[0_0_0_1px_var(--color-danger),0_0_0_4px_var(--color-field-halo)]'
              : 'shadow-[0_0_0_1px_var(--color-field)] hover:shadow-[0_0_0_1px_var(--color-field-hover)] focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)]'
          }`}
        />
      ))}
    </div>
  )
}
