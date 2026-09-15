import { UserIcon } from '@hugeicons/core-free-icons'
import { clientName } from '../../lib/conversations'
import { getLocale, useT } from '../../lib/i18n'
import { useSkeleton } from '../../lib/skeleton'
import Avatar from '../inbox/Avatar'
import Skeleton, { SkeletonRegion } from '../Skeleton'

/**
 * "3 min ago" in the reader's language. `Intl.RelativeTimeFormat` rather than
 * three hand-written tables, so Kazakh and English come out right on their own.
 */
function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  const format = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' })
  if (seconds < 60) return format.format(0, 'minute')
  if (seconds < 3600) return format.format(-Math.floor(seconds / 60), 'minute')
  if (seconds < 86400) return format.format(-Math.floor(seconds / 3600), 'hour')
  return format.format(-Math.floor(seconds / 86400), 'day')
}

/**
 * The Telegram column's body: one card per unread conversation, laid out from
 * the reference — the client's circle, their name with how long ago against the
 * right edge, the last thing they wrote, and «Посмотреть» under the time.
 *
 * **The whole card is the button, and «Посмотреть» is its label, not a second
 * target.** Both would do the same thing — open that conversation in «Диалоги»
 * — and two presses meaning one action is a row asking which to aim for.
 */
export default function TelegramFeed({ rows, onOpen }) {
  const t = useT()
  const { pending, bars, reveal } = useSkeleton(rows === null)

  if (rows === null || pending) {
    return (
      <SkeletonRegion visible={bars} label={t('notifications.telegram')} className="flex flex-col gap-2 p-2">
        {[0, 1].map((index) => (
          <div key={index} className="flex gap-3 rounded-[10px] bg-ink/5 p-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </SkeletonRegion>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="grid h-full place-items-center px-6 text-center text-[13px] text-muted">
        {t('notifications.telegramEmpty')}
      </p>
    )
  }

  return (
    <ul className={`flex flex-col gap-2 p-2 ${reveal ? 'animate-content-reveal' : ''}`}>
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onOpen(row.id)}
            className="flex w-full gap-3 rounded-[10px] bg-ink/5 p-3 text-left outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-ink/8 focus-visible:bg-ink/8 active:scale-[0.98]"
          >
            <Avatar icon={UserIcon} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-[14px] font-medium text-ink">
                  {clientName(row, t('chat.noName'))}
                </span>
                <span className="ml-auto shrink-0 text-[12px] text-ink">
                  {timeAgo(row.last_message_at)}
                </span>
              </span>
              <span className="mt-0.5 flex items-baseline gap-2">
                <span className="truncate text-[13px] text-muted">
                  {row.last_message_preview}
                </span>
                <span className="ml-auto shrink-0 text-[13px] font-medium text-ink">
                  {t('notifications.view')}
                </span>
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
