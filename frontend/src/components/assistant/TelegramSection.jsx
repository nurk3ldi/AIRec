import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons'
import { connectTelegram, disconnectTelegram } from '../../lib/api'
import { authed } from '../../lib/auth'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/i18n'
import { Field } from './fields'
import Reveal from '../Reveal'

/**
 * The bot the assistant answers through — a **section of «Настройки ассистента»**,
 * not a card of its own.
 *
 * It was its own card beside the others until 2026-09-10, which put the
 * channel on the same level as the price list and the working week. It is not
 * on that level: which bot carries the assistant's words is a setting *of the
 * assistant*, and it now lives in the card that holds the rest of them, under
 * a hairline. That is this project's own rule — «prefer a divider to a second
 * card» — and it is why nothing here draws `CARD_EDGE` any more.
 *
 * **It keeps its own `<form>` and its own save**, and that is deliberate rather
 * than an oversight: the card above saves the business row through `PATCH
 * /business`, while connecting a bot is `PUT /business/telegram` — a different
 * call, a different failure, and a different verb on the button. One «Готово»
 * covering both would be one press that can half-succeed. Two forms side by
 * side inside one card is also why `SettingsCard`'s outer element is a `div`:
 * a form inside a form is not valid HTML.
 *
 * **One field, where WhatsApp had three, and that is the channel rather than
 * the design.** A bot token already contains the bot's id; `getMe` supplies the
 * username; and the server registers the webhook itself with the token it was
 * just given. There is nothing left for the owner to paste — connecting is
 * @BotFather → copy → paste → Подключить.
 *
 * **The token is write-only, and an empty box means nothing is kept.** The API
 * never sends it back; @BotFather hands a bot token over again whenever it is
 * asked, so there is nothing to preserve and no "keep the stored one" state to
 * explain — reconnecting simply asks for it again.
 *
 * **`webhook_active` is the one thing this says that a WhatsApp card could
 * not.** A deployment with no public address cannot register a webhook, so the
 * token is stored and nothing arrives — a state that looks identical to
 * "connected" from the outside and is not. It says so rather than letting the
 * owner wait for messages that were never going to come.
 */

export default function TelegramSection({ account, onSaved, className = '' }) {
  const t = useT()
  const [token, setToken] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // Two presses, like deleting a booking and like unplugging WhatsApp: one
  // button that silences the salon is one slip away from a silent salon.
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setToken('')
    setEditing(false)
    setConfirming(false)
  }, [account])

  const connected = Boolean(account)
  const ready = token.trim().length > 0

  const save = async (event) => {
    event.preventDefault()
    if (!ready || saving) return

    setSaving(true)
    setError(null)
    try {
      await authed((session) => connectTelegram(session, { token: token.trim() }))
      haptic('commit')
      setEditing(false)
      onSaved?.()
    } catch (failure) {
      // Left as typed: a save that failed is one the owner still means to make.
      setError(failure?.message ?? t('telegram.failed'))
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
      await authed(disconnectTelegram)
      haptic('commit')
      onSaved?.()
    } catch (failure) {
      setError(failure?.message ?? t('telegram.failed'))
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  return (
    <form onSubmit={save} className={`flex flex-col ${className}`}>
      {/* 11px uppercase muted — the group-heading step this project uses inside
          a card, not the 15px semibold of a card title: the card is already
          named «Настройки ассистента» above, and a second heading at that
          weight would read as two cards in one box. */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[11px] tracking-wide text-muted uppercase">
          {t('telegram.title')}
        </p>
        <Reveal open={connected && !editing} axis="x">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-10 shrink-0 rounded-full px-2.5 text-[13px] font-medium text-ink outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97] sm:h-8"
          >
            {t('telegram.replace')}
          </button>
        </Reveal>
      </div>

      {/* **Connected is a line, not a form**, the same as the card beside it:
          once a bot answers, what the owner comes back to check is that it
          still does. */}
      {connected && !editing ? (
        <div className="mt-3 flex min-w-0 items-start gap-2">
          <HugeiconsIcon
            icon={account.webhook_active ? CheckmarkCircle02Icon : Alert02Icon}
            size={18}
            strokeWidth={1.8}
            className={`mt-0.5 shrink-0 ${
              account.webhook_active ? 'text-ok' : 'text-danger'
            }`}
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] text-ink">
              {account.bot_username ? `@${account.bot_username}` : account.bot_id}
            </p>
            {/* The warning, and only when there is one to give: a stored token
                with no webhook is a channel that looks connected and receives
                nothing. */}
            {account.webhook_active ? null : (
              <p className="mt-0.5 text-[13px] leading-snug text-danger">
                {t('telegram.webhookOff')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {/* Say where the token comes from before asking for it — nobody has
              a bot token to hand, and the answer is three taps in Telegram. */}
          {!connected ? (
            <p className="text-[13px] leading-snug text-muted">
              {t('telegram.hint')}
            </p>
          ) : null}
          <Field
            label={t('telegram.token')}
            value={token}
            onChange={setToken}
            type="password"
          />
        </div>
      )}

      {error ? (
        <p className="mt-3 text-[13px] leading-snug text-danger">{error}</p>
      ) : null}

      {/* Disconnect on the left and quiet: the third thing here, not one of the
          two the card is about. */}
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
            {t(confirming ? 'telegram.disconnectSure' : 'telegram.disconnect')}
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
                  setToken('')
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
              {t(saving ? 'assistant.saving' : 'telegram.connect')}
            </button>
          </div>
        ) : null}
      </div>
    </form>
  )
}
