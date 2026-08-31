import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowDown01Icon,
  MinusSignCircleIcon,
} from '@hugeicons/core-free-icons'
import { saveServices } from '../../lib/api'
import { authed } from '../../lib/auth'
import { haptic } from '../../lib/haptics'
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

  /**
   * **«Готово» is the save, and «Отмена» is the way out** — the same two words
   * the three cards beside this one answer to. It had a third shape of its own:
   * «Редактировать» revealed the minus while the fields stayed live, and a
   * «Сохранить» appeared at the foot the moment anything was typed. Two ways of
   * committing on one page is one of them somebody has to be told about, and
   * a card whose fields are always live has no state for «Отмена» to go back
   * to.
   */
  const commit = async () => {
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
      // Two ticks: something was written. Fired here rather than on the
      // press, because the press is a request and this is the answer.
      haptic('commit')
      onSaved?.()
    } catch {
      // Left as typed: a save that failed is one the owner still means to make.
    } finally {
      setSaving(false)
    }
  }

  const done = async () => {
    await commit()
    setEditing(false)
  }

  // Back to the list the server holds — which is also what drops a row that was
  // added and never named.
  const cancel = () => {
    setRows(rowsOf(services))
    setEditing(false)
  }

  /**
   * One row of the price list.
   *
   * A function rather than an inline map, because the list is drawn twice now —
   * the rows that always show and the ones behind the fold — and two copies of
   * a row are two rows that agree until one is edited.
   */
  const renderRow = (row) => (
    // No `gap`: the remove control's own margin lives inside the part that
    // animates, so a collapsed control leaves nothing behind — a flex gap would
    // sit there as 8px of dead space whether or not anything was in it.
    <li key={row.id} className="flex items-center py-2">
      {/* **The row opens to let the control in**, rather than the control
          appearing inside a row that jumps sideways to make space. Same `fr`
          trick as the fold, on the other axis: `1fr` in an auto-width track
          resolves to the button's own max-content width, so nothing here is a
          measured pixel value that could drift from the button's size. */}
      <div
        className={`grid shrink-0 transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none ${
          editing ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          {/* On the left, where iOS puts it and where it cannot be confused
              with the field it would delete. */}
          <button
            type="button"
            onClick={() => remove(row.id)}
            disabled={!editing}
            tabIndex={editing ? undefined : -1}
            aria-label={t('assistant.serviceRemove')}
            className="mr-2 grid h-9 w-9 place-items-center rounded-full text-danger outline-none transition-[background-color,scale] sm:h-7 sm:w-7 duration-150 ease-out hover:bg-danger/10 focus-visible:bg-danger/10 active:scale-[0.95]"
          >
            <HugeiconsIcon
              icon={MinusSignCircleIcon}
              size={18}
              strokeWidth={2}
            />
          </button>
        </div>
      </div>

      <input
        value={row.name}
        onChange={(event) => edit(row.id, { name: event.target.value })}
        readOnly={!editing}
        tabIndex={editing ? undefined : -1}
        placeholder={t('assistant.serviceName')}
        aria-label={t('assistant.serviceName')}
        className={`h-10 min-w-0 flex-1 appearance-none rounded-lg bg-transparent px-2 text-[16px] text-ink outline-none transition-shadow duration-150 placeholder:text-muted sm:h-9 sm:text-[14px] ${
          editing
            ? 'hover:shadow-[0_0_0_1px_var(--color-field)] focus:shadow-[0_0_0_1px_var(--color-field-focus)]'
            : 'cursor-default'
        }`}
      />

      {/* Suffixed rather than labelled: «₸» beside the number is the unit, and
          a column header for one field is a heading with nothing to head. */}
      <Suffixed
        value={row.price}
        onChange={(value) => edit(row.id, { price: digits(value) })}
        readOnly={!editing}
        suffix="₸"
        width="ml-2 w-[116px]"
      />
    </li>
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        done()
      }}
      // **Sized by its contents, not by the slot.** The card grows as the list
      // is unfolded and the page scrolls, which is what lets the card under it
      // move down rather than be squeezed.
      //
      // `surface-raised` and no edge: the same fill every other card on this
      // page wears — see the note there.
      // **The same resting height as the card beside it in the column.** The
      // two are content-sized, so an empty price list and a full week came out
      // as two boxes of visibly different size stacked on each other. A shared
      // minimum settles that without freezing either: «Услуги» still grows past
      // it when its list is unfolded, which is the whole point of the fold.
      className="flex min-h-[240px] flex-col rounded-2xl bg-surface-raised p-4"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="min-w-0 truncate font-display text-[15px] font-semibold text-ink">
          {t('assistant.services')}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {/* Plain text rather than a filled pill: «Добавить» is the action
              this card is for, and a second filled shape beside it would make
              two of them look equally like the thing to press. */}
          {editing && (
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="h-10 shrink-0 rounded-full px-2.5 text-[13px] font-medium text-muted outline-none transition-[opacity,color,scale] duration-150 ease-out hover:text-ink focus-visible:text-ink active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8"
            >
              {t('assistant.cancel')}
            </button>
          )}
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => (editing ? done() : setEditing(true))}
              disabled={saving}
              className={`h-10 rounded-full px-2.5 text-[13px] text-ink outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 ${editing ? 'font-semibold' : 'font-medium'}`}
            >
              {t(
                saving
                  ? 'assistant.saving'
                  : editing
                    ? 'assistant.editDone'
                    : 'assistant.edit',
              )}
            </button>
          )}
          {/* The glyph alone: the word beside a plus said the same thing
              twice, and the row is narrow. The label lives on as the button's
              name for a screen reader. */}
          <button
            type="button"
            onClick={() => {
              setEditing(true)
              add()
            }}
            aria-label={t('assistant.serviceAdd')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-chip text-ink outline-none transition-[opacity,scale] sm:h-8 sm:w-8 duration-150 ease-out hover:opacity-85 focus-visible:opacity-85 active:scale-[0.95]"
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
          <>
            <ul className="divide-y divide-line">
              {rows.slice(0, VISIBLE_ROWS).map(renderRow)}
            </ul>

            {/* **The rest of the list unfolds; it does not appear.** The card
                growing by four rows in one frame is the page jumping, and the
                reader then has to find their place again — where a boundary
                that opens says what happened and where the new rows came from.

                `grid-template-rows: 0fr → 1fr` is this project's one exception
                to animating only transform and opacity, and it earns it the
                same way it does in `WeekStrip`: the height of an unknown number
                of rows is not a number the component can know, and the `fr`
                trick is the only way to animate to *content* without measuring
                it. The sheet curve, because this is a surface opening. */}
            {rows.length > VISIBLE_ROWS && (
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                  open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                {/* `overflow-hidden` is what the collapsed row clips against —
                    and it clips the first row's own top rule with it, which is
                    why the divider between the fourth row and the fifth is put
                    on that row rather than on this list. */}
                <ul className="divide-y divide-line overflow-hidden [&>li:first-child]:border-t [&>li:first-child]:border-line">
                  {rows.slice(VISIBLE_ROWS).map(renderRow)}
                </ul>
              </div>
            )}
          </>
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
          className="-mb-6 grid h-9 w-9 shrink-0 place-items-center self-center rounded-full bg-surface-chip text-ink outline-none transition-[opacity,scale] sm:h-7 sm:w-7 duration-150 ease-out hover:opacity-85 focus-visible:opacity-85 active:scale-[0.95]"
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            strokeWidth={2}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
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
function Suffixed({ value, onChange, onBlur, suffix, width, readOnly }) {
  return (
    <div className={`relative shrink-0 ${width}`}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        inputMode="numeric"
        className={`h-10 w-full appearance-none rounded-lg bg-transparent pr-8 pl-1 text-right text-[16px] text-ink outline-none transition-shadow duration-150 sm:h-9 sm:text-[14px] ${
          readOnly
            ? 'cursor-default'
            : 'hover:shadow-[0_0_0_1px_var(--color-field)] focus:shadow-[0_0_0_1px_var(--color-field-focus)]'
        }`}
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
