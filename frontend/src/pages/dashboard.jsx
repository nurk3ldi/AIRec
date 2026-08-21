import { useT } from '../lib/i18n'
import styles from '../styles/Dashboard.module.css'

/**
 * Главная — пусто, страница проектируется заново.
 *
 * Здесь была аналитика по образцу `design/main_page.png`: недельный график,
 * 2×2 метрик, воронка, разбивка по услугам и таблица записей — всё на
 * выдуманных числах, поскольку агрегирующих эндпоинтов ещё нет. Снята
 * 2026-08-21 и есть в истории git.
 *
 * Это домашний экран после входа, а не `/` — по тому адресу лендинг.
 */
export default function DashboardHomePage() {
  const t = useT()

  return <div className={styles.page} aria-label={t('nav.dashboard')} />
}
