import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { listMessages, markConversationRead, mediaUrl } from '../../lib/api'
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
  const list = useRef(null)
  // Держится ли чтение низа. Пока держится — каждая доехавшая картинка
  // возвращает нас туда; стоит уехать вверх, и ничто больше не дёрнет экран
  // обратно. Ref, а не состояние: это не то, что рисуется, и перерисовка на
  // каждый пиксель прокрутки была бы платой ни за что.
  const pinned = useRef(true)
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

  /**
   * Открывается на последнем сообщении, а не на первом.
   *
   * **Это и есть «прокрутка» в жалобе на её отсутствие.** Контейнер прокручивался
   * и раньше, но тред длиной в неделю открывался на «/help», отправленном в
   * понедельник, а сегодняшний разговор лежал в полутора тысячах пикселей ниже —
   * экран выглядел так, будто ничего нового в нём нет. Мессенджер открывает
   * переписку там, где она кончилась, и по той же причине: читают последнее.
   *
   * `useLayoutEffect`, а не `useEffect`: прокрутка до кадра, иначе первый кадр
   * покажет начало переписки и дёрнется. Мгновенно, без плавности — низ это не
   * место, куда экран едет, а место, где он начинается.
   *
   * **В зависимостях и `pending`, и это не лишнее.** Пока держится скелет,
   * списка в DOM ещё нет: сообщения уже пришли, `list.current` пустой, и
   * прокручивать нечего. Список появляется, когда скелет уходит, — то есть по
   * смене `pending`, а не `messages`.
   */
  const stick = () => {
    const box = list.current
    if (box && pinned.current) box.scrollTop = box.scrollHeight
  }

  useLayoutEffect(() => {
    pinned.current = true
    stick()
  }, [messages, pending])

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

        {/* **Одной строкой: кто, по какому номеру и через что пишет.** Три
            факта об одном человеке, а не заголовок с подписью под ним — в две
            строки они читались как разные уровни, хотя равны: номер нужен не
            реже имени. Всё `ink`, ничего серого: серый означал бы «можно не
            читать», а шапку читают именно ради номера.

            Имя весом, остальное — нет: вес отделяет его от номера там, где
            цвет и кегль у всех одни. `truncate` на всей строке, потому что
            узкая панель обрежет её с конца — с того, что известно и без неё
            (канал), а не с имени. */}
        <p className="min-w-0 flex-1 truncate text-[14px] text-ink">
          <span className="font-medium">{title}</span>
          {details && ` · ${details}`}
        </p>

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
        <div
          ref={list}
          // **Низ «держится», пока читатель сам не уехал вверх.** Фотография
          // приходит после разметки и делает тред выше — прокрутка, сделанная
          // до неё, оказывается посреди переписки, и экран, только что
          // открытый на последнем сообщении, показывает позапрошлое. 40px
          // запаса: «почти низ» — это тоже низ, и попиксельное равенство
          // отказывало бы на дробных высотах.
          onScroll={(event) => {
            const box = event.currentTarget
            pinned.current =
              box.scrollHeight - box.scrollTop - box.clientHeight < 40
          }}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5"
        >
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
                onPhoto={stick}
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
function Bubble({ message, last = true, onPhoto }) {
  const t = useT()
  const mine = message.author !== 'client'

  if (mine) {
    return (
      <div className="flex max-w-[86%] flex-col gap-1 self-end">
        <span className="text-right text-[11px] font-medium tracking-wide text-muted uppercase">
          {t(`thread.author.${message.author}`)}
        </span>
        <Box message={message} mine onPhoto={onPhoto} />
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

        <Box message={message} onPhoto={onPhoto} />
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
const PHOTO_PLACEHOLDER = '[фото]'

function Box({ message, mine = false, onPhoto }) {
  const photo = mediaUrl(message.media_url)
  const body = message.body?.trim() ?? ''
  const caption = photo && body === PHOTO_PLACEHOLDER ? null : message.body

  // **Фотография без подписи — это сама фотография, без пузыря под ней.**
  // Заливка и отступы существуют ради текста: они дают словам поле, на котором
  // их видно. У снимка поле своё, и рамка вокруг него — это рамка вокруг рамки,
  // из-за которой картинка в треде выглядит вложением, а не сообщением.
  if (photo && !caption) {
    return (
      <div className="group/photo relative w-fit">
        <img
          src={photo}
          alt=""
          onLoad={onPhoto}
          className="max-h-[320px] max-w-full rounded-2xl"
        />

        {/* **Время появляется, когда на снимок наводят.** Постоянная плашка на
            фотографии — это чужие цифры поверх чьего-то лица; здесь она нужна
            раз в сто просмотров, и ровно тогда её и видно.

            Чёрная подложка и белый текст литералами, а не токенами: под ними
            не тема приложения, а фотография, и «ink на surface» там означало бы
            на светлой теме чёрные цифры на тёмном снимке.

            `[@media(hover:none)]` — вторая половина: на телефоне наводить
            нечем, и правило `hover:` там мертво, так что время просто видно
            всегда. Пропадает оно ради снимка, а не ради экономии. */}
        <span className="pointer-events-none absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 font-display text-[11px] text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 ease-out tabular-nums group-hover/photo:opacity-100 [@media(hover:none)]:opacity-100">
          {clock(message.sent_at)}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`relative min-w-0 rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug text-ink ${
        mine ? 'bg-surface-chip' : 'bg-surface-card'
      }`}
    >
      {/* **Фотография — это и есть сообщение, а не вложение к нему.** Поэтому
          она стоит первой и во всю ширину пузыря, а текст под ней: у снимка,
          присланного в чат, подпись почти всегда объясняет его («вот такую
          стрижку»), а не наоборот.

          `max-h`, а не только ширина: вертикальный снимок с телефона иначе
          занял бы весь тред собой одним. Размеры заданы и в атрибутах — до
          загрузки они держат место, и пузырь не подпрыгивает, когда картинка
          приходит.

          `-mx-1 -mt-1`: съедает часть внутреннего отступа пузыря, чтобы
          картинка не выглядела вставленной в рамку из воздуха. */}
      {photo && (
        <img
          src={photo}
          alt={message.body}
          // Не `lazy`: тред открывается на последнем сообщении, и отложенная
          // картинка меняет высоту уже после прокрутки. `onLoad` — вторая
          // половина того же: доехав, она просит вернуть низ на место.
          onLoad={onPhoto}
          // **Картинка сама задаёт свой размер, а не вписывается в ширину.**
          // `w-full` с `object-cover` резал вертикальный снимок посередине — а
          // открыть его в полный рост здесь негде, экран только читают. Так
          // пузырь принимает форму фотографии: горизонтальная занимает ширину,
          // вертикальная — высоту, и обе видны целиком.
          className="-mx-1 -mt-1 mb-1.5 max-h-[320px] max-w-full rounded-xl"
        />
      )}

      {/* **Под фотографией — подпись, а не слово «[фото]».** Плейсхолдер нужен
          там, где картинку показать нельзя: в поиске по тексту и в строке
          превью у списка тредов. В пузыре картинка уже есть, и повторять её
          словом — это подпись «фотография» под фотографией. Сравнение с
          литералом хрупко ровно настолько, насколько не страшно: разойдётся —
          вернётся лишняя строка, а не пропадёт сообщение. */}
      <p className="break-words whitespace-pre-wrap">
        {caption}
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

      {/* **Часы лежат на тексте, а не на фотографии.** Абсолютный угол пузыря
          хорош, пока под ним слова: там для часов оставлено место распоркой.
          У снимка без подписи слов нет — угол пузыря это угол картинки, и
          время оказывалось поверх неё, на чём придётся. Тогда оно встаёт
          обычной строкой под ней: пузырь вырастает на одиннадцать пикселей,
          и это дешевле, чем цифры на чужом лице. */}
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
