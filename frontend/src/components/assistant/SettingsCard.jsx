import { useEffect, useState } from 'react'
import { updateBusiness } from '../../lib/api'
import { authed } from '../../lib/auth'
import { SERVICE_LANGUAGES } from '../../lib/businessOptions'
import { useT } from '../../lib/i18n'
import { Chips, Field } from './fields'

/**
 * How the assistant behaves — as opposed to what it knows.
 *
 * **The split is who the answer belongs to.** «О бизнесе» holds the things a
 * *client* asks about and the assistant repeats back: the name, the number, the
 * address, what you take. This card holds the things nobody asks about because
 * they are instructions to the bot itself.
 *
 * The languages moved here for exactly that reason. They read as a fact about
 * the business — «мы говорим по-казахски» — but what they actually set is which
 * language the assistant *answers in*, which is a rule about it and not about
 * the salon. The landmark came with them: it is what the assistant says when
 * somebody cannot find the door, a line it recites rather than a field of the
 * business record.
 *
 * Both still live on the `Business` row and still go through `PATCH /business`.
 * The seam here is the screen's, not the data's — which is why this card saves
 * separately, the way every other card on the page does: a partial update
 * cannot clobber the fields the card beside it owns.
 */

const formOf = (business) => ({
  landmark: business?.landmark ?? '',
  languages: (business?.languages ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
})

export default function SettingsCard({ business, onSaved, className = '' }) {
  const t = useT()
  const [form, setForm] = useState(() => formOf(business))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(formOf(business))
  }, [business])

  const toggleLanguage = (value) =>
    setForm((was) => ({
      ...was,
      languages: was.languages.includes(value)
        ? was.languages.filter((item) => item !== value)
        : [...was.languages, value],
    }))

  // Compared against the row rather than tracked as a flag: a flag has to be
  // cleared in every path that saves or resets, and a comparison cannot go
  // stale.
  const isDirty = JSON.stringify(form) !== JSON.stringify(formOf(business))

  const save = async (event) => {
    event.preventDefault()
    if (!isDirty || saving) return

    setSaving(true)
    try {
      await authed((token) =>
        updateBusiness(token, {
          // Empty means "cleared", which the API tells apart from "omitted" —
          // so a field the owner emptied is sent as null rather than dropped.
          landmark: form.landmark.trim() || null,
          languages:
            form.languages.length > 0 ? form.languages.join(', ') : null,
        }),
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
      className={`flex flex-col rounded-2xl bg-surface-raised p-6 ${className}`}
    >
      <h2 className="shrink-0 font-display text-[15px] font-semibold text-ink">
        {t('assistant.settings')}
      </h2>

      <div className="mt-5 flex flex-col gap-5">
        <Chips
          label={t('assistant.languages')}
          options={SERVICE_LANGUAGES}
          value={form.languages}
          onToggle={toggleLanguage}
        />
        <Field
          label={t('assistant.landmark')}
          value={form.landmark}
          onChange={(value) => setForm((was) => ({ ...was, landmark: value }))}
        />
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
