import { HugeiconsIcon } from '@hugeicons/react'
import { Notification01Icon } from '@hugeicons/core-free-icons'
import styles from '../styles/Notifications.module.css'

export default function NotificationsPage() {
  return (
    <>
      <div className={styles.page} aria-label="Страница уведомлений">
        {/* An empty state rather than a "скоро" placeholder: a new account
            genuinely has nothing here, so this is what it will look like even
            once the feature is wired up. */}
        <div className="mx-auto max-w-[440px] px-6 py-24 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-[#999999]">
            <HugeiconsIcon
              icon={Notification01Icon}
              size={24}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.9}
            />
          </div>

          <p className="mt-4 text-[15px] font-medium text-[#171215]">
            Пока нет уведомлений
          </p>
          <p className="mt-1.5 text-[14px] text-[#999999]">
            Здесь появятся новые записи, отменённые брони и диалоги, в которых
            ассистенту нужна ваша помощь.
          </p>
        </div>
      </div>
    </>
  )
}
