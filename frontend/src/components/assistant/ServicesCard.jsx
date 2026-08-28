import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { saveServices } from '../../lib/api'
import { authed } from '../../lib/auth'
import { useT } from '../../lib/i18n'

/**
 * The price list — what the assistant can offer, how long each takes and what
 * it costs.
 *
 * **Edited as a list and saved whole.** `PUT /business/services` takes the
 * entire thing in one transaction: a row with an `id` is updated in place, one
 * without is created, and anything left out is deleted. That is what the card
 * matches — fix three prices, rename one service, delete another, press Save
 * once — and it means the list can never be left half-applied.
 *
 * A locally-added row carries a `new-…` id so React can key it; it is stripped
 * on the way out, which is how the server is told it is new.
 *
 * **Duration is a quarter-hour grid and the field enforces it.** `SLOT_MINUTES`
 * is 15 on the server and a value off the grid is a 422 — so the field snaps on
 * blur rather than letting the owner type 40 and find out after pressing Save.
 * That grid is not decoration: booking is fitting durations into gaps, and the
 * arithmetic only stays exact while both sides share one unit.
 */

/** The step every duration has to land on — `SLOT_MINUTES` on the server. */
const STEP = 15

const rowsOf = (services) =>
  (services ?? []).map((service) => ({
    id: service.id,
    name: service.name ?? '',
    duration: String(service.duration_minutes ?? ''),
    price: String(service.price ?? ''),
  }))

/** Digits only, so a stray letter never reaches a numeric column. */
const digits = (value) => value.replace(/\D/g, '')

const snap = (value) => {
  const minutes = Number(value)
  if (!minutes) return ''
  return String(Math.max(STEP, Math.round(minutes / STEP) * STEP))
}

export default function ServicesCard({ services, onSaved }) {
  const t = useT()
  const [rows, setRows] = useState(() => rowsOf(services))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setRows(rowsOf(services))
  }, [services])

  const edit = (id, changes) =>
    setRows((was) =>
      was.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    )

  const add = () =>
    setRows((was) => [
      ...was,
      { id: `new-${Date.now()}`, name: '', duration: '', price: '' },
    ])

  const remove = (id) => setRows((was) => was.filter((row) => row.id !== id))

  // Compared against the fetched list rather than tracked as a flag — a flag
  // has to be cleared in every path that saves or resets.
  const isDirty = JSON.stringify(rows) !== JSON.stringify(rowsOf(services))

  const save = async (event) => {
    event.preventDefault()
    if (!isDirty || saving) return

    setSaving(true)
    try {
      await authed((token) =>
        saveServices(
          token,
          rows
            // A row with no name is one somebody started and left; sending it
            // would be storing a blank service the assistant could offer.
            .filter((row) => row.name.trim())
            .map((row, index) => ({
              // `null` is what says "new" — the local `new-…` id is this
              // side's bookkeeping and means nothing to the server.
              id: String(row.id).startsWith('new-') ? null : row.id,
              name: row.name.trim(),
              duration_minutes: Number(snap(row.duration)) || STEP,
              price: Number(row.price) || 0,
              is_active: true,
              position: index,
            })),
        ),
      )
      onSaved?.()
    } catch {
      // Left as typed: a save that failed is one the owner still means to make.
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={save}
      // **`self-start`, so this one does not stretch.** A grid item fills its
      // row by default, which is right for the business card — it is a form and
      // its fields want the height — and wrong here: a price list of three rows
      // in a card the height of the page is one row of content and a screenful
      // of nothing under it. It grows with the list instead, and past the
      // 320px cap below it scrolls inside itself rather than going on growing.
      className="flex flex-col self-start rounded-2xl border border-line bg-surface p-6"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold text-ink">
          {t('assistant.services')}
        </h2>
        <button
          type="button"
          onClick={add}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-surface-chip pr-3 pl-2.5 text-[13px] font-medium text-ink outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85"
        >
          <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2.2} />
          {t('assistant.serviceAdd')}
        </button>
      </div>

      {/* The list scrolls inside the card, so the heading and the save button
          stay where they are however long the price list grows. */}
      <div className="-mx-6 mt-4 max-h-[320px] overflow-y-auto px-6">
        {rows.length === 0 ? (
          // **It says what an empty list costs**, not merely that it is empty:
          // with no services the assistant has nothing to offer a client, which
          // is the one thing worth knowing here.
          <p className="pt-6 text-[13px] leading-relaxed text-muted">
            {t('assistant.servicesEmpty')}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-2 py-2">
                <input
                  value={row.name}
                  onChange={(event) => edit(row.id, { name: event.target.value })}
                  placeholder={t('assistant.serviceName')}
                  aria-label={t('assistant.serviceName')}
                  className="h-9 min-w-0 flex-1 appearance-none rounded-lg bg-transparent px-2 text-[16px] text-ink outline-none transition-shadow duration-150 placeholder:text-muted hover:shadow-[0_0_0_1px_var(--color-field)] focus:shadow-[0_0_0_1px_var(--color-field-focus)] sm:text-[14px]"
                />

                {/* Suffixed rather than labelled: «мин» beside the number is
                    the unit, and a column header for one field is a heading
                    with nothing to head. */}
                <Suffixed
                  value={row.duration}
                  onChange={(value) => edit(row.id, { duration: digits(value) })}
                  onBlur={() => edit(row.id, { duration: snap(row.duration) })}
                  suffix={t('assistant.min')}
                  width="w-[92px]"
                />
                <Suffixed
                  value={row.price}
                  onChange={(value) => edit(row.id, { price: digits(value) })}
                  suffix="₸"
                  width="w-[110px]"
                />

                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  aria-label={t('assistant.serviceRemove')}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted outline-none transition-colors hover:bg-danger/8 hover:text-danger focus-visible:bg-danger/8 focus-visible:text-danger"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isDirty && (
        <button
          type="submit"
          disabled={saving}
          className="mt-6 h-10 shrink-0 self-end rounded-full bg-accent px-5 text-[14px] font-medium text-surface outline-none transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t(saving ? 'assistant.saving' : 'assistant.save')}
        </button>
      )}
    </form>
  )
}

/**
 * A number with its unit sitting inside the field.
 *
 * The unit is `pointer-events-none` so a click anywhere on the box lands in the
 * input — a suffix that eats clicks is a field with a dead corner.
 */
function Suffixed({ value, onChange, onBlur, suffix, width }) {
  return (
    <div className={`relative shrink-0 ${width}`}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        inputMode="numeric"
        className="h-9 w-full appearance-none rounded-lg bg-transparent pr-9 pl-2 text-right text-[16px] text-ink outline-none transition-shadow duration-150 hover:shadow-[0_0_0_1px_var(--color-field)] focus:shadow-[0_0_0_1px_var(--color-field-focus)] sm:text-[14px]"
      />
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[13px] text-muted">
        {suffix}
      </span>
    </div>
  )
}
