import { useEffect, useState } from 'react'
import { updateBusiness } from '../../lib/api'
import { authed } from '../../lib/auth'
import { SERVICE_LANGUAGES } from '../../lib/businessOptions'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/i18n'
import { Chips, Field } from './fields'
import TelegramSection from './TelegramSection'
import Reveal from '../Reveal'
import { CARD_EDGE } from '../card'

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

export default function SettingsCard({
  business,
  // The connected bot, or `null`, or `undefined` while it is still being read.
  // It arrives here rather than being fetched inside, for the reason every
  // other card on this page takes its row as a prop: one screen, one read.
  telegram,
  onSaved,
  className = '',
}) {
  const t = useT()
  const [form, setForm] = useState(() => formOf(business))
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

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
          // Empty means "cleared", which the API tells apart from "omitted" —
          // so a field the owner emptied is sent as null rather than dropped.
          landmark: form.landmark.trim() || null,
          languages:
            form.languages.length > 0 ? form.languages.join(', ') : null,
        }),
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

  const cancel = () => {
    setForm(formOf(business))
    setEditing(false)
  }

  return (
    // **A `div`, not a `form`, and the channel below is why.** Connecting a bot
    // is its own save against its own endpoint, so it keeps its own `<form>` —
    // and a form inside a form is not valid HTML. The two sit as siblings
    // inside one card, divided by a hairline: this project's own answer to
    // grouping, and cheaper than a second card for something that is a setting
    // of the assistant rather than a subject beside it.
    <div className={`flex flex-col ${CARD_EDGE} p-4 ${className}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          done()
        }}
        className="flex flex-col"
      >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="min-w-0 truncate font-display text-[15px] font-semibold text-ink">
          {t('assistant.settings')}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
        {/* **The row opens to let it in.** «Отмена» is the direct result of
            pressing «Редактировать», so it has to arrive from somewhere rather
            than be there on the next frame — and the somewhere is the row it
            widens. Same shape as the price list's red minus, which is the one
            other control on this page that a mode reveals. */}
        <Reveal open={editing} axis="x">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="h-10 shrink-0 rounded-full px-2.5 text-[13px] font-medium text-muted outline-none transition-[opacity,color,scale] duration-150 ease-out hover:text-ink focus-visible:text-ink active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8"
          >
            {t('assistant.cancel')}
          </button>
        </Reveal>
        <button
          type="button"
          onClick={() => (editing ? done() : setEditing(true))}
          disabled={saving}
          className={`h-10 shrink-0 rounded-full px-2.5 text-[13px] text-ink outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 ${editing ? 'font-semibold' : 'font-medium'}`}
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
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <Chips
          label={t('assistant.languages')}
          options={SERVICE_LANGUAGES}
          value={form.languages}
          onToggle={toggleLanguage}
          disabled={!editing}
        />
        <Field
          label={t('assistant.landmark')}
          value={form.landmark}
          onChange={(value) => setForm((was) => ({ ...was, landmark: value }))}
          readOnly={!editing}
        />
      </div>
      </form>

      {/* **The channel, under a line.** Which bot carries the assistant's words
          is a setting of the assistant, so it belongs in this card rather than
          in one of its own beside the price list — but it is a different
          subject from the two fields above, and a line is what says so.

          Nothing is drawn while the row is still being read: a section that
          appears a moment later moves the card under the cursor, where an empty
          strip of the card's own ground does not. */}
      {telegram === undefined ? null : (
        <>
          <div className="mt-4 h-px shrink-0 bg-line" />
          <TelegramSection
            account={telegram}
            onSaved={onSaved}
            className="mt-4"
          />
        </>
      )}
    </div>
  )
}
