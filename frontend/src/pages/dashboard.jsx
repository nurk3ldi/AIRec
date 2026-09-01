import { useEffect, useState } from 'react'
import { listConversations } from '../lib/api'
import { authed } from '../lib/auth'
import { useT } from '../lib/i18n'
import { liveChats } from '../lib/conversations'
import AssistantNow from '../components/home/AssistantNow'
import AssistantStreams from '../components/home/AssistantStreams'
import styles from '../styles/Dashboard.module.css'

/**
 * Главная — экран, который владелец открывает утром.
 *
 * Строится заново по `design/main_page.png`. Пока стоят два пустых места
 * первого ряда: широкое слева и узкое справа, чтобы посмотреть на сетку
 * прежде, чем в неё что-то класть.
 *
 * Здесь уже была аналитика по тому же образцу — недельный график, 2×2 метрик,
 * воронка, разбивка по услугам и таблица записей — всё на выдуманных числах,
 * поскольку агрегирующих эндпоинтов нет до сих пор. Снята 2026-08-21 и есть в
 * истории git. Всё, что появится здесь снова, считается из настоящих записей
 * (`GET /appointments?from&to`) на клиенте.
 *
 * Это домашний экран после входа, а не `/` — по тому адресу лендинг.
 */

/**
 * Высота первого ряда — три пятых экрана, одна на обе карточки.
 *
 * Виден весь вычет: 68px шапки от `sm` и 118px (шапка плюс нижняя панель с
 * домашним индикатором) на телефоне, минус собственные отступы ряда — `p-4`
 * сверху и снизу на телефоне, `sm:p-6` от `sm`. От того, что осталось, ряд
 * берёт три пятых.
 *
 * **Три пятых, а не половина.** Половина оставляла содержимому слишком мало
 * места по высоте, а целый экран означал бы, что ниже ничего нет — тогда как
 * следующий ряд начинается сразу за краем и должен быть виден краем глаза,
 * иначе никто не узнает, что страница продолжается.
 *
 * **Минимум, а не высота.** Ряд, который перерастёт свою долю, толкает
 * следующий вниз и прокручивает страницу: `/dashboard`, в отличие от
 * `/appointments`, не обязан помещаться в экран целиком.
 */
/**
 * Как часто перечитывать разговоры.
 *
 * **Опрос, а не push.** В проекте нет ни SSE, ни WebSocket. Пятнадцать секунд —
 * столько, чтобы «сейчас» на обеих карточках оставалось правдой, и не столько,
 * чтобы это был поток запросов.
 */
const POLL_MS = 15000

/* --------------------------------------------------------------------------
 * ВРЕМЕННО — УДАЛИТЬ ВМЕСТЕ С ЭТИМ БЛОКОМ.
 *
 * WhatsApp не подключён, входящих сообщений нет, и обе карточки ряда на
 * настоящих данных пусты — смотреть и спорить не на что. Это три выдуманные
 * ветки, чтобы посмотреть на раскладку. Тот же приём и та же пометка, что у
 * `DEMO_CHATS` в `ChatFeed`.
 *
 * Поставить `null` — и страница снова показывает ответ сервера вместе с
 * честными пустыми состояниями, которые увидит новый аккаунт.
 * ----------------------------------------------------------------------- */
const minutesAgo = (minutes) =>
  new Date(Date.now() - minutes * 60000).toISOString()

const DEMO_CHATS = [
  {
    id: 'demo-1',
    client_name: 'Ақзере',
    client_phone: '+7 701 555 33 22',
    assistant_enabled: true,
    awaiting_reply: true,
    last_message_at: minutesAgo(0),
    last_message_author: 'client',
    last_message_preview: 'Бүгінге бос орын бар ма? Қанша тұрады?',
  },
  {
    id: 'demo-2',
    client_name: 'Данияр',
    client_phone: '+7 705 214 87 09',
    assistant_enabled: true,
    awaiting_reply: false,
    last_message_at: minutesAgo(4),
    last_message_author: 'assistant',
    last_message_preview: 'Сізді бейсенбі 11:30-ға жаздым. Шаш алу, 4 000 ₸.',
  },
  {
    id: 'demo-3',
    client_name: null,
    client_phone: '+7 747 908 11 40',
    assistant_enabled: false,
    awaiting_reply: true,
    last_message_at: minutesAgo(9),
    last_message_author: 'client',
    last_message_preview: 'Басқа күнге ауыстыруға бола ма?',
  },
]
/* ------------------------------------------------------------ конец блока */

const ROW =
  'min-h-[calc((100vh-118px-env(safe-area-inset-bottom)-2rem)*0.6)] ' +
  'sm:min-h-[calc((100vh-68px-3rem)*0.6)]'

export default function DashboardHomePage() {
  const t = useT()
  const [fetched, setFetched] = useState(null)

  // **Читает страница, а не карточки.** Обе смотрят в один эндпоинт; два
  // опроса вместо одного — это лишний запрос каждые пятнадцать секунд и два
  // ответа, которые могут разойтись между собой на одном экране.
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

  // Пока стоит демо-блок выше, он и есть источник; убрать его — и остаётся
  // ответ сервера, одной строкой и без правок ниже.
  const chats = DEMO_CHATS ?? fetched
  const live = liveChats(chats)

  return (
    <div className={styles.page} aria-label={t('nav.dashboard')}>
      {/* **Доли, а не проценты.** `sm:flex-[35]` и `sm:flex-[65]` делят то, что
          осталось после зазора, поэтому 35/65 держится при любом `gap` —
          `w-[35%]` и `w-[65%]` вместе с зазором дают больше ста и переносят
          вторую карточку на новую строку.

          `min-w-0`: элемент flex не сжимается меньше своего содержимого без
          него, и первая же длинная строка внутри сломает пропорцию.

          Без рамки: `surface-raised` — заливка, которая сама отделяет блок от
          фона. Рамка поверх неё — обводка вокруг фигуры, у которой край уже
          есть. */}
      <div className="flex w-full flex-col gap-4 p-4 sm:flex-row sm:gap-6 sm:p-6">
        <AssistantNow
          chats={chats}
          live={live}
          className={`w-full min-w-0 sm:flex-[35] ${ROW}`}
        />
        <AssistantStreams
          chats={chats}
          live={live}
          className={`w-full min-w-0 sm:flex-[65] ${ROW}`}
        />
      </div>
    </div>
  )
}
