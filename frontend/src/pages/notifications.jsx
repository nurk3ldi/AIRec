import { HugeiconsIcon } from '@hugeicons/react'
import { Notification01Icon } from '@hugeicons/core-free-icons'
import { useT } from '../lib/i18n'
import styles from '../styles/Notifications.module.css'

export default function NotificationsPage() {
  const t = useT()

  return (
    <>
      <div className={styles.page} aria-label={t('notifications.aria')}>
        {/* An empty state rather than a "скоро" placeholder: a new account
            genuinely has nothing here, so this is what it will look like even
            once the feature is wired up. */}
        <div className="mx-auto max-w-[440px] px-6 py-24 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface text-muted">
            <HugeiconsIcon
              icon={Notification01Icon}
              size={24}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.9}
            />
          </div>

          <p className="mt-4 text-[15px] font-medium text-ink">
            {t('notifications.empty')}
          </p>
          <p className="mt-1.5 text-[14px] text-muted">
            {t('notifications.emptyLead')}
          </p>
        </div>
      </div>
    </>
  )
}
