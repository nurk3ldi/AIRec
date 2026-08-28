import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Building03Icon } from '@hugeicons/core-free-icons'
import {
  deleteBusinessLogo,
  mediaUrl,
  updateBusiness,
  uploadBusinessLogo,
} from '../../lib/api'
import { authed } from '../../lib/auth'
import { PAYMENT_METHODS, SERVICE_LANGUAGES } from '../../lib/businessOptions'
import { useT } from '../../lib/i18n'
import MultiSelect from './MultiSelect'

/**
 * What the assistant knows about the business it answers for.
 *
 * **Identity, not rules.** How far ahead it may book and how many people fit in
 * the chair are the assistant's *behaviour* and belong in their own card; this
 * one is the things a client might ask — what you are called, where you are,
 * what you take, which languages you speak.
 *
 * **The two closed sets are answered differently, and by their length.**
 * Languages is three options, so they are chips: the whole set and the current
 * answer are one line, and a list would hide both behind a press. Payment is
 * nine, which as chips wrapped to two rows and took most of the card's height
 * for a field that is set once — so it is a `MultiSelect`, one line that says
 * what was chosen.
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
  landmark: business?.landmark ?? '',
  languages: toList(business?.languages),
  payment: toList(business?.payment_methods),
})

export default function BusinessCard({ business, onSaved }) {
  const t = useT()
  const [form, setForm] = useState(() => formOf(business))
  const [saving, setSaving] = useState(false)
  const logoInput = useRef(null)

  // Re-seeded whenever the row itself changes — after a save, or when the first
  // fetch lands on a card that rendered before it. Keyed on the row's
  // `updated_at` rather than the object, which is a new reference every fetch.
  useEffect(() => {
    setForm(formOf(business))
  }, [business])

  const set = (changes) => setForm((was) => ({ ...was, ...changes }))

  const toggle = (field, value) =>
    setForm((was) => ({
      ...was,
      [field]: was[field].includes(value)
        ? was[field].filter((item) => item !== value)
        : [...was[field], value],
    }))

  // **Compared against the row, not tracked as a flag.** A flag has to be
  // cleared in every path that saves or resets; a comparison cannot go stale.
  const clean = formOf(business)
  const isDirty = JSON.stringify(form) !== JSON.stringify(clean)

  const save = async (event) => {
    event.preventDefault()
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
          landmark: form.landmark.trim() || null,
          languages: fromList(form.languages),
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

  const pickLogo = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await authed((token) => uploadBusinessLogo(token, file)).catch(() => {})
    onSaved?.()
  }

  const dropLogo = async () => {
    await authed(deleteBusinessLogo).catch(() => {})
    onSaved?.()
  }

  const logo = mediaUrl(business?.logo_url)

  return (
    // The project's card: a hairline rather than a shadow, because on the dark
    // theme the page and the card are the same black and an edge is the only
    // thing that can separate them.
    <form
      onSubmit={save}
      className="flex h-full min-h-0 flex-col rounded-2xl border border-line bg-surface p-6"
    >
      <h2 className="shrink-0 font-display text-[15px] font-semibold text-ink">
        {t('assistant.business')}
      </h2>

      {/* **The card fills the column and its contents scroll inside it.** The
          title stays put and so does the save button, which is the point: a
          form whose only way to reach «Сохранить» is to scroll past every field
          is one where the button is easy to lose. `min-h-0` is what lets this
          shrink — a flex item refuses to go below its content without it. */}
      <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">

      {/* The logo and the name on one row: the mark and the word it belongs to
          are one statement, and stacking them spends a whole row on a square. */}
      <div className="mt-5 flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-ground ring-1 ring-line">
          {logo ? (
            <img src={logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <HugeiconsIcon
              icon={Building03Icon}
              size={22}
              strokeWidth={1.8}
              className="text-muted"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-[13px] text-muted">{t('assistant.logo')}</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              className="h-8 rounded-full bg-surface-chip px-3 text-[13px] font-medium text-ink outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85"
            >
              {t('assistant.logoUpload')}
            </button>
            {logo && (
              <button
                type="button"
                onClick={dropLogo}
                className="h-8 rounded-full px-3 text-[13px] font-medium text-danger outline-none transition-colors hover:bg-danger/8 focus-visible:bg-danger/8"
              >
                {t('assistant.logoRemove')}
              </button>
            )}
          </div>
          {/* The picker is the input; the buttons above are what a person
              presses. `hidden` rather than an invisible overlay, so the label
              order and the tab order stay what they look like. */}
          <input
            ref={logoInput}
            type="file"
            accept="image/*"
            onChange={pickLogo}
            className="hidden"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          label={t('assistant.name')}
          value={form.name}
          onChange={(value) => set({ name: value })}
        />
        <Field
          label={t('assistant.industry')}
          value={form.industry}
          onChange={(value) => set({ industry: value })}
        />
        <Field
          label={t('assistant.phone')}
          value={form.phone}
          onChange={(value) => set({ phone: value })}
          type="tel"
        />
        <Field
          label={t('assistant.city')}
          value={form.city}
          onChange={(value) => set({ city: value })}
        />
        <Field
          label={t('assistant.address')}
          value={form.address}
          onChange={(value) => set({ address: value })}
        />
        <Field
          label={t('assistant.landmark')}
          value={form.landmark}
          onChange={(value) => set({ landmark: value })}
        />
        <MultiSelect
          label={t('assistant.payment')}
          options={PAYMENT_METHODS}
          value={form.payment}
          onChange={(next) => set({ payment: next })}
          placeholder={t('assistant.pick')}
        />
      </div>

      <Chips
        label={t('assistant.languages')}
        options={SERVICE_LANGUAGES}
        value={form.languages}
        onToggle={(item) => toggle('languages', item)}
      />


      </div>

      {/* **The button appears only when there is something to save.** A card
          that always offers it invites a press that does nothing, and with four
          cards on this page each saving separately, a row of idle buttons would
          be four of them. */}
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

/** One labelled text field. The label sits above rather than inside, because
 *  every one of these carries a value and there is no empty state a
 *  placeholder could stand in for. */
function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // 16px below `sm`, like every field in this app: iOS magnifies the page
        // when a smaller one takes focus and never magnifies back.
        className="h-10 w-full appearance-none rounded-xl bg-surface px-3 text-[16px] text-ink shadow-[0_0_0_1px_var(--color-field)] outline-none transition-shadow duration-150 placeholder:text-muted hover:shadow-[0_0_0_1px_var(--color-field-hover)] focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)] sm:text-[14px]"
      />
    </label>
  )
}

/** A closed set, small enough to show whole. Chosen is `surface-chip` — the
 *  same lift every other choice in this app uses. */
function Chips({ label, options, value, onToggle }) {
  return (
    <div className="mt-6 flex flex-col gap-2">
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
              className={`h-8 rounded-full border px-3 text-[13px] font-medium outline-none transition-colors ${
                isOn
                  ? 'border-transparent bg-surface-chip text-ink'
                  : 'border-line text-muted hover:text-ink focus-visible:text-ink'
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
