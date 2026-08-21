/**
 * The shared control recipe for `/login` and `/signup`.
 *
 * The two pages are deliberate twins, and a twin kept in step by hand stops
 * being one the first time somebody edits only one of them. Keeping the strings
 * here makes that structural rather than a rule to remember.
 *
 * Every value is measured off `vercel.com/login`: 40px tall, a 6px radius
 * (`--geist-radius`), 12px of horizontal padding, 16px text, 150ms transitions.
 *
 * **The field's edge is a `box-shadow: 0 0 0 1px`, not a `border`.** A shadow
 * sits outside the box model, so focus can thicken the ring and add a 4px halo
 * without the input growing a pixel and nudging the whole form. Three steps —
 * resting, hover, focus — each a token.
 *
 * Use `var(--color-field)`, never `var(--field)`: only the `@theme inline`
 * names are registered, and Tailwind silently drops an arbitrary value that
 * references an unregistered variable.
 */
export const CONTROL =
  'h-10 w-full rounded-md px-3 text-[16px] font-medium transition-all duration-150'

export const FIELD =
  `${CONTROL} bg-surface font-normal text-ink outline-none placeholder:text-muted ` +
  'shadow-[0_0_0_1px_var(--color-field)] hover:shadow-[0_0_0_1px_var(--color-field-hover)] ' +
  'focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)]'

/** The same field wearing the error ring; focus still adds the halo. */
export const FIELD_ERROR =
  `${CONTROL} bg-surface font-normal text-ink outline-none placeholder:text-muted ` +
  'shadow-[0_0_0_1px_var(--color-danger)] focus:shadow-[0_0_0_1px_var(--color-danger),0_0_0_4px_var(--color-field-halo)]'

/** Filled: the one action the page exists for. */
export const BUTTON_PRIMARY =
  `${CONTROL} bg-accent text-surface hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60`

/** Outlined: everything else. Fill *and* edge move on hover, so the change
 *  reads as one element reacting rather than two things happening. */
export const BUTTON_SECONDARY =
  `${CONTROL} bg-surface text-ink shadow-[0_0_0_1px_var(--color-field-hover)] ` +
  'hover:bg-ink/6 hover:shadow-[0_0_0_1px_var(--color-field-focus)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60'
