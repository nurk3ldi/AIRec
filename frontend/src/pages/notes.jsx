import { useT } from '../lib/i18n'
import styles from '../styles/Notes.module.css'

/**
 * Заметки — пока пустой экран, место под то, что владелец пишет себе сам.
 *
 * Ни модели, ни эндпоинта под ним ещё нет: `notes` в базе не существует, и
 * `lib/api.js` о них ничего не знает. Маршрут и пункт в навигации заведены
 * первыми, чтобы посмотреть, как экран встаёт в ряд с остальными; содержимое
 * приходит следующим.
 */
export default function NotesPage() {
  const t = useT()

  return <div className={styles.page} aria-label={t('nav.notes')} />
}
