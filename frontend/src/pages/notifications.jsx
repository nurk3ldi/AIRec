import { CARD_EDGE } from '../components/card'
import { useT } from '../lib/i18n'
import styles from '../styles/Notifications.module.css'

/**
 * Уведомления из Telegram — одна карточка.
 *
 * Пока пустая: бэкенда уведомлений нет, и наполнять её нечем.
 */
export default function NotificationsPage() {
  const t = useT()

  return (
    <div
      className={`${styles.page} flex flex-col p-4 sm:h-[calc(100vh-68px)] sm:p-6`}
      aria-label={t('notifications.aria')}
    >
      {/* На компьютере на всю высоту экрана; на телефоне у пустой карточки есть
          своя высота, иначе от неё остался бы один заголовок. */}
      <section
        aria-labelledby="notifications-telegram"
        className={`${CARD_EDGE} flex min-h-[240px] flex-1 flex-col p-5 sm:min-h-0`}
      >
        <h2
          id="notifications-telegram"
          className="font-display text-[15px] font-semibold text-ink"
        >
          {t('notifications.telegram')}
        </h2>
      </section>
    </div>
  )
}
