import { CARD_EDGE } from '../components/card'
import AssistantCard from '../components/home/AssistantCard'
import ConfirmationsCard from '../components/home/ConfirmationsCard'
import LimitCard from '../components/home/LimitCard'
import { useT } from '../lib/i18n'
import styles from '../styles/Dashboard.module.css'

/**
 * Главная — пусто, экран собирается заново.
 *
 * Снято дважды, и оба раза целиком, а не правкой.
 *
 * Первой была аналитика по `design/main_page.png` — недельный график, 2×2
 * метрик, воронка, разбивка по услугам и таблица записей, всё на выдуманных
 * числах, поскольку агрегирующих эндпоинтов нет до сих пор. Ушла 2026-08-21.
 *
 * Второй — ряд из двух карточек ассистента: «Сейчас» (`AssistantNow`) и
 * «Потоки» (`AssistantStreams`), делившие первый экран как 35/65 и читавшие
 * `GET /conversations` раз в пятнадцать секунд. Снят 2026-09-09. Обе карточки и
 * демо-блок под ними целы в истории git.
 *
 * **Список потоков при этом не пропал** — он и не был частью главной по сути:
 * тот же `StreamList` показывает правая панель «Диалогов», и он переехал в
 * `components/StreamList.jsx`, потому что файл, названный по экрану, которого
 * нет, — указатель в пустоту.
 *
 * **Данные под экраном не тронуты.** `GET /conversations` на месте, `liveChats`
 * и `chatState` в `lib/conversations.js` — тоже; тот же порядок, что на
 * `/appointments` и в «Диалогах»: экран переписывается, арифметика под ним нет,
 * и следующая версия начинает с готового слоя.
 *
 * **Маршрут остаётся зарегистрированным**, и «Главная» остаётся в навигации:
 * пустая страница — честный ответ, 404 — нет. Это домашний экран после входа, а
 * не `/` — по тому адресу лендинг.
 */
/**
 * How much of the plan's limit is used. There are no plans or metering yet, so
 * it is 0; both the limit ring and the robot's spinner read this one number.
 */
const LIMIT_PERCENT = 0
/** When the limit resets, as an ISO instant — unknown until there are plans. */
const LIMIT_RESET_AT = null


/**
 * Одна из двух строк экрана. Из высоты вычтено всё, что не карточки: шапка,
 * отступы страницы и зазор между рядами — иначе второй ряд не поместился бы и
 * страница поехала бы вниз ровно на этот зазор. На телефоне карточки идут
 * столбиком, и страница прокручивается в любом случае.
 */
const ROW_HEIGHT =
  'h-[calc((100vh-118px-env(safe-area-inset-bottom)-2rem)/2)] sm:h-[calc((100vh-140px)/2)]'

export default function DashboardHomePage() {
  const t = useT()

  return (
    <div className={`${styles.page} p-4 sm:p-6`} aria-label={t('nav.dashboard')}>
      {/* Один ряд: две пустые карточки по четверти ширины слева и
          «Подтверждения» на половину справа, все в половину высоты. Ширины
          вычитают свою долю двух зазоров по 24px, чтобы ряд сложился ровно в
          100%. Высота посчитана из тех же чисел, что и страница, а не `h-1/2`:
          у страницы только `min-height`, и процент от неё не разрешается. На
          компьютере это 68px шапки и 48px отступов; на телефоне — шапка с
          нижней панелью (118px) и 32px отступов, и карточки идут столбиком во
          всю ширину, потому что четверть от 390pt — полоска. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        {/* Робот ассистента, а под ним — бот, потоки и модель. */}
        <AssistantCard limitReached={LIMIT_PERCENT >= 100} className={`${ROW_HEIGHT} w-full sm:w-[calc(25%-0.75rem)]`} />
        {/* Лимит тарифа — кольцом. Считать пока нечего, поэтому 0: когда появятся
            тарифы и учёт, сюда придёт настоящая доля. */}
        <LimitCard percent={LIMIT_PERCENT} resetAt={LIMIT_RESET_AT} className={`${ROW_HEIGHT} w-full sm:w-[calc(25%-0.75rem)]`} />
        <ConfirmationsCard className={`${ROW_HEIGHT} w-full sm:w-[calc(50%-1.5rem)]`} />
      </div>

      {/* Второй ряд — 50/25/25, зеркало первого: половина слева и две четверти
          справа. Пока пустые; ширины вычитают свою долю двух зазоров по 24px,
          как и в первом ряду. */}
      <div className="mt-4 flex flex-col gap-4 sm:mt-6 sm:flex-row sm:gap-6">
        <section className={`${CARD_EDGE} ${ROW_HEIGHT} w-full sm:w-[calc(50%-1.5rem)]`} />
        <section className={`${CARD_EDGE} ${ROW_HEIGHT} w-full sm:w-[calc(25%-0.75rem)]`} />
        <section className={`${CARD_EDGE} ${ROW_HEIGHT} w-full sm:w-[calc(25%-0.75rem)]`} />
      </div>
    </div>
  )
}
