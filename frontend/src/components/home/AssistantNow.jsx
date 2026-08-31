import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { AiScanIcon } from '@hugeicons/core-free-icons'
import { listConversations } from '../../lib/api'
import { authed } from '../../lib/auth'
import { useT } from '../../lib/i18n'
import Skeleton, { SkeletonRegion } from '../Skeleton'
import { useSkeleton } from '../../lib/skeleton'

/**
 * Что ассистент делает прямо сейчас.
 *
 * **Читает настоящие разговоры, а не выдуманные.** `GET /conversations` уже
 * работает; «сейчас» — это `last_message_at` внутри окна, `awaiting_reply` — из
 * того, кто написал последним, `assistant_enabled` — выключен ли он в этой
 * ветке рукой. Ничего из этого не придумано, и поэтому сегодня карточка чаще
 * всего пустая: WhatsApp ещё не подключён, входящих нет. Пустое состояние —
 * честный ответ, выдуманные цифры — нет; аналитику на выдуманных числах в этом
 * проекте уже снимали целиком.
 *
 * **Окно, а не хранимый флаг.** «Активен» нельзя записать в базу: что-то должно
 * его снимать, а снимать некому — ветка, помеченная активной в два часа дня,
 * останется активной и в полночь. Бэкенд считает так же
 * (`conversation_active_minutes`), и `ACTIVE_MINUTES` здесь — то же число.
 *
 * **Опрос, а не push.** В проекте нет ни SSE, ни WebSocket, так что раз в
 * `POLL_MS` карточка спрашивает заново. Пятнадцать секунд — столько, чтобы
 * «сейчас» оставалось правдой, и не столько, чтобы это был поток запросов.
 */

/** Сколько минут после последнего сообщения разговор считается идущим. */
const ACTIVE_MINUTES = 15

const POLL_MS = 15000

const minutesSince = (iso) => (Date.now() - new Date(iso).getTime()) / 60000

export default function AssistantNow({ className = '' }) {
  const t = useT()
  const [chats, setChats] = useState(null)
  const bars = useSkeleton(chats === null)

  useEffect(() => {
    let alive = true

    const read = () => {
      authed((token) => listConversations(token, { archived: false }))
        .then((rows) => alive && setChats(rows))
        // Проглатываем, как и все чтения на экранах: полоса ошибки над пустой
        // карточкой говорит меньше, чем сама пустая карточка, и починка в обоих
        // случаях одна — посмотреть ещё раз.
        .catch(() => alive && setChats([]))
    }

    read()
    const timer = setInterval(read, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  // Идущие разговоры, самый свежий первым. Отменённые окном отсекаются сами:
  // у ветки, где час никто не писал, `minutesSince` больше порога.
  const live = (chats ?? [])
    .filter((row) => row.last_message_at)
    .filter((row) => minutesSince(row.last_message_at) <= ACTIVE_MINUTES)
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))

  const current = live[0] ?? null

  /**
   * Одна строка о том, что происходит.
   *
   * Три состояния, и они про разное: ассистент отвечает сам, ассистент ждёт
   * человека, и не происходит ничего. Четвёртого — «работает» — здесь нет: это
   * не то, чем он занят, а то, что он включён, и такое сообщение не отличает
   * занятого ассистента от простаивающего.
   */
  const state = !current
    ? 'idle'
    : !current.assistant_enabled
      ? 'human'
      : current.awaiting_reply
        ? 'replying'
        : 'waiting'

  return (
    <section
      className={`flex flex-col rounded-2xl bg-surface-raised p-6 ${className}`}
    >
      <div className="flex shrink-0 items-center gap-3">
        {/* Тот же значок, что у «Ассистента» в навигации: одна вещь называется
            одним знаком, иначе на двух экранах это два разных предмета. */}
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-chip text-ink">
          <HugeiconsIcon icon={AiScanIcon} size={22} strokeWidth={1.8} />
        </span>
        <h2 className="min-w-0 truncate font-display text-[15px] font-semibold text-ink">
          {t('nav.assistant')}
        </h2>
      </div>

      {chats === null ? (
        <SkeletonRegion
          label={t('nav.assistant')}
          visible={bars}
          className="mt-6 flex flex-col gap-3"
        >
          <Skeleton className="h-6 w-[70%]" />
          <Skeleton className="h-4 w-[45%]" />
          <Skeleton className="h-3.5 w-full" />
        </SkeletonRegion>
      ) : (
        // Прижато к низу: строка состояния — вывод карточки, а вывод читается
        // с той стороны, где взгляд останавливается, а не сразу под заголовком,
        // где над ним висит пустое место переменной высоты.
        <div className="mt-6 flex min-h-0 flex-1 flex-col justify-end gap-1.5">
          {/* Точка горит, только когда что-то действительно идёт, и цвет у неё
              `--now` — тот же, которым размечено «настоящее время» на сетке
              записей. */}
          <div className="flex items-center gap-2">
            {current && (
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-now"
              />
            )}
            <p className="min-w-0 font-display text-[20px] leading-tight font-semibold text-ink">
              {t(`home.assistant.${state}`)}
            </p>
          </div>

          {current && (
            <p className="min-w-0 truncate text-[15px] text-ink">
              {current.client_name || current.client_phone}
            </p>
          )}

          {/* Последняя реплика — то, чем он занят, сказанное словами. Без неё
              карточка сообщает состояние и не сообщает содержание. */}
          {current?.last_message_preview && (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">
              {current.last_message_preview}
            </p>
          )}

          {live.length > 1 && (
            <p className="mt-1 text-[13px] text-muted">
              {t('home.assistant.more', { count: live.length - 1 })}
            </p>
          )}

          {!current && (
            <p className="text-[13px] leading-relaxed text-muted">
              {t('home.assistant.idleHint')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
