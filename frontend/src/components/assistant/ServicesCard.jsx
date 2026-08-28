import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowDown01Icon,
  MinusSignCircleIcon,
} from '@hugeicons/core-free-icons'
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
 * **The card shows a name and a price, and the row carries a duration it does
 * not show.** The column is required — every booking is a span, and the
 * assistant fits durations into gaps — so a service without one cannot exist.
 * What the card does is stop asking: an existing row keeps whatever length it
 * was given, and a new one takes `DEFAULT_MINUTES`. Editing a price must not
 * silently change how long the service takes, which is why the value is carried
 * through rather than recomputed.
 *
 * **Removing a row lives behind «Редактировать».** A delete control on every
 * row, always, is one slip away from taking a service out of the price list —
 * and it is the rarest thing done here, sitting permanently beside the two
 * fields that are edited constantly. Asking for edit mode first is the same
 * bargain iOS makes with its lists: the destructive control is one press away
 * rather than zero, and the row is quiet the rest of the time.
 *
 * The mark is a **red minus**, not a bin. A bin says "this is thrown away",
 * which is true of the row and not of the service — it is removed from the
 * list, and the minus is the plus that added it, run backwards.
 *
 * **A long price list is folded rather than scrolled.** The card shows
 * `VISIBLE_ROWS` and a chevron on its bottom edge; opening it makes the card
 * taller and pushes what is under it down the page. That is the opposite of a
 * scrollbar inside the card, and deliberately so: eleven services are not a
 * thing to read a window at a time, and a card that grows says how much there
 * is where a scrollbar hides it.
 */

/** How many rows the card shows before it offers to unfold. */
const VISIBLE_ROWS = 4

/** What a new service is assumed to take, on the server's quarter-hour grid. */
const DEFAULT_MINUTES = 30

const rowsOf = (services) =>
  (services ?? []).map((service) => ({
    id: service.id,
    name: service.name ?? '',
    duration: String(service.duration_minutes ?? ''),
    price: String(service.price ?? ''),
  }))

/** Digits only, so a stray letter never reaches a numeric column. */
const digits = (value) => value.replace(/\D/g, '')

export default function ServicesCard({ services, onSaved }) {
  const t = useT()
  const [rows, setRows] = useState(() => rowsOf(services))
  const [saving, setSaving] = useState(false)
  // Whether the rows are showing their remove control. Local and forgotten on
  // reload: it is a mode you are in for a moment, not a preference.
  const [editing, setEditing] = useState(false)
  // Whether the whole list is showing. Local and forgotten on reload: it is
  // a look you took, not a preference.
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setRows(rowsOf(services))
  }, [services])

  const edit = (id, changes) =>
    setRows((was) =>
      was.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    )

  const remove = (id) => setRows((was) => was.filter((row) => row.id !== id))

  const add = () =>
    setRows((was) => [
      ...was,
      {
        id: `new-${Date.now()}`,
        name: '',
        duration: String(DEFAULT_MINUTES),
        price: '',
      },
    ])

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
              // Carried through untouched: the card does not ask for it, so it
              // must not change it either.
              duration_minutes: Number(row.duration) || DEFAULT_MINUTES,
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
      // **Sized by its contents, not by the slot.** The card grows as the list
      // is unfolded and the page scrolls, which is what lets the card under it
      // move down rather than be squeezed.
      //
      // `surface-raised` and no edge: the same fill every other card on this
      // page wears — see the note there.
      className="flex flex-col rounded-2xl bg-surface-raised p-4"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold text-ink">
          {t('assistant.services')}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {/* Plain text rather than a filled pill: «Добавить» is the action
              this card is for, and a second filled shape beside it would make
              two of them look equally like the thing to press. */}
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => setEditing((was) => !was)}
              className="h-8 rounded-full px-2.5 text-[13px] font-medium text-ink outline-none transition-opacity hover:opacity-70 focus-visible:opacity-70"
            >
              {t(editing ? 'assistant.editDone' : 'assistant.edit')}
            </button>
          )}
          {/* The glyph alone: the word beside a plus said the same thing
              twice, and the row is narrow. The label lives on as the button's
              name for a screen reader. */}
          <button
            type="button"
            onClick={add}
            aria-label={t('assistant.serviceAdd')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-chip text-ink outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* The list scrolls inside the card, so the heading and the save button
          stay where they are however long the price list grows. */}
      <div className="-mx-4 mt-3 px-4">
        {rows.length === 0 ? (
          // **It says what an empty list costs**, not merely that it is empty:
          // with no services the assistant has nothing to offer a client, which
          // is the one thing worth knowing here.
          <p className="pt-6 text-[13px] leading-relaxed text-muted">
            {t('assistant.servicesEmpty')}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {(open ? rows : rows.slice(0, VISIBLE_ROWS)).map((row) => (
              <li key={row.id} className="flex items-center gap-2 py-2">
                {/* On the left, where iOS puts it and where it cannot be
                    confused with the field it would delete. */}
                {editing && (
                  <button
                    type="button"
                    onClick={() => remove(row.id)}
                    aria-label={t('assistant.serviceRemove')}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-danger outline-none transition-colors hover:bg-danger/10 focus-visible:bg-danger/10"
                  >
                    <HugeiconsIcon
                      icon={MinusSignCircleIcon}
                      size={18}
                      strokeWidth={2}
                    />
                  </button>
                )}
                <input
                  value={row.name}
                  onChange={(event) => edit(row.id, { name: event.target.value })}
                  placeholder={t('assistant.serviceName')}
                  aria-label={t('assistant.serviceName')}
                  className="h-9 min-w-0 flex-1 appearance-none rounded-lg bg-transparent px-2 text-[16px] text-ink outline-none transition-shadow duration-150 placeholder:text-muted hover:shadow-[0_0_0_1px_var(--color-field)] focus:shadow-[0_0_0_1px_var(--color-field-focus)] sm:text-[14px]"
                />

                {/* Suffixed rather than labelled: «₸» beside the number is the
                    unit, and a column header for one field is a heading with
                    nothing to head. */}
                <Suffixed
                  value={row.price}
                  onChange={(value) => edit(row.id, { price: digits(value) })}
                  suffix="₸"
                  width="w-[116px]"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* **The fold sits on the card's bottom edge**, centred and overlapping
          it, the way the reference does: the control belongs to the boundary it
          moves rather than to the list above or the card below. */}
      {rows.length > VISIBLE_ROWS && (
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          aria-expanded={open}
          aria-label={t('assistant.services')}
          className="-mb-6 grid h-7 w-7 shrink-0 place-items-center self-center rounded-full bg-surface-chip text-ink outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85"
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            strokeWidth={2}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      )}

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
        className="h-9 w-full appearance-none rounded-lg bg-transparent pr-8 pl-1 text-right text-[16px] text-ink outline-none transition-shadow duration-150 hover:shadow-[0_0_0_1px_var(--color-field)] focus:shadow-[0_0_0_1px_var(--color-field-focus)] sm:text-[14px]"
      />
      {/* **The same size as the number it belongs to.** At 13px against a 14px
          value the ₸ read as a different, thinner glyph rather than as the
          unit — and at `right-2.5` a long price ran into it. Muted, because it
          is the unit and not the figure. */}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[14px] text-muted">
        {suffix}
      </span>
    </div>
  )
}
