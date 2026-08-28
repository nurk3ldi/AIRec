import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, SentIcon } from '@hugeicons/core-free-icons'
import {
  createMessage,
  listMessages,
  markConversationRead,
  updateConversation,
} from '../../lib/api'
import { authed } from '../../lib/auth'
import { clockOf } from '../../lib/appointments'
import { useT } from '../../lib/i18n'

/**
 * One conversation, opened.
 *
 * Three regions and each answers a different question: the header says who this
 * is and whether the assistant is speaking for us, the transcript says what has
 * been said, and the box at the bottom is how the owner steps in.
 *
 * **Stepping in is the point of the screen.** An owner's message switches the
 * assistant off for this thread and only this thread — the server does that in
 * `ConversationService.add_message`, so it cannot be forgotten by a caller —
 * and it stays off until somebody turns it back on. Not on a timer: whoever
 * answered once is usually handling that client now, and a bot that resumes on
 * a clock resumes in the middle of somebody else's sentence.
 *
 * **The message does not reach the client, and the screen says so.** There is
 * no outbound channel yet: `POST /conversations/{id}/messages` writes to the
 * transcript and nothing leaves the building. A reply box that looked like
 * WhatsApp and quietly delivered nothing would be the worst thing on this
 * screen, so the note under it is not decoration and should not be removed
 * until there is something behind it.
 */
export default function Thread({ chat, onBack, onChanged, timeZone }) {
  const t = useT()
  const [messages, setMessages] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scroller = useRef(null)

  const isDemo = String(chat?.id ?? '').startsWith('demo-')

  useEffect(() => {
    if (!chat || isDemo) {
      setMessages(chat?.demoMessages ?? null)
      return
    }
    let alive = true
    authed((token) => listMessages(token, chat.id))
      .then((rows) => alive && setMessages(rows))
      .catch(() => alive && setMessages([]))
    // Opening a thread is what clears its unread count — not the assistant
    // answering, which is exactly the thread the owner still wants to see.
    authed((token) => markConversationRead(token, chat.id)).catch(() => {})
    return () => {
      alive = false
    }
  }, [chat, isDemo])

  // **Pinned to the bottom, like every transcript.** A conversation is read
  // from its newest end, and landing at the top of a year of messages would
  // make every opening a scroll.
  useEffect(() => {
    const box = scroller.current
    if (box) box.scrollTop = box.scrollHeight
  }, [messages])

  if (!chat) {
    return (
      <p className="grid flex-1 place-items-center px-8 text-center text-[13px] text-muted">
        {t('inbox.pickChat')}
      </p>
    )
  }

  const title = chat.client_name || chat.client_phone
  const paused = chat.assistant_enabled === false

  const toggleAssistant = async () => {
    if (isDemo) {
      onChanged?.(chat, { assistant_enabled: !chat.assistant_enabled })
      return
    }
    await authed((token) =>
      updateConversation(token, chat.id, {
        assistant_enabled: !chat.assistant_enabled,
      }),
    ).catch(() => {})
    onChanged?.(chat, { assistant_enabled: !chat.assistant_enabled })
  }

  const send = async (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    if (isDemo) {
      // TEMPORARY — the demo threads have no server row. The rest of this
      // function is what really happens.
      setMessages((rows) => [
        ...(rows ?? []),
        {
          id: `demo-${Date.now()}`,
          author: 'owner',
          body,
          sent_at: new Date().toISOString(),
        },
      ])
      setDraft('')
      setSending(false)
      onChanged?.(chat, { assistant_enabled: false })
      return
    }

    try {
      await authed((token) => createMessage(token, chat.id, body))
      setDraft('')
      const rows = await authed((token) => listMessages(token, chat.id))
      setMessages(rows)
      // The server turned the assistant off when it took this message; the list
      // has to be told, or the banner would not appear until a refetch.
      onChanged?.(chat, { assistant_enabled: false })
    } catch {
      // Left in the box rather than cleared: a message that failed to save is
      // one the owner still means to send.
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Who this is, and whether the assistant is speaking. The back button is
          the phone's way out and is simply absent on a desktop, where the list
          is still on screen beside this. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('form.close')}
            className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink outline-none transition-colors hover:bg-ink/8 focus-visible:bg-ink/8 sm:hidden"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={20} strokeWidth={2} />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ink">{title}</p>
          <p className="truncate text-[12px] text-muted">
            {chat.client_name ? chat.client_phone : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={toggleAssistant}
          className={`h-8 shrink-0 rounded-full px-3 text-[13px] font-medium outline-none transition-colors ${
            paused
              ? 'bg-surface-chip text-ink'
              : 'bg-ink/6 text-muted hover:text-ink focus-visible:text-ink'
          }`}
        >
          {t(paused ? 'inbox.assistantResume' : 'inbox.assistantPause')}
        </button>
      </header>

      {/* **The banner does not go away.** It is the one thing on this screen
          that has to still be true tomorrow: the assistant is not answering
          this client, and nobody is going to remember that from a toast. */}
      {paused && (
        <p className="shrink-0 border-b border-line bg-now/10 px-4 py-2 text-[13px] text-now">
          {t('inbox.assistantOff')}
        </p>
      )}

      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {messages === null ? null : messages.length > 0 ? (
          messages.map((message) => (
            <Bubble key={message.id} message={message} timeZone={timeZone} />
          ))
        ) : (
          <p className="pt-8 text-center text-[13px] text-muted">
            {t('inbox.noMessages')}
          </p>
        )}
      </div>

      <form onSubmit={send} className="shrink-0 border-t border-line px-4 py-3">
        <div className="flex items-end gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('inbox.composerPlaceholder')}
            aria-label={t('inbox.composerPlaceholder')}
            // 16px below `sm` like every other field here — iOS magnifies the
            // page when a smaller one takes focus and never magnifies back.
            className="h-10 min-w-0 flex-1 appearance-none rounded-full bg-surface-card px-4 text-[16px] text-ink outline-none transition-shadow duration-150 placeholder:text-muted focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)] sm:text-[14px]"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label={t('inbox.send')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-surface outline-none transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <HugeiconsIcon icon={SentIcon} size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Not a toast and not a tooltip: this is true of every message sent
            from here until a channel exists, so it is written where it can be
            read before the message is written rather than after. */}
        <p className="mt-2 text-[12px] leading-tight text-muted">
          {t('inbox.notDelivered')}
        </p>
      </form>
    </>
  )
}

/**
 * One message.
 *
 * **Ours on the right, the client's on the left** — the arrangement every
 * messenger has settled on, and the reason a transcript can be read without
 * labels. The assistant and the owner are both "ours" and share the side; which
 * of the two said it is written above the bubble, because that is the one
 * distinction this product cares about and a side cannot carry it.
 */
function Bubble({ message, timeZone }) {
  const t = useT()
  const mine = message.author !== 'client'

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[75%] min-w-0">
        {mine && (
          <p className="mb-0.5 pr-1 text-right text-[11px] text-muted">
            {t(
              message.author === 'assistant'
                ? 'inbox.byAssistant'
                : 'inbox.byYou',
            )}
          </p>
        )}
        <div
          className={`rounded-2xl px-3 py-2 text-[14px] break-words ${
            mine ? 'bg-surface-chip text-ink' : 'bg-surface-card text-ink'
          }`}
        >
          {message.body}
          <span className="mt-1 block text-[11px] text-muted tabular-nums">
            {clockOf(message.sent_at, timeZone)}
          </span>
        </div>
      </div>
    </div>
  )
}
