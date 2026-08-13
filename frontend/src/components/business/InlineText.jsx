import { useRef, useState } from 'react'

/**
 * A value that turns into an input when you click it, and saves when you leave.
 *
 * There is no pencil and no Save button: the value *is* the control, and the
 * tinted hover is what says so. Both of the fiddly parts are handled here so
 * every place that edits text in place behaves identically —
 *
 *   • Enter just blurs, so "press Enter" and "click away" take the same path
 *     rather than being two saving code paths that can drift apart;
 *   • Escape sets a flag *before* the input unmounts, because the blur that
 *     follows would otherwise save the very edit that was being abandoned.
 */
export default function InlineText({
  value,
  onSave,
  ariaLabel,
  placeholder = 'Не указано',
  className = '',
  required = false,
  // `format` is for reading, `parse` is for writing — a price shows as
  // "6 000 ₸" but is edited and stored as 6000. `parse` may throw to reject
  // the input, which is how a non-numeric price is refused before it is sent.
  format,
  parse,
  inputMode,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const skipSave = useRef(false)

  const startEditing = () => {
    setDraft(value ?? '')
    setError('')
    setIsEditing(true)
  }

  const commit = async () => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }

    const raw = String(draft).trim()
    let next
    if (parse) {
      try {
        next = parse(raw)
      } catch (err) {
        setError(err.message)
        return
      }
    } else {
      if (required && !raw) {
        setError('Заполните это поле.')
        return
      }
      // Empty clears the field rather than storing "" — `null` is what the
      // backend reads as "this is not set".
      next = raw || null
    }

    if (next === (value ?? null)) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await onSave(next)
      setIsEditing(false)
    } catch (err) {
      // Stays open on failure: closing would throw away what was typed.
      setError(err.fields?.[0]?.message || err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return (
      <span className="block">
        <input
          type="text"
          inputMode={inputMode}
          value={draft}
          disabled={isSaving}
          onChange={(event) => {
            setDraft(event.target.value)
            setError('')
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              skipSave.current = true
              setIsEditing(false)
            }
          }}
          autoFocus
          className={`-mx-2 w-[calc(100%+1rem)] rounded-lg border bg-white px-2 py-1 outline-none transition-colors focus:border-[#3248F2] disabled:opacity-60 ${
            error ? 'border-[#DC2626]' : 'border-[#999999]/35'
          } ${className}`}
        />
        {error && (
          <span role="alert" className="mt-1.5 block text-[13px] text-[#DC2626]">
            {error}
          </span>
        )}
      </span>
    )
  }

  // Checked for presence rather than truthiness: a price of 0 is a real value,
  // and treating it as empty would show "Не указано" for a free service.
  const hasValue = value !== null && value !== undefined && value !== ''

  return (
    <button
      type="button"
      onClick={startEditing}
      aria-label={ariaLabel}
      className={`-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left break-words outline-none transition-colors hover:bg-[#F6F8FA] focus-visible:bg-[#F6F8FA] ${
        hasValue ? '' : 'font-medium text-[#999999]'
      } ${className}`}
    >
      {hasValue ? (format ? format(value) : value) : placeholder}
    </button>
  )
}
