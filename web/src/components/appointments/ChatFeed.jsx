import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { listConversations } from '../../lib/api'
import { authed } from '../../lib/auth'
import { liveChats } from '../../lib/conversations'
import { useT } from '../../lib/i18n'
import { StreamList } from '../StreamList'

/**
 * «Диалоги» под календарём на «Записях» — разговоры, которые идут прямо сейчас.
 *
 * **Тот же список, что «Потоки» на «Диалогах»** (`StreamList`): аватар клиента,
 * последняя реплика, время и что делает ассистент. Два разных рисунка одного и
 * того же разговора разошлись бы при первой правке одного из них. «Идут прямо
 * сейчас» — это `liveChats`, то же окно, что и там.
 *
 * Читает `GET /conversations` сам (архив и корзина — нет) при появлении и раз
 * в пятнадцать секунд, пока вкладка видна; неудачное чтение оставляет то, что
 * на экране. Строка открывает разговор на «Диалогах».
 */
export default function ChatFeed({ className = '' }) {
  const t = useT()
  const navigate = useNavigate()
  const [chats, setChats] = useState(null)

  useEffect(() => {
    let alive = true
    const read = () => {
      if (document.visibilityState !== 'visible') return
      authed((token) => listConversations(token, { archived: false, deleted: false }))
        .then((rows) => alive && setChats(rows))
        .catch(() => alive && setChats((was) => was ?? []))
    }
    read()
    const timer = setInterval(read, POLL_MS)
    document.addEventListener('visibilitychange', read)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', read)
    }
  }, [])

  return (
    <section
      className={`min-h-0 flex-1 flex-col ${className}`}
      aria-label={t('nav.inbox')}
    >
      {/* The heading and the way out of it, on one line. «Все» goes to the
          screen this is a window onto, so the feed never grows a "show more". */}
      <header className="flex shrink-0 items-center justify-between gap-2 pb-2">
        <h2 className="font-display text-[15px] font-semibold text-ink">
          {t('nav.inbox')}
        </h2>
        <Link
          to="/inbox"
          className="flex items-center gap-0.5 rounded-lg py-1 text-[13px] text-muted outline-none transition-colors hover:text-ink focus-visible:text-ink"
        >
          {t('chat.all')}
          <HugeiconsIcon icon={ArrowRight01Icon} size={15} strokeWidth={2} />
        </Link>
      </header>

      <StreamList
        chats={chats}
        live={liveChats(chats)}
        bleed="-mx-2 px-2"
        onOpen={(id) => navigate(`/inbox?chat=${id}`)}
      />
    </section>
  )
}

/** Как часто список перечитывается — тот же ритм, что у карточек главной. */
const POLL_MS = 15000
