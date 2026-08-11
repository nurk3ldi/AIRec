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

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
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
          className={`h-14 w-11 rounded-lg border bg-white text-center text-[20px] font-semibold text-[#171215] outline-none transition-colors focus:border-[#3248F2] ${hasError ? 'border-[#DC2626]' : 'border-[#999999]/35'}`}
        />
      ))}
    </div>
  )
}
