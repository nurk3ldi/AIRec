/**
 * The one card recipe from the dashboard visual language: white on the page's
 * grey ground, at the resting elevation.
 *
 * White on grey already separates a card, so the shadow is not what holds it
 * up — it is what gives the surface weight. That is why it is two wide, soft,
 * low-opacity layers rather than a dark edge under the box: a 1px contact
 * shadow, and a 24px one lifted 12px so it reads as ambient rather than as a
 * border someone blurred.
 *
 * `action` renders on the far right of the title row; nothing else is allowed to
 * compete up there.
 */
export default function Card({ title, action, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(23,18,21,0.04),0_8px_24px_-12px_rgba(23,18,21,0.10)] ${className}`}
    >
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-[15px] font-semibold text-[#171215]">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** Small accent-text control for a card header — "Изменить", "Добавить…". */
export function CardAction({ onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-md text-[13px] font-medium text-[#3248F2] outline-none transition-colors hover:underline focus-visible:underline disabled:text-[#999999] disabled:no-underline"
    >
      {children}
    </button>
  )
}
