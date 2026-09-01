import { useT } from '../../lib/i18n'
import { chatState, minutesSince, needsHuman } from '../../lib/conversations'
import Skeleton, { SkeletonRegion } from '../Skeleton'
import { useSkeleton } from '../../lib/skeleton'

/**
 * Все разговоры, которые ассистент ведёт прямо сейчас — по строке на каждый.
 *
 * **Карточка рядом отвечает, чем он занят; эта — чем именно.** Там одна громкая
 * строка о состоянии и число веток в подписи, здесь сами ветки: кто, что с ней
 * происходит, что было сказано последним и как давно. Поэтому текст реплики
 * живёт тут и только тут — в колонке шириной в треть экрана он забивал бы
 * композицию, а на ширине в две трети это ровно то, за чем сюда смотрят.
 *
 * **Точка слева, а не аватар.** Кружок с буквой убрали ещё в «Диалогах»: он
 * ничего не добавляет к имени, которое стоит рядом, и делает список тяжелее.
 *
 * **Цвет достаётся одному состоянию.** `--now` горит там, где ассистент
 * выключен, то есть разговор держится на человеке; остальные строки серые. Если
 * покрасить все, цвет перестаёт что-либо значить — то же правило, по которому
 * на сетке записей окрашены два статуса из четырёх, а не все.
 *
 * **Порядок — по свежести, и только.** «Требующие вас наверх» — вторая
 * сортировка в одном списке, а два правила упорядочивания читатель вынужден
 * держать в голове одновременно.
 *
 * **Строки пока не нажимаются.** Открывать ветку некуда: `/inbox` временно
 * скрыт. Кнопка, которая ничего не делает, — мёртвый элемент управления, так
 * что строка остаётся строкой, пока экрану есть куда вести.
 */
export default function AssistantStreams({ chats, live, className = '' }) {
  const t = useT()
  const bars = useSkeleton(chats === null)

  return (
    <section
      className={`flex flex-col rounded-2xl bg-surface-raised p-6 ${className}`}
    >
      <h2 className="shrink-0 font-display text-[15px] font-semibold text-ink">
        {t('home.streams.title')}
        {live.length > 0 && (
          <span className="font-normal text-muted"> · {live.length}</span>
        )}
      </h2>

      {chats === null ? (
        <SkeletonRegion
          label={t('home.streams.title')}
          visible={bars}
          className="mt-5 flex flex-col gap-5"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-[35%]" />
              <Skeleton className="h-3 w-[70%]" />
            </div>
          ))}
        </SkeletonRegion>
      ) : live.length === 0 ? (
        // Честный ответ, а не заглушка: сегодня карточка чаще всего именно
        // такая — WhatsApp не подключён, входящих нет.
        <p className="mt-5 max-w-[42ch] text-[13px] leading-relaxed text-muted">
          {t('home.streams.empty')}
        </p>
      ) : (
        // `min-h-0` рядом с `flex-1` — то, что позволяет списку прокручиваться
        // внутри карточки, а не растить её: элемент flex не сжимается меньше
        // своего содержимого без него.
        <ul className="-mx-6 mt-2 min-h-0 flex-1 divide-y divide-line overflow-y-auto px-6">
          {live.map((chat) => (
            <Row key={chat.id} chat={chat} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Row({ chat }) {
  const t = useT()
  const minutes = Math.floor(minutesSince(chat.last_message_at))
  const hot = needsHuman(chat)

  return (
    <li className="flex items-start gap-3 py-3.5">
      {/* Приподнята на пиксель-другой: точка выравнивается по строке с именем,
          а не по верхнему краю блока из двух строк. */}
      <span
        aria-hidden="true"
        className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${
          hot ? 'bg-now' : 'bg-muted/40'
        }`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
            {chat.client_name || chat.client_phone}
          </p>
          <p
            className={`shrink-0 text-[13px] ${hot ? 'text-now' : 'text-muted'}`}
          >
            {t(`home.assistant.${chatState(chat)}`)}
          </p>
          {/* `tabular-nums`, чтобы столбец времени не дёргался при каждом
              опросе, когда «9 мин» сменяется на «10 мин». */}
          <p className="w-14 shrink-0 text-right text-[13px] text-muted tabular-nums">
            {minutes < 1
              ? t('home.streams.now')
              : t('home.streams.minutes', { count: minutes })}
          </p>
        </div>

        {chat.last_message_preview && (
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {/* Кто сказал последнюю реплику — половина её смысла: «записал вас
                на четверг» от ассистента и от клиента значат разное. */}
            {chat.last_message_author === 'client' ? '' : t('home.streams.said')}
            {chat.last_message_preview}
          </p>
        )}
      </div>
    </li>
  )
}
