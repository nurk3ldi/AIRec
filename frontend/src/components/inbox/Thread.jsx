import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { listMessages, markConversationRead } from '../../lib/api'
import { authed } from '../../lib/auth'
import { getLocale, useT } from '../../lib/i18n'
import { useSkeleton } from '../../lib/skeleton'
import Skeleton, { SkeletonRegion } from '../Skeleton'

/**
 * Одна переписка, прочитанная целиком.
 *
 * **Открывается не окном.** Разговор — это содержимое, которое читают и
 * сравнивают с тем, что рядом, а не задача, в которую входят и из которой
 * выходят; модальное окно погасило бы список и сделало бы переход к соседнему
 * треду парой «закрыть — открыть». Поэтому на широком экране это правая
 * колонка рядом со списком (`onClose` — крестик в её шапке), а на узком —
 * экран, приезжающий справа, с кнопкой «назад» (`onBack`), и уезжающий тем же
 * путём. Оба поведения — снаружи, в `/inbox`: здесь только то, что внутри.
 *
 * **Только чтение, и это не полуфабрикат.** Поле ввода — отдельное решение со
 * своими последствиями: отправленное сообщение выключает ассистента в этой
 * ветке (`ConversationService.add_message`), а значит ответ рукой должен быть
 * осознанным действием, а не тем, что случилось, потому что курсор стоял в
 * поле. Пока экран отвечает на вопрос «о чём договорились», и отвечает целиком.
 *
 * **Кто сказал — подписью, а не только стороной.** Клиент слева, свои справа —
 * этого хватает, чтобы читать, и не хватает, чтобы отличить ассистента от
 * владельца, а разница тут главная: одно написал робот, другое — человек,
 * который в этот момент вмешался.
 */
export default function Thread({ conversation, onClose, onBack, className = '' }) {
  const t = useT()
  const [messages, setMessages] = useState(null)
  const { pending, bars } = useSkeleton(messages === null)

  const id = conversation?.id

  useEffect(() => {
    if (!id) return undefined

    let alive = true
    setMessages(null)
    authed((token) => listMessages(token, id))
      .then((rows) => alive && setMessages(rows))
      // Глотаем, как и все чтения на экранах: полоса ошибки над пустым тредом
      // говорит меньше, чем сам пустой тред, а починка одна — открыть ещё раз.
      .catch(() => alive && setMessages([]))

    // Открыть разговор — и значит прочитать его. Ответ никого не интересует:
    // счётчик непрочитанного обновится со следующим чтением списка, а неудача
    // здесь не повод что-то показывать.
    authed((token) => markConversationRead(token, id)).catch(() => {})

    return () => {
      alive = false
    }
  }, [id])

  if (!conversation) return null

  const title =
    conversation.client_name ||
    (conversation.client_username ? `@${conversation.client_username}` : null) ||
    conversation.client_phone ||
    t('chat.noName')

  return (
    <section className={`flex min-h-0 flex-col ${className}`}>
      {/* Шапка: кто, и как отсюда выйти. На широком экране выход — крестик
          (панель остаётся на месте, список рядом), на узком — стрелка назад
          (экран уезжает туда, откуда приехал). Ровно один из двух: два способа
          выйти из одного места — это вопрос, который экран задаёт читателю. */}
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-5 py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('thread.back')}
            className="-ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink outline-none transition-[background-color,scale] duration-[160ms] ease-out hover:bg-ink/8 focus-visible:bg-ink/8 active:scale-[0.95]"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={2} />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ink">{title}</p>
          {/* Второй строкой — то, чем эта ветка отличается от других: канал и
              то, что писать отсюда нельзя. Без неё пустое поле внизу читалось бы
              как «поле ввода не загрузилось». */}
          <p className="truncate text-[12px] text-muted">
            {conversation.channel} · {t('thread.readOnly')}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('thread.close')}
            className="-mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted outline-none transition-[color,background-color,scale] duration-[160ms] ease-out hover:bg-ink/8 hover:text-ink focus-visible:bg-ink/8 focus-visible:text-ink active:scale-[0.95]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
          </button>
        )}
      </header>

      {pending ? (
        <SkeletonRegion
          label={title}
          visible={bars}
          className="flex min-h-0 flex-1 flex-col gap-3 p-5"
        >
          {/* Чередуются стороны: тред — это разговор, и заглушка, где все
              полосы слева, обещает не то, что придёт. */}
          {[0, 1, 2, 3].map((index) => (
            <Skeleton
              key={index}
              className={`h-12 w-[62%] rounded-2xl ${index % 2 ? 'self-end' : ''}`}
            />
          ))}
        </SkeletonRegion>
      ) : messages.length === 0 ? (
        <p className="m-auto px-5 text-center text-[13px] text-muted">
          {t('thread.empty')}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
          {messages.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Одно сообщение.
 *
 * **Сторона говорит о направлении, подпись — об авторе.** Слева пришедшее,
 * справа своё; и раз своё пишут двое, подпись стоит только над ним — над
 * клиентским она сообщала бы то, что уже сказано стороной и именем в шапке.
 *
 * `surface-card`, а не `surface-raised`: пузырь лежит *на* панели, а не на
 * странице, и это ровно та разница, ради которой токен заведён.
 */
function Bubble({ message }) {
  const t = useT()
  const mine = message.author !== 'client'

  return (
    <div className={`flex max-w-[86%] flex-col gap-1 ${mine ? 'self-end' : ''}`}>
      {mine && (
        <span
          className={`text-[11px] font-medium tracking-wide text-muted uppercase ${
            mine ? 'text-right' : ''
          }`}
        >
          {t(`thread.author.${message.author}`)}
        </span>
      )}

      <div
        className={`rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${
          mine ? 'bg-surface-chip text-ink' : 'bg-surface-card text-ink'
        }`}
      >
        <p className="break-words whitespace-pre-wrap">{message.body}</p>
        {/* Ошибка отправки — под текстом, а не вместо него: сообщение было
            написано, и то, что оно не ушло, — второй факт, а не замена первому. */}
        {message.error && (
          <p className="mt-1 text-[12px] text-danger">{message.error}</p>
        )}
      </div>

      <span
        className={`font-display text-[11px] text-muted tabular-nums ${
          mine ? 'text-right' : ''
        }`}
      >
        {clock(message.sent_at)}
      </span>
    </div>
  )
}

/** Час и минуты в языке интерфейса — дата у треда общая, она в списке. */
function clock(iso) {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleTimeString(getLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  })
}
