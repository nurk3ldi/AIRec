import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft02Icon,
  SentIcon,
  Tick01Icon,
  TickDouble01Icon,
} from '@hugeicons/core-free-icons'
import { createMessage, listMessages, updateConversation } from '../../lib/api'
import { authed } from '../../lib/auth'
import { haptic } from '../../lib/haptics'
import { getLocale, useT } from '../../lib/i18n'

/**
 * One conversation, open.
 *
 * **Not a modal.** An inbox is a list and the thing the list is about, side by
 * side — that is the shape `/appointments` already uses and the shape every
 * messenger uses, and it costs none of the machinery a dialog does: no scrim,
 * no focus trap, no second animation scheme. On a phone there is no room for
 * two, so the page swaps this in over the grid instead, which is why the back
 * button is here rather than in the page.
 *
 * **The transcript is fetched, not handed down.** The list endpoint carries a
 * one-line preview and nothing else, deliberately — a hundred rows each
 * dragging their history behind them is what makes a list endpoint slow — so
 * opening a thread is a second request, and it is the one place the messages
 * exist.
 */

/**
 * How far a message got, as one glyph.
 *
 * The three ticks are WhatsApp's own vocabulary and are read without being
 * explained, which is the whole reason to borrow them. **Only `read` takes a
 * colour**: the other two are facts about our end of the wire, where read is
 * the one that says something about the person on the other end.
 *
 * A failure is not a tick at all — it is a sentence under the bubble, because
 * the useful thing there is *why*, and no glyph carries "прошло больше 24
 * часов".
 */
function Receipt({ status }) {
  if (status === 'read') {
    return (
      <HugeiconsIcon
        icon={TickDouble01Icon}
        size={14}
        strokeWidth={2}
        className="shrink-0 text-now"
      />
    )
  }
  if (status === 'delivered') {
    return (
      <HugeiconsIcon
        icon={TickDouble01Icon}
        size={14}
        strokeWidth={2}
        className="shrink-0 opacity-60"
      />
    )
  }
  if (status === 'sent') {
    return (
      <HugeiconsIcon
        icon={Tick01Icon}
        size={14}
        strokeWidth={2}
        className="shrink-0 opacity-60"
      />
    )
  }
  // `pending` and anything unknown: the message is ours and has not been
  // answered for yet. Nothing is drawn rather than a fourth glyph nobody has
  // learned — the bubble being there already says it was said.
  return null
}

const clock = (iso) =>
  new Date(iso).toLocaleTimeString(getLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  })

function Bubble({ message, t }) {
  const mine = message.author !== 'client'
  const failed = message.status === 'failed'

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="flex max-w-[min(78%,420px)] min-w-0 flex-col">
        {/* Ours is the chosen fill, theirs the card fill — the same two tokens
            the timetable spends on "this one" and "a thing drawn on the page".
            Neither is the accent: a column of accent-filled bubbles would be
            the loudest thing in the product, for text nobody has to act on. */}
        <div
          className={`min-w-0 rounded-2xl px-3 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap ${
            mine ? 'bg-surface-chip text-ink' : 'bg-surface-card text-ink'
          } ${failed ? 'opacity-60' : ''}`}
        >
          {message.body}
        </div>

        <div
          className={`mt-1 flex items-center gap-1 px-1 text-[11px] text-muted ${
            mine ? 'justify-end' : 'justify-start'
          }`}
        >
          {/* Who said it, but only when it could be either of us. The client's
              own messages need no byline — there is one person on that end. */}
          {mine ? (
            <span className="shrink-0">
              {t(
                message.author === 'assistant'
                  ? 'inbox.author.assistant'
                  : 'inbox.author.owner',
              )}
            </span>
          ) : null}
          <span className="shrink-0 tabular-nums">{clock(message.sent_at)}</span>
          {mine ? <Receipt status={message.status} /> : null}
        </div>

        {/* The refusal, in words, under the bubble it belongs to. Orange rather
            than red: nothing is broken and nothing was lost — the message is
            written down, it simply has not left — and red would claim a
            failure the owner has to fix rather than a fact they have to know. */}
        {failed && message.error ? (
          <p
            className={`mt-0.5 max-w-full px-1 text-[11px] leading-snug text-now ${
              mine ? 'text-right' : ''
            }`}
          >
            {message.error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function Thread({ conversation, onBack, onChanged, className = '' }) {
  const t = useT()
  const [messages, setMessages] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scroller = useRef(null)

  const id = conversation?.id

  useEffect(() => {
    if (!id) return
    let alive = true
    setMessages(null)
    authed((token) => listMessages(token, id))
      .then((rows) => alive && setMessages(rows))
      // Swallowed: an empty transcript is what a thread with nothing in it
      // looks like too, and an error banner over a list nobody can retry is a
      // second thing on screen that does not help.
      .catch(() => alive && setMessages([]))
    return () => {
      alive = false
    }
  }, [id])

  /**
   * Open at the bottom, and stay there as things arrive.
   *
   * `useLayoutEffect` rather than `useEffect`: everything below is positioned
   * from the scroll height, and doing this after the paint gives one frame
   * showing the top of a long transcript before it jumps.
   */
  useLayoutEffect(() => {
    const node = scroller.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  if (!conversation) return null

  const send = async (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    try {
      const message = await authed((token) => createMessage(token, id, body))
      // Cleared only once it is written down — a box that empties on the press
      // loses the words if the request fails.
      setDraft('')
      // Appended rather than re-fetched: the answer *is* the row, carrying its
      // status and, when WhatsApp refused it, the reason.
      setMessages((was) => [...(was ?? []), message])
      haptic('commit')
      // The thread's own row changed too — the assistant went quiet, the
      // preview moved — so the list above has to hear about it.
      onChanged?.()
    } catch {
      // Left in the box: a message that did not save is one the owner still
      // means to send. A refusal by WhatsApp is not this path — that comes back
      // as a saved message marked failed.
    } finally {
      setSending(false)
    }
  }

  const toggleAssistant = async () => {
    try {
      await authed((token) =>
        updateConversation(token, id, {
          assistant_enabled: !conversation.assistant_enabled,
        }),
      )
      onChanged?.()
    } catch {
      // The switch simply does not move. Nothing was lost.
    }
  }

  return (
    <section
      className={`flex min-h-0 flex-col bg-surface-raised ${className}`}
      aria-label={conversation.client_name || conversation.client_phone}
    >
      {/* The header. Back on the left — a phone needs it and a desktop ignores
          it, which is why it is `sm:hidden` rather than absent. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('inbox.back')}
          className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-ink/6 focus-visible:bg-ink/6 active:scale-[0.95] sm:hidden"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={20} strokeWidth={1.8} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] leading-tight font-semibold text-ink">
            {conversation.client_name || conversation.client_phone}
          </p>
          {conversation.client_name ? (
            <p className="mt-0.5 truncate text-[13px] leading-tight text-muted">
              {conversation.client_phone}
            </p>
          ) : null}
        </div>

        {/* **The switch, said as what is true rather than as a control.** The
            label is who is answering, and pressing it hands the thread over —
            which is the way the rule reads from the owner's side: whoever
            steps in takes it. Off is `--now`, the colour the product already
            spends on "this is happening at this moment". */}
        <button
          type="button"
          onClick={toggleAssistant}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium outline-none transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.97] ${
            conversation.assistant_enabled
              ? 'bg-surface-chip text-ink hover:opacity-80'
              : 'bg-now/12 text-now hover:bg-now/20'
          }`}
        >
          {t(
            conversation.assistant_enabled
              ? 'inbox.assistantOn'
              : 'inbox.assistantOff',
          )}
        </button>
      </div>

      {/* The transcript. `min-h-0` is what lets it shrink inside the column and
          scroll rather than pushing the composer off the bottom. */}
      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {messages === null ? null : messages.length === 0 ? (
          <p className="m-auto text-[13px] text-muted">{t('inbox.noMessages')}</p>
        ) : (
          messages.map((message) => (
            <Bubble key={message.id} message={message} t={t} />
          ))
        )}
      </div>

      {/* The composer. `pb` carries the home indicator, since on a phone this
          sits at the very bottom edge of the screen. */}
      <form
        onSubmit={send}
        className="flex shrink-0 items-end gap-2 border-t border-line px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('inbox.reply')}
          // 16px below `sm` like every field here: iOS magnifies the page when
          // a smaller one takes focus and never magnifies back.
          className="h-10 min-w-0 flex-1 appearance-none rounded-xl bg-surface px-3 text-[16px] text-ink shadow-[0_0_0_1px_var(--color-field)] outline-none transition-[box-shadow] duration-150 placeholder:text-muted hover:shadow-[0_0_0_1px_var(--color-field-hover)] focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)] sm:text-[14px]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label={t('inbox.send')}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-surface outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-80 focus-visible:opacity-80 active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <HugeiconsIcon icon={SentIcon} size={18} strokeWidth={1.8} />
        </button>
      </form>
    </section>
  )
}
