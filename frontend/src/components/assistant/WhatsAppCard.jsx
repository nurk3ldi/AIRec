import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'
import { connectWhatsApp, disconnectWhatsApp } from '../../lib/api'
import { authed } from '../../lib/auth'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/i18n'
import { Field } from './fields'
import Reveal from '../Reveal'
import { CARD_EDGE } from '../card'

/**
 * The number the assistant answers on.
 *
 * **It belongs on this screen and not in «Настройки».** That panel is about the
 * account — who you are, your password, your sessions — and a WhatsApp number
 * is about the salon: it is the thing clients write to, it is owned by the
 * business rather than by whoever is signed in, and everything else the
 * assistant needs to know is already on this page.
 *
 * **Two fields and not a Meta login button.** Embedded Signup is the polished
 * way in and it needs a reviewed Meta app, a Facebook JS SDK on the page and a
 * server exchange for the token — none of which exist yet. What does exist is a
 * phone number id and an access token, both of which the owner can copy out of
 * the dashboard, so that is what this asks for. The card is where the button
 * goes the day there is one, and nothing behind it changes when it arrives.
 *
 * **The token is write-only.** It goes up and never comes back — the API does
 * not return it — so the field is empty whenever the card is opened, and an
 * empty one on a connected account means "leave it alone" rather than "clear
 * it". That is why reconnecting to the same number does not force the owner to
 * find their token again.
 */

const BLANK = { phoneNumberId: '', token: '', wabaId: '', displayPhoneNumber: '' }

const formOf = (account) =>
  account
    ? {
        phoneNumberId: account.phone_number_id ?? '',
        // Never sent back by the API — see the note above.
        token: '',
        wabaId: account.waba_id ?? '',
        displayPhoneNumber: account.display_phone_number ?? '',
      }
    : { ...BLANK }

export default function WhatsAppCard({ account, onSaved, className = '' }) {
  const t = useT()
  const [form, setForm] = useState(() => formOf(account))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // Two presses, like deleting a booking: a dialog for a two-word question is a
  // layer on a layer, and one button that unplugs the channel is one slip away
  // from a silent salon.
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setForm(formOf(account))
    setEditing(false)
    setConfirming(false)
  }, [account])

  const connected = Boolean(account)
  const set = (key) => (value) => setForm((was) => ({ ...was, [key]: value }))

  // A first connection needs both; a reconnection needs only whatever changed,
  // since an empty token means the stored one stays.
  const ready =
    form.phoneNumberId.trim() && (connected || form.token.trim())

  const save = async (event) => {
    event.preventDefault()
    if (!ready || saving) return

    setSaving(true)
    setError(null)
    try {
      await authed((session) =>
        connectWhatsApp(session, {
          phoneNumberId: form.phoneNumberId.trim(),
          // Empty means "keep the stored one" — the server reads it that way
          // for an account that already has a token, and refuses only a first
          // connection with none.
          token: form.token.trim() || null,
          wabaId: form.wabaId.trim(),
          displayPhoneNumber: form.displayPhoneNumber.trim(),
        }),
      )
      haptic('commit')
      setEditing(false)
      onSaved?.()
    } catch (failure) {
      // Left as typed: a save that failed is one the owner still means to make.
      setError(failure?.message ?? t('whatsapp.failed'))
    } finally {
      setSaving(false)
    }
  }

  const unplug = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setSaving(true)
    try {
      await authed(disconnectWhatsApp)
      haptic('commit')
      onSaved?.()
    } catch (failure) {
      setError(failure?.message ?? t('whatsapp.failed'))
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  return (
    <form
      onSubmit={save}
      className={`flex flex-col ${CARD_EDGE} p-4 ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="min-w-0 truncate font-display text-[15px] font-semibold text-ink">
          {t('whatsapp.title')}
        </h2>
        <Reveal open={connected && !editing} axis="x">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-10 shrink-0 rounded-full px-2.5 text-[13px] font-medium text-ink outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97] sm:h-8"
          >
            {t('assistant.edit')}
          </button>
        </Reveal>
      </div>

      {/* **Connected is a line, not a form.** Once a number answers, the thing
          the owner comes here to check is that it still does — the ids are
          setup detail they pasted once and will not read again. So the settled
          state says which number and since when, and the fields are one press
          away behind «Редактировать». */}
      {connected && !editing ? (
        <div className="mt-4 flex min-w-0 items-start gap-2">
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            size={18}
            strokeWidth={1.8}
            className="mt-0.5 shrink-0 text-ok"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] text-ink">
              {account.display_phone_number || account.phone_number_id}
            </p>
            {account.verified_name ? (
              <p className="mt-0.5 truncate text-[13px] text-muted">
                {account.verified_name}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {/* Not connected and nothing typed yet: say what this is for before
              asking for two ids nobody knows by heart. */}
          {!connected ? (
            <p className="text-[13px] leading-snug text-muted">
              {t('whatsapp.hint')}
            </p>
          ) : null}
          <Field
            label={t('whatsapp.phoneNumberId')}
            value={form.phoneNumberId}
            onChange={set('phoneNumberId')}
          />
          <Field
            label={
              connected ? t('whatsapp.tokenKeep') : t('whatsapp.token')
            }
            value={form.token}
            onChange={set('token')}
            type="password"
          />
          <Field
            label={t('whatsapp.displayNumber')}
            value={form.displayPhoneNumber}
            onChange={set('displayPhoneNumber')}
          />
        </div>
      )}

      {error ? (
        <p className="mt-3 text-[13px] leading-snug text-danger">{error}</p>
      ) : null}

      {/* The row of actions. Disconnect is on the left and quiet: it is the
          third thing here, not one of the two the card is about. */}
      <div className="mt-4 flex shrink-0 items-center justify-between gap-2">
        {connected ? (
          <button
            type="button"
            onClick={unplug}
            disabled={saving}
            className={`h-10 shrink-0 rounded-full px-2.5 text-[13px] font-medium outline-none transition-[opacity,color,scale] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 ${
              confirming
                ? 'text-danger'
                : 'text-muted hover:text-ink focus-visible:text-ink'
            }`}
          >
            {t(confirming ? 'whatsapp.disconnectSure' : 'whatsapp.disconnect')}
          </button>
        ) : (
          <span />
        )}

        {!connected || editing ? (
          <div className="flex shrink-0 items-center gap-1">
            <Reveal open={connected && editing} axis="x">
              <button
                type="button"
                onClick={() => {
                  setForm(formOf(account))
                  setEditing(false)
                  setError(null)
                }}
                disabled={saving}
                className="h-10 shrink-0 rounded-full px-2.5 text-[13px] font-medium text-muted outline-none transition-[opacity,color,scale] duration-150 ease-out hover:text-ink focus-visible:text-ink active:scale-[0.97] disabled:opacity-40 sm:h-8"
              >
                {t('assistant.cancel')}
              </button>
            </Reveal>
            <button
              type="submit"
              disabled={!ready || saving}
              className="h-10 shrink-0 rounded-full px-2.5 text-[13px] font-semibold text-ink outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8"
            >
              {t(saving ? 'assistant.saving' : 'whatsapp.connect')}
            </button>
          </div>
        ) : null}
      </div>
    </form>
  )
}
