import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getWhatsApp, listConversations, markConversationRead } from '../lib/api'
import { authed } from '../lib/auth'
import { useT } from '../lib/i18n'
import { useRemembered } from '../lib/viewState'
import ChatCard from '../components/inbox/ChatCard'
import Thread from '../components/inbox/Thread'
import styles from '../styles/Inbox.module.css'

/**
 * Диалоги — разговоры с клиентами, на настоящих данных.
 *
 * **Экран стоял пустым ровно до этого дня, и по одной причине: входящих не
 * было.** Вебхука WhatsApp не существовало, исходящего канала тоже, подписи
 * Meta никто не проверял, а `POST /conversations/ingest` был авторизован
 * владельцем — не то место, куда приходит вебхук. Теперь всё это есть:
 * `/webhooks/whatsapp` проверяет HMAC над сырым телом и заводит ветку,
 * `POST /conversations/{id}/messages` сначала записывает, потом отправляет, а
 * квитанции о доставке доходят обратно. Две прежние версии экрана целы в
 * истории git (коммиты `2702991` и `88385af`); эта не унаследовала от них
 * ничего, кроме карточки.
 *
 * **Список и открытая ветка рядом, а не ветка в модалке.** Инбокс — это список
 * и то, о чём он: так устроен `/appointments`, так устроен любой мессенджер, и
 * так не нужна ни одна из деталей диалога — ни затемнение, ни ловушка фокуса,
 * ни вторая схема анимации. На телефоне двум колонкам места нет, поэтому ветка
 * подменяет собой сетку.
 *
 * **Высота у страницы определённая, а не минимальная.** Переписка обязана
 * прокручиваться внутри себя, а `min-height` даёт контейнеру неопределённый
 * поперечный размер: `flex-1` внутри тогда ничего не наследует, и колонка
 * растёт по содержимому вместо того, чтобы уместиться в экран. Числа те же, что
 * в модуле, но записаны как настоящая высота — 68px шапки и 50px нижней панели
 * с индикатором дома под ней.
 */

/** Доля ряда из четырёх — расчёт объяснён в `ChatCard`. */
const CARD = 'w-full sm:w-[calc((100%-4.5rem)/4)]'

/**
 * Пустой экран говорит одно из двух, и это разные вещи.
 *
 * «Никто не написал» — нормальное состояние подключённого номера в тихий день.
 * «WhatsApp не подключён» — незаконченная настройка, и тогда ждать нечего:
 * сообщения клиентов сюда физически не дойдут. Второе ведёт туда, где это
 * чинится, потому что состояние без выхода — это тупик, а не сообщение.
 */
function Empty({ connected }) {
  const t = useT()

  return (
    <div className="m-auto flex max-w-[320px] flex-col items-center gap-2 px-6 text-center">
      <p className="font-display text-[17px] font-semibold text-ink">
        {t(connected ? 'inbox.empty' : 'inbox.notConnected')}
      </p>
      <p className="text-[13px] leading-snug text-muted">
        {t(connected ? 'inbox.emptyHint' : 'inbox.notConnectedHint')}
      </p>
      {connected ? null : (
        <Link
          to="/assistant"
          className="mt-2 rounded-full bg-accent px-4 py-2 text-[13px] font-medium text-surface outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-80 focus-visible:opacity-80 active:scale-[0.97]"
        >
          {t('inbox.connect')}
        </Link>
      )}
    </div>
  )
}

export default function InboxPage() {
  const t = useT()
  const [chats, setChats] = useState(null)
  // `undefined` — ещё не знаем, `null` — номера нет. Пустого списка тут не
  // бывает, поэтому одним `null` два состояния не покрыть.
  const [channel, setChannel] = useState(undefined)
  // Какая ветка открыта, переживает уход на другой экран и обратно — как день
  // и вид в «Записях». Хранится id, а не строка: строка успеет устареть, id —
  // нет.
  const [openId, setOpenId] = useRemembered('inbox.open', null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    authed((token) => listConversations(token, { archived: false }))
      .then((rows) => alive && setChats(rows))
      // Проглочено: экран нарисует пустое состояние — то же, что видит аккаунт,
      // которому ещё никто не писал.
      .catch(() => alive && setChats([]))
    authed(getWhatsApp)
      .then((row) => alive && setChannel(row))
      .catch(() => alive && setChannel(null))
    return () => {
      alive = false
    }
  }, [reload])

  // Строка берётся из списка, а не хранится второй копией: после каждого
  // ответа список перечитывается, и отдельная копия разошлась бы с ним ровно
  // на то, что изменилось.
  const open = (chats ?? []).find((chat) => chat.id === openId) ?? null

  /** Открыть ветку — и тем самым прочитать её. */
  const openChat = (chat) => {
    setOpenId(chat.id)
    if (!chat.unread_count) return
    authed((token) => markConversationRead(token, chat.id))
      .then(() => setReload((n) => n + 1))
      // Счётчик просто останется — ничего не потеряно.
      .catch(() => {})
  }

  const nothing = chats !== null && chats.length === 0

  return (
    <div
      className={`${styles.page} flex h-[calc(100vh-118px-env(safe-area-inset-bottom))] items-stretch overflow-hidden sm:h-[calc(100vh-68px)]`}
      aria-label={t('nav.inbox')}
    >
      {/* Сетка. На телефоне уходит целиком, когда открыта ветка: две колонки в
          390 точек — это две колонки, ни одна из которых не читается. */}
      <div
        className={`min-w-0 flex-1 overflow-y-auto ${open ? 'hidden sm:block' : 'block'}`}
      >
        {nothing ? (
          <div className="flex h-full">
            <Empty connected={Boolean(channel)} />
          </div>
        ) : (
          <div className="flex flex-wrap content-start gap-4 p-4 sm:gap-6 sm:p-6">
            {(chats ?? []).map((chat) => (
              <ChatCard
                key={chat.id}
                chat={chat}
                onOpen={() => openChat(chat)}
                active={chat.id === openId}
                className={CARD}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ветка. Слева граница, а не тень: панель прижата к краю страницы, и
          тень у прижатого края — это тень, которой некуда падать. */}
      {open ? (
        <Thread
          conversation={open}
          onBack={() => setOpenId(null)}
          onChanged={() => setReload((n) => n + 1)}
          className="w-full shrink-0 sm:w-[380px] sm:border-l sm:border-line"
        />
      ) : null}
    </div>
  )
}
