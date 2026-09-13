import {
  AnimatePresence,
  domMax,
  LazyMotion,
  m,
  useReducedMotion,
} from 'motion/react'
import { useT } from '../lib/i18n'
import { CROSSFADE, SPRING } from '../lib/motion'
import { chatState, minutesSince, needsHuman } from '../lib/conversations'
import Skeleton, { SkeletonRegion } from './Skeleton'
import { useSkeleton } from '../lib/skeleton'

/*
 * Жил в `components/home/AssistantStreams.jsx` как половина карточки главной.
 * Карточку сняли вместе со всей главной 2026-09-09, а список остался: его
 * показывает правая панель «Диалогов». Переехал сюда, потому что файл, названный
 * по экрану, которого нет, — это указатель в пустоту; здесь же он лежит рядом с
 * остальными общими компонентами, как `CardSkeleton` и `Skeleton`.
 */

/**
 * Сам список потоков, без карточки и заголовка вокруг него.
 *
 * **Вынесен, потому что читателей стало двое.** Тот же список показывает
 * правая панель «Чатов», и там он живёт в другой оболочке: заголовок у неё
 * снаружи карточки и на две ступени крупнее, чтобы совпасть с секциями слева.
 * Общей может быть только середина — две копии этой разметки совпадали бы ровно
 * до первой правки одной из них.
 *
 * **`bleed` — не украшение, а привязка к отступу карточки.** Разделители между
 * строками должны доходить до её краёв, а строки — оставаться внутри отступа;
 * это и делает пара «отрицательный внешний, равный ему внутренний». Значение
 * зависит от `p-*` оболочки, поэтому его задаёт вызывающий, а не список.
 */
export function StreamList({ chats, live, bleed = '-mx-6 px-6', onOpen }) {
  const t = useT()
  const { pending, bars, reveal } = useSkeleton(chats === null)

  return (
    <>
      {chats === null || pending ? (
        // **Заглушка повторяет строку, а не рисует абстрактные полосы.** Те же
        // отступы, та же точка слева, те же две строки с теми же кеглями и
        // разделители между ними: когда приходят данные, на месте каждой полосы
        // встаёт текст, и ничто не сдвигается. Прежние две полосы с зазором 20px
        // были ниже настоящей строки, и список при загрузке «доезжал» вниз.
        <SkeletonRegion
          label={t('home.streams.title')}
          visible={bars}
          className={`mt-2 flex flex-col divide-y divide-line ${bleed}`}
        >
          {[[38, 62], [30, 74], [44, 56]].map(([name, preview], index) => (
            <div key={index} className="flex items-start gap-3 py-3.5">
              <Skeleton className="mt-[7px] h-2 w-2 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3 text-[15px]">
                  <div className="min-w-0 flex-1">
                    <Skeleton
                      className="inline-block h-[0.75em] align-middle"
                      style={{ width: `${name}%` }}
                    />
                  </div>
                  <div className="w-14 shrink-0 text-right text-[13px]">
                    <Skeleton className="inline-block h-[0.75em] w-10 align-middle" />
                  </div>
                </div>
                <div className="mt-0.5 text-[13px]">
                  <Skeleton
                    className="inline-block h-[0.75em] align-middle"
                    style={{ width: `${preview}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </SkeletonRegion>
      ) : live.length === 0 ? (
        // Честный ответ, а не заглушка: сегодня панель чаще всего именно
        // такая — канал не подключён, входящих нет.
        //
        // **Строка, а не абзац, и по центру пустой панели.** Двумя фразами он
        // объяснял то, что уже сказано заголовком над ним, — и стоял в левом
        // верхнем углу, отчего пустая панель читалась как список, у которого
        // не загрузился остаток. Короткая строка в середине — это форма пустого
        // состояния: смотреть не на что, и место, где ничего нет, названо целиком.
        //
        // `m-auto` — обе оси сразу: у колонки flex автоматические поля делят
        // и высоту, и ширину, поэтому ни `justify-center` на родителе, ни
        // отдельного центрирования по горизонтали не нужно.
        <p className="m-auto text-center text-[13px] text-muted">
          {t('home.streams.empty')}
        </p>
      ) : (
        // `min-h-0` рядом с `flex-1` — то, что позволяет списку прокручиваться
        // внутри карточки, а не растить её: элемент flex не сжимается меньше
        // своего содержимого без него.
        // **Строки приходят, уходят и меняются местами — видно.** Список живой:
        // раз в пятнадцать секунд он перечитывается, разговор, где только что
        // написали, поднимается наверх, остывший уходит. Мгновенная перестановка
        // выглядела как список, у которого перепутались строки; здесь новая
        // проявляется, ушедшая гаснет, а остальные доезжают до своих мест.
        //
        // `initial={false}` — открытая панель показывает список целиком, без
        // строк, выезжающих по очереди: анимируется то, что случилось *потом*.
        // `domMax` — ради проекции раскладки, которой в `domAnimation` нет.
        <LazyMotion features={domMax}>
          <ul
            className={`mt-2 min-h-0 flex-1 divide-y divide-line overflow-y-auto ${bleed} ${
              reveal ? 'animate-content-reveal' : ''
            }`}
          >
            <AnimatePresence initial={false}>
              {live.map((chat) => (
                <Row key={chat.id} chat={chat} onOpen={onOpen} />
              ))}
            </AnimatePresence>
          </ul>
        </LazyMotion>
      )}
    </>
  )
}

function Row({ chat, onOpen }) {
  const t = useT()
  const reduce = useReducedMotion()
  const minutes = Math.floor(minutesSince(chat.last_message_at))
  const hot = needsHuman(chat)

  return (
    <m.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      // Переезд — под пониженным движением его нет, прозрачность остаётся: это
      // не путь по экрану, а единственное, что говорит «строка пришла».
      transition={{
        layout: reduce ? { duration: 0 } : SPRING,
        opacity: CROSSFADE.in,
      }}
      className="py-1.5"
    >
      {/* **Строка разговора открывает разговор.** Список показывал, с кем идёт
          переписка прямо сейчас, и на нажатие не отвечал ничем — ряд, который
          выглядит как список чатов и не открывает чат, нарушает то, чего от
          него ждут по любому мессенджеру. Кнопка во всю строку, а подсветка
          выходит за текст на 8px с каждой стороны (`-mx-2 px-2`) и скруглена:
          это строка, которую берут, а не полоса таблицы. Нажатие отвечает сразу
          (`active:`), и тред открывается в той же правой колонке — вместо
          этого списка. */}
      <button
        type="button"
        onClick={onOpen ? () => onOpen(chat.id) : undefined}
        disabled={!onOpen}
        className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-xl px-2 py-2 text-left outline-none transition-[background-color,scale] duration-[160ms] ease-out enabled:hover:bg-ink/6 enabled:focus-visible:bg-ink/6 enabled:active:scale-[0.99] enabled:active:bg-ink/12 disabled:cursor-default"
      >
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
          {/* **Три ступени, а не две, и третью добавил Telegram.** На WhatsApp
              номер есть всегда, поэтому «имя, иначе номер» покрывало всё. У
              клиента в Telegram номера может не быть вовсе — там опознаётся
              `@username`, и он встаёт между ними. Если нет и его, строка была
              бы пустой, а пустая строка в списке читается как сломанный экран:
              последнее слово — честное «без имени». */}
          <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
            {chat.client_name ||
              (chat.client_username ? `@${chat.client_username}` : null) ||
              chat.client_phone ||
              t('chat.noName')}
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
      </button>
    </m.li>
  )
}
