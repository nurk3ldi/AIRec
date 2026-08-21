import { useT } from '../lib/i18n'
import styles from '../styles/Inbox.module.css'

/**
 * Диалоги — пусто. Здесь будут переписки, которые ассистент ведёт в WhatsApp;
 * ни канала, ни таблицы сообщений на бэкенде пока нет.
 */
export default function InboxPage() {
  const t = useT()

  return <div className={styles.page} aria-label={t('nav.inbox')} />
}
