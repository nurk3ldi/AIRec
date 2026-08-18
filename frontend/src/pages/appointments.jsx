import styles from '../styles/Appointments.module.css'

/**
 * Записи — пусто, пока строится третий вариант.
 *
 * Второй (календарь на месяц) снят 2026-08-18 и лежит целиком в
 * `src/archive/appointments-v2/` — там же README с тем, как вернуть его одной
 * командой. Первый — сутки прокручиваемой шкалой — остался в коммите `1e0c045`.
 *
 * Маршрут держим живым, а не убираем: пункт «Записи» есть в боковой панели, и
 * пустая страница честнее, чем ссылка, ведущая в 404.
 */
export default function AppointmentsPage() {
  return <div className={styles.page} aria-label="Записи" />
}
