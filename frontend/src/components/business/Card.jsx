/**
 * The one card recipe from the dashboard visual language: white on the page's
 * grey ground, no border and no shadow — the contrast alone does the separating.
 *
 * `action` renders on the far right of the title row; nothing else is allowed to
 * compete up there.
 */
export default function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white p-6 ${className}`}>
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
      className="shrink-0 text-[13px] font-medium text-[#3248F2] outline-none transition-colors hover:underline disabled:text-[#999999] disabled:no-underline"
    >
      {children}
    </button>
  )
}
