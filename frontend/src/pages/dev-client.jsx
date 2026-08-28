import { useState } from 'react'
import { Navigate, useOutletContext } from 'react-router-dom'
import { ingestMessage } from '../lib/api'
import { authed } from '../lib/auth'
import { isDevAccount } from '../lib/devAccess'
import { useT } from '../lib/i18n'

/**
 * The other end of the conversation — a console for writing into your own inbox
 * as though a client had sent it on WhatsApp.
 *
 * **Why this and not a second account.** An inbox is scoped by `business_id`,
 * so a message written from another account lands in that account's inbox and
 * nowhere else; there is no messaging between accounts and there should not be.
 * What a client's message actually is, is a call to `POST /conversations/ingest`
 * — the one entrance anything inbound goes through, and the one the real
 * WhatsApp webhook will use. This screen is that call with a text box in front
 * of it.
 *
 * **Open it in a second tab.** Write here, watch `/inbox` in the other one: the
 * thread appears, the preview updates, and answering from the inbox switches
 * the assistant off exactly as it will in production. That loop is what the
 * assistant itself will be built against.
 *
 * **It is gated on the account, not on the build** — see `lib/devAccess.js`.
 * Anyone else who reaches the URL is sent to the inbox, because a business
 * owner finding a "pretend to be your customer" console in their panel would
 * reasonably wonder what else in there is not real.
 */

/**
 * The two clients, so a thread can be told from a thread.
 *
 * Two rather than one because half of what needs testing is the *list*: unread
 * counts, ordering, which thread the assistant is off in. One client is one row
 * and proves none of it. Editable, so a third is a matter of typing over one.
 */
const CLIENTS = [
  { id: 'a', name: 'Клиент 1', phone: '+7 701 000 00 01' },
  { id: 'b', name: 'Клиент 2', phone: '+7 701 000 00 02' },
]

export default function DevClientPage() {
  const t = useT()
  const { user } = useOutletContext()

  const [clients, setClients] = useState(CLIENTS)
  const [activeId, setActiveId] = useState(CLIENTS[0].id)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [log, setLog] = useState([])

  if (!isDevAccount(user)) return <Navigate to="/inbox" replace />

  const active = clients.find((client) => client.id === activeId) ?? clients[0]

  const edit = (changes) =>
    setClients((rows) =>
      rows.map((row) => (row.id === activeId ? { ...row, ...changes } : row)),
    )

  const send = async (event) => {
    event.preventDefault()
    const text = body.trim()
    if (!text || sending) return

    setSending(true)
    try {
      await authed((token) =>
        ingestMessage(token, {
          clientPhone: active.phone,
          clientName: active.name,
          body: text,
          // Unique per message: the endpoint drops a redelivery, so without
          // this the same text sent twice would silently vanish the second
          // time — which is correct for a webhook and confusing for a person.
          messageExternalId: `dev-${Date.now()}`,
        }),
      )
      setLog((rows) => [{ at: Date.now(), who: active.name, text }, ...rows])
      setBody('')
    } catch (error) {
      setLog((rows) => [
        { at: Date.now(), who: active.name, text, error: error.message },
        ...rows,
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-6">
      <h1 className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
        Клиент — тест
      </h1>
      <p className="mt-1 text-[13px] text-muted">
        Открой <span className="text-ink">/inbox</span> во второй вкладке.
        Сообщение приходит туда так же, как придёт из WhatsApp.
      </p>

      {/* Which of the two is writing. The app's segmented control, the one the
          inbox filters and the calendar's view switcher both use. */}
      <div className="mt-5 flex items-center gap-0.5 rounded-full bg-ink/6 p-0.5">
        {clients.map((client) => (
          <button
            key={client.id}
            type="button"
            onClick={() => setActiveId(client.id)}
            aria-pressed={client.id === activeId}
            className={`grid h-8 min-w-0 flex-1 place-items-center truncate rounded-full px-3 text-[14px] font-medium outline-none transition-colors ${
              client.id === activeId
                ? 'bg-surface-chip text-ink'
                : 'text-muted hover:text-ink focus-visible:text-ink'
            }`}
          >
            {client.name || client.phone}
          </button>
        ))}
      </div>

      {/* Who this client is. The number is what the thread is keyed on, so
          changing it opens a different conversation — which is the cheapest way
          to add a third client without a third button. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          value={active.name}
          onChange={(event) => edit({ name: event.target.value })}
          placeholder="Имя"
          aria-label="Имя клиента"
          className="h-10 w-full appearance-none rounded-xl bg-surface-card px-3 text-[16px] text-ink outline-none transition-shadow duration-150 placeholder:text-muted focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)] sm:text-[14px]"
        />
        <input
          value={active.phone}
          onChange={(event) => edit({ phone: event.target.value })}
          placeholder="+7 700 000 00 00"
          aria-label="Телефон клиента"
          className="h-10 w-full appearance-none rounded-xl bg-surface-card px-3 text-[16px] text-ink outline-none transition-shadow duration-150 placeholder:text-muted focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)] sm:text-[14px]"
        />
      </div>

      <form onSubmit={send} className="mt-3 flex items-center gap-2">
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t('inbox.composerPlaceholder')}
          aria-label={t('inbox.composerPlaceholder')}
          className="h-10 min-w-0 flex-1 appearance-none rounded-full bg-surface-card px-4 text-[16px] text-ink outline-none transition-shadow duration-150 placeholder:text-muted focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)] sm:text-[14px]"
        />
        <button
          type="submit"
          disabled={!body.trim() || sending}
          className="h-10 shrink-0 rounded-full bg-accent px-4 text-[14px] font-medium text-surface outline-none transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('inbox.send')}
        </button>
      </form>

      {/* What has been sent from this tab, so a message that failed is visible
          rather than merely absent from the other one. */}
      {log.length > 0 && (
        <ul className="mt-6 space-y-1.5">
          {log.map((row) => (
            <li
              key={row.at}
              className={`truncate text-[13px] ${
                row.error ? 'text-danger' : 'text-muted'
              }`}
            >
              <span className="text-ink">{row.who}:</span> {row.text}
              {row.error && ` — ${row.error}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
