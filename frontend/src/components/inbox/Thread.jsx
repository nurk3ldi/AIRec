import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  UserIcon,
} from '@hugeicons/core-free-icons'
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
          {messages.map((message, index) => (
            <Bubble
              key={message.id}
              message={message}
              // **Аватар — у последнего сообщения подряд идущих, не у каждого.**
              // Четыре кружка в столбик рядом с четырьмя репликами одного
              // человека повторяют то, что уже сказано стороной, и превращают
              // разговор в список карточек. У остальных место под него
              // сохраняется, иначе пузыри в одной серии стояли бы по разным
              // левым краям.
              last={messages[index + 1]?.author !== message.author}
            />
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
function Bubble({ message, last = true }) {
  const t = useT()
  const mine = message.author !== 'client'

  if (mine) {
    return (
      <div className="flex max-w-[86%] flex-col gap-1 self-end">
        <span className="text-right text-[11px] font-medium tracking-wide text-muted uppercase">
          {t(`thread.author.${message.author}`)}
        </span>
        <Box message={message} mine />
        <span className="text-right font-display text-[11px] text-muted tabular-nums">
          {clock(message.sent_at)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex max-w-[86%] flex-col gap-1">
      {/* **Аватар в одной строке с пузырём, а не со всей колонкой.** Время
          стоит ниже, и выровненный по низу колонки кружок оказывался рядом с
          часами — подписью, а не репликой. Здесь он держится низа самого
          пузыря, как во всех мессенджерах: серия читается сверху вниз, и
          кружок там, где она кончилась. */}
      <div className="flex items-end gap-2">
        {/* **Внутри — значок профиля, а не буква имени.** Клиент из бота часто
            вообще без имени, и «Б» от «Без имени» была бы подписью под тем,
            чего нет; нейтральный силуэт честно говорит «человек, фотографии
            нет». `shrink-0`, иначе длинная реплика сплющит его в овал.

            `invisible`, а не отсутствие: место держится у всей серии, иначе
            пузыри одного человека встали бы по разным левым краям. */}
        <span
          aria-hidden="true"
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-chip text-muted ${
            last ? '' : 'invisible'
          }`}
        >
          <HugeiconsIcon icon={UserIcon} size={15} strokeWidth={2} />
        </span>

        <Box message={message} />
      </div>

      {/* Под пузырём, а не под кружком: 28px аватара плюс 8px зазора — это те
          самые `pl-9`, которыми время встаёт по левому краю реплики. */}
      <span className="pl-9 font-display text-[11px] text-muted tabular-nums">
        {clock(message.sent_at)}
      </span>
    </div>
  )
}

/**
 * Сам пузырь — один на обе стороны.
 *
 * Написан один раз и различается только заливкой: две копии текста и ошибки
 * совпадали бы ровно до первой правки одной из них.
 *
 * `surface-card`, а не `surface-raised`: пузырь лежит *на* панели, а не на
 * странице, и это ровно та разница, ради которой токен заведён.
 */
function Box({ message, mine = false }) {
  return (
    <div
      className={`min-w-0 rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug text-ink ${
        mine ? 'bg-surface-chip' : 'bg-surface-card'
      }`}
    >
      <p className="break-words whitespace-pre-wrap">{message.body}</p>
      {/* Ошибка отправки — под текстом, а не вместо него: сообщение было
          написано, и то, что оно не ушло, — второй факт, а не замена первому. */}
      {message.error && (
        <p className="mt-1 text-[12px] text-danger">{message.error}</p>
      )}
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
