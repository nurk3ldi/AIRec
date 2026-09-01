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
 * **Читает настоящие разговоры.** `GET /conversations` уже работает; «сейчас» —
 * это `last_message_at` внутри окна, `awaiting_reply` — из того, кто написал
 * последним, `assistant_enabled` — выключен ли он в этой ветке рукой.
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

/**
 * ВРЕМЕННО: рисовать ли под знаком строку состояния.
 *
 * Выключено, чтобы посмотреть на один знак посреди карточки. Всё остальное —
 * запрос, окно «сейчас», выбор состояния и сама разметка — на месте; вернуть
 * значит поставить `true`.
 */
const SHOW_STATUS = false

/* --------------------------------------------------------------------------
 * ВРЕМЕННО — УДАЛИТЬ ВМЕСТЕ С ЭТИМ БЛОКОМ.
 *
 * WhatsApp не подключён, входящих сообщений нет, и карточка на настоящих
 * данных пуста — смотреть и спорить не на что. Это три выдуманные ветки, чтобы
 * посмотреть на раскладку. Тот же приём и та же пометка, что у `DEMO_CHATS` в
 * `ChatFeed`.
 *
 * Поставить `null` — и карточка снова читает сервер и рисует честное пустое
 * состояние, которое увидит новый аккаунт.
 * ----------------------------------------------------------------------- */
const minutesAgo = (minutes) =>
  new Date(Date.now() - minutes * 60000).toISOString()

const DEMO_CHATS = [
  {
    id: 'demo-1',
    client_name: 'Айгерим',
    client_phone: '+7 701 555 33 22',
    assistant_enabled: true,
    awaiting_reply: true,
    last_message_at: minutesAgo(1),
    last_message_preview: 'А на четверг в 15:00 есть окно? И сколько будет стоить окрашивание?',
  },
  {
    id: 'demo-2',
    client_name: 'Данияр',
    client_phone: '+7 705 214 87 09',
    assistant_enabled: true,
    awaiting_reply: false,
    last_message_at: minutesAgo(4),
    last_message_preview: 'Записал вас на пятницу, 11:30. Стрижка, 4 000 ₸.',
  },
  {
    id: 'demo-3',
    client_name: null,
    client_phone: '+7 747 908 11 40',
    assistant_enabled: false,
    awaiting_reply: true,
    last_message_at: minutesAgo(9),
    last_message_preview: 'Можно перенести на другой день?',
  },
]
/* ------------------------------------------------------------ конец блока */

const minutesSince = (iso) => (Date.now() - new Date(iso).getTime()) / 60000

export default function AssistantNow({ className = '' }) {
  const t = useT()
  const [fetched, setFetched] = useState(null)
  // Пока стоит демо-блок выше, он и есть источник; убрать его — и остаётся
  // ответ сервера, одной строкой и без правок ниже.
  const chats = DEMO_CHATS ?? fetched
  const bars = useSkeleton(chats === null)

  useEffect(() => {
    let alive = true

    const read = () => {
      authed((token) => listConversations(token, { archived: false }))
        .then((rows) => alive && setFetched(rows))
        // Проглатываем, как и все чтения на экранах: полоса ошибки над пустой
        // карточкой говорит меньше, чем сама пустая карточка, и починка в обоих
        // случаях одна — посмотреть ещё раз.
        .catch(() => alive && setFetched([]))
    }

    read()
    const timer = setInterval(read, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  // Идущие разговоры, самый свежий первым. Остывшие ветки отсекаются сами: у
  // той, где час никто не писал, `minutesSince` больше порога.
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
      {/* **Знак без подложки и без круга.** Тот же `AiScanIcon`, что у
          «Ассистента» в навигации — одна вещь называется одним знаком, иначе на
          двух экранах это два разных предмета, — но здесь он не значок в
          строке, а то, чья это карточка.

          `h-full w-auto` вместо `size` в пикселях: размер берётся от карточки,
          а карточка — от экрана, так что число в пикселях было бы верным ровно
          для одного окна. `max-h`/`max-w` в паре — знак квадратный и упирается
          в ту сторону карточки, которая короче, какой бы ни была пропорция
          окна.

          **В левом верхнем углу, а не посередине.** Середина — место для
          того, что и есть содержание карточки; знак же говорит, чья она, а это
          читается первым и потому стоит там, откуда начинается чтение. Оттуда
          же начнётся всё остальное, что сюда придёт, и знаку не придётся
          переезжать.

          Воздух под ним не остаток, а часть постановки: доходящий до полей
          знак читается как обрезанный.

          **Обводка считается, а не подбирается на глаз.** `strokeWidth` — в
          единицах `viewBox` (24), поэтому на экране она умножается на то, во
          сколько раз знак больше: при стороне около 250px единица — это
          примерно девять пикселей. В навигации знак 23px при `1.8` даёт
          волос в 1.7px; здесь то же оптическое ощущение — это доли единицы, и
          `0.5` рисует тонкую линию вместо жирного контура. Значение ходит
          обратно размеру: чем крупнее знак, тем меньше единиц нужно на ту же
          толщину на экране. */}
      <div className="flex min-h-0 flex-1 items-start justify-start">
        <HugeiconsIcon
          icon={AiScanIcon}
          strokeWidth={0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-full max-h-[54%] w-auto max-w-[54%] text-ink"
        />
      </div>

      {SHOW_STATUS &&
        (chats === null ? (
          <SkeletonRegion
            label={t('nav.assistant')}
            visible={bars}
            className="mt-6 flex shrink-0 flex-col gap-3"
          >
            <Skeleton className="h-6 w-[70%]" />
            <Skeleton className="h-4 w-[45%]" />
            <Skeleton className="h-3.5 w-full" />
          </SkeletonRegion>
        ) : (
          <div className="mt-6 flex shrink-0 flex-col gap-1.5">
            {/* Точка горит, только когда что-то действительно идёт, и цвет у
                неё `--now` — тот же, которым размечено «настоящее время» на
                сетке записей. */}
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
        ))}
    </section>
  )
}
