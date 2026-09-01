import { useEffect, useState } from 'react'
import {
  deleteConversation,
  listConversations,
  updateConversation,
} from '../lib/api'
import { authed } from '../lib/auth'
import { useT } from '../lib/i18n'
import ChatRow from '../components/inbox/ChatRow'
import Skeleton, { SkeletonRegion } from '../components/Skeleton'
import { useSkeleton } from '../lib/skeleton'
import styles from '../styles/Inbox.module.css'

/**
 * Диалоги — экран проектируется заново; пока построена правая полоса со
 * списком разговоров.
 *
 * Здесь был полный инбокс: список с поиском, фильтрами и перепиской справа.
 * Снят целиком 2026-09-01; всё это есть в истории git, коммит `2702991`.
 *
 * **Бэкенд под ним цел и работает.** `conversations` и `messages`, правило
 * «написал человек — ассистент в этой ветке замолчал», архив, звёзды, счётчик
 * непрочитанного, поиск по имени, номеру и тексту сообщений — всё на месте, и
 * `lib/api.js` держит вызовы.
 *
 * **Чего не хватает, чтобы экран имел смысл:** входящих. Вебхука WhatsApp нет,
 * исходящего канала нет, а `POST /conversations/ingest` авторизован владельцем
 * — не то место, куда приходит вебхук. Пока их нет, список здесь пуст, и
 * поэтому под ним стоит помеченный демо-блок.
 */

/* --------------------------------------------------------------------------
 * ВРЕМЕННО — УДАЛИТЬ ВМЕСТЕ С ЭТИМ БЛОКОМ.
 *
 * Три выдуманные ветки, чтобы посмотреть на строку списка. Тот же приём и та же
 * пометка, что у демо-данных на главной.
 *
 * Поставить `null` — и экран снова читает сервер и рисует честное пустое
 * состояние, которое увидит новый аккаунт.
 * ----------------------------------------------------------------------- */
const hoursAgo = (hours) =>
  new Date(Date.now() - hours * 3600000).toISOString()

const DEMO_CHATS = [
  {
    id: 'demo-1',
    client_name: 'Ақзере',
    client_phone: '+7 701 555 33 22',
    pinned: true,
    last_message_at: hoursAgo(0.2),
    last_message_author: 'client',
    last_message_preview: 'Бүгінге бос орын бар ма? Қанша тұрады?',
  },
  {
    id: 'demo-2',
    client_name: 'Данияр',
    client_phone: '+7 705 214 87 09',
    pinned: false,
    last_message_at: hoursAgo(1.5),
    last_message_author: 'assistant',
    last_message_preview: 'Сізді бейсенбі 11:30-ға жаздым. Шаш алу, 4 000 ₸.',
  },
  {
    id: 'demo-3',
    client_name: null,
    client_phone: '+7 747 908 11 40',
    pinned: false,
    last_message_at: hoursAgo(26),
    last_message_author: 'owner',
    last_message_preview: 'Иә, ауыстырдым. Сенбі 16:00.',
  },
]
/* ------------------------------------------------------------ конец блока */

/** Закреплённые сверху, остальные по свежести. */
const ordered = (rows) =>
  [...(rows ?? [])].sort(
    (a, b) =>
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
      new Date(b.last_message_at ?? 0) - new Date(a.last_message_at ?? 0),
  )

export default function InboxPage() {
  const t = useT()
  const [fetched, setFetched] = useState(null)
  const [openId, setOpenId] = useState(null)
  // Счётчик, а не флаг: два действия подряд должны быть двумя перечитываниями,
  // а `true → true` — это не изменение.
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    authed((token) => listConversations(token, { archived: false }))
      .then((rows) => alive && setFetched(rows))
      // Проглатываем, как и все чтения на экранах: полоса ошибки над пустым
      // списком говорит меньше, чем сам пустой список.
      .catch(() => alive && setFetched([]))
    return () => {
      alive = false
    }
  }, [reload])

  // Пока стоит демо-блок выше, он и есть источник; убрать его — и остаётся
  // ответ сервера, одной строкой и без правок ниже.
  const chats = DEMO_CHATS ?? fetched
  const bars = useSkeleton(chats === null)

  /**
   * Что просит меню строки.
   *
   * Список перечитывается, а не правится на месте: правила живут на сервере, и
   * его ответ — единственное, что знает, чем всё кончилось.
   */
  const onAction = (action, chat) => {
    const call =
      action === 'delete'
        ? (token) => deleteConversation(token, chat.id)
        : (token) =>
            updateConversation(token, chat.id, { pinned: action === 'pin' })

    // Открытый разговор, который только что удалили, закрывается вместе с ним.
    if (action === 'delete' && openId === chat.id) setOpenId(null)

    authed(call)
      .then(() => setReload((n) => n + 1))
      .catch(() => setReload((n) => n + 1))
  }

  return (
    // **Определённая высота, а не минимальная**, ровно как на `/appointments`:
    // список прокручивается внутри полосы, а измерить ребёнка можно только
    // относительно высоты, которая определена. Под `min-height` цепочка flex
    // имеет неопределённый поперечный размер, каждый `flex-1` внутри
    // разрешается в собственное содержимое, и полосу прокрутки отращивает
    // страница вместо списка.
    //
    // Числа — те же, что в модуле, записанные второй раз настоящей высотой:
    // 68px шапки плюс 50px нижней панели и домашний индикатор под ней до `sm`,
    // и одна шапка от `sm`. Двигать их нужно вместе.
    <div
      className={`${styles.page} flex h-[calc(100vh-118px-env(safe-area-inset-bottom))] overflow-hidden sm:h-[calc(100vh-68px)]`}
      aria-label={t('nav.inbox')}
    >
      {/* Слева — переписка выбранного разговора. Пока пусто. */}
      <div className="min-w-0 flex-1" />

      {/* **Линия — это край правой полосы, а не отдельный элемент.**
          `border-l` на самой панели держится за неё при любой её ширине; линия,
          нарисованная отдельно, — третий предмет в ряду, который придётся
          двигать всякий раз, когда меняется доля.

          **Ширина та же, что у правой панели `/appointments`** — 300px плюс её
          собственные `p-4`, записанные суммой, чтобы две величины не разошлись.
          Доля вроде 30% этого не даёт: на широком мониторе она разносит панель
          вдвое шире, чем на ноутбуке, хотя лежать в ней будет одно и то же.

          Ниже `sm` полосы нет: на телефоне она была бы не колонкой, а щелью.
          Что там будет вместо неё, решается отдельно — как и на
          `/appointments`, где телефон получил свой собственный экран. */}
      <aside className="hidden w-[calc(300px+2rem)] shrink-0 flex-col border-l border-line sm:flex">
        {chats === null ? (
          <SkeletonRegion
            label={t('nav.inbox')}
            visible={bars}
            className="flex flex-col gap-5 p-4"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-[45%]" />
                <Skeleton className="h-3 w-[80%]" />
              </div>
            ))}
          </SkeletonRegion>
        ) : chats.length === 0 ? (
          // Честный ответ, а не заглушка: сегодня полоса именно такая —
          // WhatsApp не подключён, входящих нет.
          <div className="p-4">
            <p className="text-[15px] font-medium text-ink">
              {t('inbox.empty')}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {t('inbox.emptyHint')}
            </p>
          </div>
        ) : (
          // `min-h-0` рядом с `flex-1` — то, что позволяет списку
          // прокручиваться внутри полосы, а не растить её: элемент flex не
          // сжимается меньше своего содержимого без него.
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {ordered(chats).map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                selected={chat.id === openId}
                onSelect={(row) => setOpenId(row.id)}
                onAction={onAction}
              />
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}
