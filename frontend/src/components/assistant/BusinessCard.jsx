import { useEffect, useState } from 'react'
import { updateBusiness } from '../../lib/api'
import { authed } from '../../lib/auth'
import { PAYMENT_METHODS } from '../../lib/businessOptions'
import { useT } from '../../lib/i18n'
import { Field } from './fields'
import MultiSelect from './MultiSelect'

/**
 * What the assistant knows about the business it answers for.
 *
 * **No logo.** The upload was here and is gone: a mark is something a client
 * sees on a receipt or a page, and the assistant does not show anyone a
 * picture — it answers in text. The endpoints stay (`POST`/`DELETE
 * /auth/../business/logo`) for the day something displays one.
 *
 * **Identity, not rules.** How far ahead it may book and how many people fit in
 * the chair are the assistant's *behaviour* and belong in their own card; this
 * one is the things a client might ask — what you are called, where you are,
 * what you take, which languages you speak.
 *
 * **The languages and the landmark moved to «Настройки ассистента».** Both sat
 * here as facts about the business and are really instructions to the bot — see
 * that card. What is left is what a client would ask about, which is also what
 * brought this card back under the height of the screen.
 *
 * **Payment is a `MultiSelect`, not chips.** Nine options wrapped to two rows
 * and took most of the card for a field that is set once; one line that says
 * what was chosen is the same answer in a tenth of the space.
 *
 * **Read-only until «Редактировать».** Four cards on this page and every one
 * of them a form meant every field on the screen was live at once, so a cursor
 * crossing the page landed in something editable wherever it stopped. The
 * fields still show their values — that is what the card is mostly *for* — they
 * simply cannot be typed into until the card is opened.
 *
 * **The city is a plain field for now.** Eighty cities need filtering to be
 * pickable, which is a combobox this project no longer has; the column is a
 * free string, so typing one is correct rather than a stopgap that stores
 * something wrong.
 *
 * **No time zone.** Kazakhstan has run on one offset since March 2024 — the
 * backend defaults the column and nothing here can usefully change it, so a row
 * stating it was a line the owner had to read past on every visit.
 */

/** Free strings on the backend; the comma is this side's encoding of a set. */
const toList = (value) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const fromList = (items) => (items.length > 0 ? items.join(', ') : null)

/** What the form holds, read out of a business row. */
const formOf = (business) => ({
  name: business?.name ?? '',
  industry: business?.industry ?? '',
  phone: business?.phone ?? '',
  city: business?.city ?? '',
  address: business?.address ?? '',
  payment: toList(business?.payment_methods),
})

export default function BusinessCard({ business, onSaved, className = '' }) {
  const t = useT()
  const [form, setForm] = useState(() => formOf(business))
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const set = (changes) => setForm((was) => ({ ...was, ...changes }))

  // The row arrives after the first render — the page fetches it — so the
  // initialiser alone leaves the card permanently blank and permanently dirty.
  // `business` changes only on that fetch and on a reload after a save, so this
  // cannot land on top of something being typed.
  useEffect(() => {
    setForm(formOf(business))
  }, [business])

  // **Compared against the row, not tracked as a flag.** A flag has to be
  // cleared in every path that saves or resets; a comparison cannot go stale.
  const clean = formOf(business)
  const isDirty = JSON.stringify(form) !== JSON.stringify(clean)

  /**
   * **«Готово» is the save.** The card follows «График работы»: a separate
   * «Сохранить» underneath was a second button for the same moment — you finish
   * editing and you want it kept — and two controls for one intention is one of
   * them you have to explain. Leaving edit mode commits; nothing changed means
   * nothing is sent.
   */
  const commit = async () => {
    if (!isDirty || saving) return

    setSaving(true)
    try {
      await authed((token) =>
        updateBusiness(token, {
          // Empty means "cleared", which the API distinguishes from "omitted" —
          // so a field the owner emptied is sent as null rather than dropped.
          name: form.name.trim() || null,
          industry: form.industry.trim() || null,
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          address: form.address.trim() || null,
          payment_methods: fromList(form.payment),
        }),
      )
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

  return (
    // **Sized by its contents.** It carried `h-full`, which resolves to `auto`
    // under a parent that has only a `min-height` — so the card grew to its
    // fields instead of the column, overran the viewport and put a scrollbar on
    // the page. Two fields fewer and no false height, and it fits.
    <form
      onSubmit={(event) => {
        event.preventDefault()
        done()
      }}
      className={`flex flex-col rounded-2xl bg-surface-raised p-6 ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold text-ink">
          {t('assistant.business')}
        </h2>
        <button
          type="button"
          onClick={() => (editing ? done() : setEditing(true))}
          disabled={saving}
          className="h-8 shrink-0 rounded-full px-2.5 text-[13px] font-medium text-ink outline-none transition-opacity hover:opacity-70 focus-visible:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t(
            saving
              ? 'assistant.saving'
              : editing
                ? 'assistant.editDone'
                : 'assistant.edit',
          )}
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        <Field
          label={t('assistant.name')}
          value={form.name}
          onChange={(value) => set({ name: value })}
          readOnly={!editing}
        />
        <Field
          label={t('assistant.industry')}
          value={form.industry}
          onChange={(value) => set({ industry: value })}
          readOnly={!editing}
        />
        <Field
          label={t('assistant.phone')}
          value={form.phone}
          onChange={(value) => set({ phone: value })}
          readOnly={!editing}
          type="tel"
        />
        <Field
          label={t('assistant.city')}
          value={form.city}
          onChange={(value) => set({ city: value })}
          readOnly={!editing}
        />
        <Field
          label={t('assistant.address')}
          value={form.address}
          onChange={(value) => set({ address: value })}
          readOnly={!editing}
        />
        <MultiSelect
          label={t('assistant.payment')}
          options={PAYMENT_METHODS}
          value={form.payment}
          onChange={(next) => set({ payment: next })}
          placeholder={t('assistant.pick')}
          readOnly={!editing}
        />
      </div>

    </form>
  )
}
