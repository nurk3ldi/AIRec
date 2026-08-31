/**
 * The two field shapes the assistant's cards share.
 *
 * They were written inside `BusinessCard` and are here because a second card
 * now needs them — two copies of a labelled input are two inputs that agree
 * until one of them is restyled.
 */

/**
 * One labelled text field.
 *
 * The label sits above rather than inside: every one of these carries a value,
 * so there is no empty state a placeholder could stand in for, and a label that
 * vanishes the moment the field is filled is a label you have to remember.
 *
 * **`readOnly`, never `disabled`.** Outside edit mode the value *is* the point
 * of the field, and a disabled input dims the very thing you came to read. Out
 * of the tab order all the same, and without the hover and focus rings — there
 * is nothing to do in it, so nothing should offer.
 */
export function Field({ label, value, onChange, type = 'text', readOnly }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        // 16px below `sm`, like every field in this app: iOS magnifies the page
        // when a smaller one takes focus and never magnifies back.
        className={`h-8 w-full appearance-none rounded-xl bg-surface px-3 text-[16px] text-ink shadow-[0_0_0_1px_var(--color-field)] outline-none transition-shadow duration-150 placeholder:text-muted sm:text-[14px] ${
          readOnly
            ? 'cursor-default'
            : 'hover:shadow-[0_0_0_1px_var(--color-field-hover)] focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)]'
        }`}
      />
    </label>
  )
}

/**
 * A closed set small enough to show whole.
 *
 * Chosen is `surface-chip` — the same lift every other choice in this app uses.
 * Both states carry a border, the chosen one's transparent, so a chip does not
 * change size when it is picked.
 *
 * Outside edit mode the whole set stays on screen rather than collapsing to the
 * chosen few: which languages you did *not* pick is half of what the row says.
 */
export function Chips({ label, options, value, onToggle, disabled }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isOn = value.includes(option)

          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              aria-pressed={isOn}
              disabled={disabled}
              className={`h-8 rounded-full border px-3 text-[13px] font-medium outline-none transition-[color,background-color,border-color,scale] duration-150 ease-out active:scale-[0.97] ${
                isOn
                  ? 'border-transparent bg-surface-chip text-ink'
                  : `border-line text-muted ${
                      disabled
                        ? 'cursor-default'
                        : 'hover:text-ink focus-visible:text-ink'
                    }`
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
