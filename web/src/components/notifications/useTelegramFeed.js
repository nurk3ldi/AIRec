import { useEffect, useState } from 'react'
import { listConversations } from '../../lib/api'
import { authed } from '../../lib/auth'

/** How often the open window re-reads — the header's own rhythm for chats. */
const POLL_MS = 15000

/**
 * What the Telegram column holds: conversations from Telegram with something
 * the owner has not read, newest first. `null` until the first answer.
 *
 * **Unread, not "every Telegram chat".** A notification is something that has
 * not been seen; opening the thread (`markConversationRead`) is what clears it,
 * so a conversation leaves this column exactly when it would stop being news.
 * Archive and bin are not asked, the same rule the bell's dot keeps.
 *
 * **Read only while the window is open**, and again every 15 seconds while it
 * stays open: a list nobody is looking at is traffic for nothing.
 */
export function useTelegramFeed(open) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    const read = () =>
      authed((token) =>
        listConversations(token, { archived: false, deleted: false, limit: 100 }),
      )
        .then((all) => {
          if (!alive) return
          setRows(
            all
              .filter((row) => row.channel === 'telegram' && row.unread_count > 0)
              .sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at)),
          )
        })
        // Keep the last answer on a failed read rather than emptying a list
        // somebody is reading.
        .catch(() => alive && setRows((was) => was ?? []))
    read()
    const timer = setInterval(read, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [open])

  return rows
}
