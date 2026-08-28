import { useT } from '../lib/i18n'
import styles from '../styles/Inbox.module.css'

/**
 * Диалоги — **paused, and deliberately blank.**
 *
 * The screen was built and works: a list beside a thread, search, the archive
 * filter, pinning, the row menu, the transcript, and the switch that stops the
 * assistant in one conversation. What it has nothing to show is messages —
 * WhatsApp is not connected, and connecting it is work that starts on the
 * backend: `Business` needs the WhatsApp phone id a webhook can be routed by,
 * and `POST /conversations/ingest` is authenticated as the owner where a
 * webhook has no owner. Rather than leave a finished screen in front of an
 * empty product, it waits here.
 *
 * **The screen itself was not deleted.** `components/inbox/ChatRow.jsx` and
 * `components/inbox/Thread.jsx` are where they were and the conversation
 * endpoints are still in `lib/api.js`, so putting it back is restoring this
 * file out of git history — the same way `/dashboard` and `/business` are
 * waiting. The `/dev/client` console that wrote test messages into the inbox
 * *was* removed and is in history too; it is one file plus a route.
 *
 * The route stays registered, rendering a bare ground: the navigation has a
 * «Диалоги» item, and an empty page is an honest answer where a 404 is not.
 */
export default function InboxPage() {
  const t = useT()

  return <div className={styles.page} aria-label={t('nav.inbox')} />
}
