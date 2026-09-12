import { Fragment, useEffect, useState } from 'react'
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

  // **Вторая строка шапки: как с человеком связаться и где.** Номер, а если его
  // нет — `@username`: у клиента из бота номера может не быть вовсе, и пустое
  // место там читалось бы как «не загрузилось». Канал пишется своим именем, а
  // не тем, как он лежит в колонке: «telegram» строчными — это значение поля,
  // «Telegram» — название, и в шапке у читателя второе.
  const contact =
    conversation.client_phone ||
    (conversation.client_username ? `@${conversation.client_username}` : null)

  // **Кроме случая, когда контакт уже стоит в заголовке.** У клиента без имени
  // именем становится его же номер — и строкой ниже он читался дважды, что
  // выглядит не как два факта, а как ошибка. Тогда во второй строке остаётся
  // один канал.
  const details = [contact === title ? null : contact, channelName(conversation.channel)]
    .filter(Boolean)
    .join(' · ')

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
          {/* Всё `ink`, ничего серого: это три факта об одном человеке — кто,
              по какому номеру и через что пишет, — а не подпись к имени. Серый
              здесь означал бы «можно не читать», а читают шапку именно ради
              номера. */}
          <p className="truncate text-[13px] text-ink">{details}</p>
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
            <Fragment key={message.id}>
              {/* **Дата — там, где она сменилась**, и над первым сообщением
                  тоже: разговор, начатый вчера и продолженный сегодня, без неё
                  читается как один непрерывный час. Ровно то же, что делает
                  любой мессенджер, и по той же причине — время в пузыре
                  отвечает «во сколько», а не «когда».

                  По центру и без линий: это не разделитель двух блоков, а
                  подпись к тому, что ниже. Полоса через всю ширину добавила бы
                  к разговору чертёж, которого в нём нет. */}
              {sameDay(messages[index - 1]?.sent_at, message.sent_at) ? null : (
                <p className="py-1 text-center text-[12px] text-muted">
                  {dateLabel(message.sent_at)}
                </p>
              )}

              <Bubble
                message={message}
              // **Аватар — у последнего сообщения подряд идущих, не у каждого.**
              // Четыре кружка в столбик рядом с четырьмя репликами одного
              // человека повторяют то, что уже сказано стороной, и превращают
              // разговор в список карточек. У остальных место под него
              // сохраняется, иначе пузыри в одной серии стояли бы по разным
              // левым краям.
                last={
                  messages[index + 1]?.author !== message.author ||
                  !sameDay(message.sent_at, messages[index + 1]?.sent_at)
                }
              />
            </Fragment>
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
          // 40px — ровно высота пузыря в одну строку (14px текста с
          // `leading-snug` плюс `py-2.5`), и потому кружок стоит вровень с
          // репликой, а не выглядит значком, приставленным сбоку. На длинной
          // реплике пузырь выше — это нормально: кружок держится её низа.
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-chip text-muted ${
            last ? '' : 'invisible'
          }`}
        >
          <HugeiconsIcon icon={UserIcon} size={18} strokeWidth={2} />
        </span>

        <Box message={message} />
      </div>
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
      className={`relative min-w-0 rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug text-ink ${
        mine ? 'bg-surface-chip' : 'bg-surface-card'
      }`}
    >
      <p className="break-words whitespace-pre-wrap">
        {message.body}
        {/* **Пустое место в конце текста, ровно под часы.** Время лежит в
            правом нижнем углу пузыря абсолютно — иначе короткая реплика стала
            бы двухэтажной ради строки с четырьмя цифрами, — а абсолютный
            элемент не раздвигает текст, и длинная последняя строка уехала бы
            под него. Распорка занимает это место в потоке: хватает ширины —
            часы встают в конец той же строки, не хватает — переносится вместе
            с ними, и пузырь честно вырастает. */}
        <span aria-hidden="true" className="inline-block w-12 select-none" />
      </p>

      {/* Ошибка отправки — под текстом, а не вместо него: сообщение было
          написано, и то, что оно не ушло, — второй факт, а не замена первому.
          `pr-12` по той же причине, что и распорка выше. */}
      {message.error && (
        <p className="mt-1 pr-12 text-[12px] text-danger">{message.error}</p>
      )}

      <span className="absolute right-3.5 bottom-2.5 font-display text-[11px] text-muted tabular-nums">
        {clock(message.sent_at)}
      </span>
    </div>
  )
}

/**
 * Канал своим именем.
 *
 * Хранится он строчными — это значение колонки, закрытый набор, который читает
 * код. На экране у него есть имя, и написать его как в базе значит написать
 * название бренда с ошибкой. Неизвестное значение показывается как есть: врать
 * о канале хуже, чем показать сырое слово.
 */
const CHANNELS = { telegram: 'Telegram', whatsapp: 'WhatsApp' }

const channelName = (channel) => CHANNELS[channel] ?? channel

/**
 * Один ли это день — по местному календарю читателя, а не по UTC.
 *
 * `toDateString` даёт «Sat Sep 12 2026» в часовом поясе браузера, и сравнение
 * двух таких строк — это и есть вопрос «тот же день?». Отсутствие даты (первое
 * сообщение в треде) — это «нет», и подпись над ним рисуется.
 */
function sameDay(a, b) {
  if (!a || !b) return false
  const left = new Date(a)
  const right = new Date(b)
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return false
  return left.toDateString() === right.toDateString()
}

/**
 * День словами, на языке интерфейса.
 *
 * С годом, в отличие от `dayLabel` в `lib/dates`: тот подписывает день в
 * календаре, где год известен из того, что на экране, а переписка читается из
 * истории, и «31 августа» без года там — дата, к которой надо подбирать год.
 */
function dateLabel(iso) {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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
