import { useT } from '../lib/i18n'
import styles from '../styles/Dashboard.module.css'

/**
 * «Все уведомления» — the full list the header's window is a glance at.
 *
 * Empty for now, and reached only from the window's «Все уведомления» button:
 * the bell opens the window, the window leads here. It borrows the dashboard's
 * page module because the page ground is all it draws yet.
 */
export default function NotificationsPage() {
  const t = useT()
  return <div className={styles.page} aria-label={t('nav.notifications')} />
}
