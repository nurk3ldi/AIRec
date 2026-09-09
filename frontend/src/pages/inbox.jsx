import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import { domMax, LazyMotion, m, useReducedMotion } from 'motion/react'
import * as Popover from '@radix-ui/react-popover'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  Cancel01Icon,
  FilterHorizontalIcon,
  MoreHorizontalIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import MonthCalendar from '../components/appointments/MonthCalendar'
import DateField from '../components/appointments/DateField'
import TimeField from '../components/appointments/TimeField'
import { PANEL_MOTION } from '../components/appointments/panel'
import { StepButton, ToolbarPill } from '../components/appointments/Timetable'
import { dayKey, shiftDate } from '../lib/dates'
import { getBusiness, listAppointments, listConversations } from '../lib/api'
import { authed } from '../lib/auth'
import { liveChats } from '../lib/conversations'
import { StreamList } from '../components/StreamList'
import { BOOKING_COLORS, toBlock } from '../lib/appointments'
import { getLocale, useT } from '../lib/i18n'
import styles from '../styles/Inbox.module.css'
import { CARD_EDGE } from '../components/card'

/**
 * Диалоги — пусто, экран собирается заново.
 *
 * Снято трижды, и каждый раз целиком, а не правкой. Сначала полный инбокс:
 * список веток с поиском, фильтрами и меню строки, справа переписка с паузой
 * ассистента и отправкой (коммит `2702991`). Затем правая полоса со списком
 * разговоров — имя, последняя реплика, время, меню «закрепить / удалить»
 * (коммит `88385af`). Третья версия — сетка квадратных карточек `ChatCard` и
 * ветка `Thread` рядом с ней, с тремя галочками доставки и переключателем
 * ассистента, — снята 2026-09-07. Все три целы в истории git вместе со своими
 * компонентами.
 *
 * **На этот раз причина другая, и её стоит записать.** Первые две версии
 * убирали потому, что под ними ничего не было: вебхука WhatsApp не
 * существовало, входящих не приходило, и любой инбокс показывал пустоту. Это
 * больше не так — канал достроен и проверен от подписи до квитанций о
 * доставке, см. «The WhatsApp channel» в `CLAUDE.md`. Экран снят не из-за
 * данных, а из-за самого экрана: его собирают заново.
 *
 * **Данные и слой доступа остаются нетронутыми.** `conversations` и
 * `messages`, правило «написал человек — ассистент в этой ветке замолчал»,
 * архив, звёзды, закрепление, счётчик непрочитанного, поиск по имени, номеру и
 * тексту сообщений — всё на месте, и `lib/api.js` держит вызовы. Главная уже
 * читает `GET /conversations` для двух карточек ассистента, так что данные
 * видны и без этого экрана. Это тот же порядок, что и на `/appointments`:
 * экран переписывается, арифметика под ним — нет, и следующая версия начинает
 * с готового слоя.
 *
 * **Маршрут остаётся зарегистрированным**, и в навигации остаётся «Диалоги»:
 * пустая страница — честный ответ, 404 — нет.
 */
/**
 * Как часто перечитывать разговоры.
 *
 * То же число, что на главной, и по той же причине: пуша нет — ни SSE, ни
 * вебсокета в этом проекте, — поэтому «прямо сейчас» на экране держится опросом.
 * Пятнадцать секунд — это то, при чём строка «2 мин» не успевает соврать.
 */
const POLL_MS = 15000

export default function InboxPage() {
  const t = useT()
  // `null` — ещё не читали; пустой массив — прочитали, и разговоров нет. Это
  // разные вещи: первое рисует скелет, второе — честный пустой ответ.
  const [chats, setChats] = useState(null)

  useEffect(() => {
    let alive = true

    const read = () => {
      authed((token) => listConversations(token, { archived: false }))
        .then((rows) => alive && setChats(rows))
        // Проглатываем, как и все чтения на экранах: полоса ошибки над пустой
        // карточкой говорит меньше, чем сама пустая карточка, и починка в обоих
        // случаях одна — посмотреть ещё раз.
        .catch(() => alive && setChats([]))
    }

    read()
    const timer = setInterval(read, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const live = liveChats(chats)
  // Какой день показывает верхняя секция. Стрелки и календарь двигают одно и
  // то же состояние — два контрола, один ответ на вопрос «какой день».
  const [day, setDay] = useState(() => new Date())
  // Записи выбранного дня. `null` — ещё не читали, пустой массив — прочитали, и
  // на этот день ничего нет.
  const [bookings, setBookings] = useState(null)

  /**
   * Зона, в которой у бизнеса идут часы, — не браузерная.
   *
   * `toBlock` разбирает время именно в ней, и без неё владелец, открывший панель
   * из другой страны, увидел бы промежутки сдвинутыми. `undefined` до ответа
   * `GET /business` означает браузерную зону: для всех, кто внутри страны, это
   * тот же ответ, а остальным он поправится кадром позже.
   *
   * Ошибку глотаем, как и остальные чтения экрана: зона — настройка, а не
   * содержимое, и полоса ошибки над списком записей сказала бы меньше, чем сам
   * список.
   */
  const [timeZone, setTimeZone] = useState(undefined)

  useEffect(() => {
    let alive = true
    authed(getBusiness)
      .then((row) => alive && setTimeZone(row.timezone))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  /**
   * Перечитывается при каждой смене дня — этим стрелки, «Сегодня» и календарь и
   * работают: они меняют `day`, а не список, и список приходит следом.
   *
   * `from` и `to` — один и тот же день: эндпоинт берёт промежуток *локальных*
   * дней, и промежуток из одного дня — это ровно то, что показывает секция.
   */
  useEffect(() => {
    let alive = true
    const key = dayKey(day)
    setBookings(null)
    authed((token) => listAppointments(token, { from: key, to: key }))
      .then((rows) => alive && setBookings(rows))
      .catch(() => alive && setBookings([]))
    return () => {
      alive = false
    }
  }, [day])

  /**
   * Всё, что в таблице внизу.
   *
   * **Без `from` и `to` — намеренно**, а не по забывчивости: эндпоинт в этом
   * случае отдаёт свой промежуток по умолчанию, сегодня и тридцать дней вперёд,
   * и это ровно то окно, из которого работают. Выдумывать своё значило бы
   * завести на клиенте второй ответ на вопрос, у которого ответ уже есть на
   * сервере; а «вся история» — это отдельный режим (`?query=` без дат), и он
   * про поиск конкретного человека, а не про список, который читают сверху.
   *
   * Читается один раз: в отличие от верхней секции, окно не зависит от
   * выбранного дня, и стрелки над папками эту таблицу не двигают.
   */
  const [all, setAll] = useState(null)

  useEffect(() => {
    let alive = true
    authed((token) => listAppointments(token))
      .then((rows) => alive && setAll(rows))
      .catch(() => alive && setAll([]))
    return () => {
      alive = false
    }
  }, [])

  /**
   * Чем сужена таблица: строка поиска и промежутки в фильтре.
   *
   * **Живёт здесь, а не внутри таблицы**, потому что читателей двое и они по
   * разные стороны: заголовок секции держит контролы, тело — строки. Общий
   * родитель — единственное место, где оба видят одно значение.
   *
   * **Сужается на клиенте, а не запросом.** Строки уже в памяти, и уход на
   * сервер за тем, что и так лежит перед глазами, превратил бы набор символа в
   * загрузку страницы. Тот же довод, по которому фильтр статусов на «Записях»
   * не ходит в сеть, хотя эндпоинт это умеет.
   */
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(EMPTY_FILTER)

  return (
    /* **Высота определённая, а не минимальная.** Правая панель обязана быть
       100% высоты, а `items-stretch` меряет от *определённого* размера:
       контейнер с `height: auto` поперечника не имеет, сколько бы `min-height`
       его снизу ни подпирал, и `flex-1` внутри такой панели ничего не
       наследует. Числа — те же, что в модуле (68px шапки, 50px нижней панели и
       индикатор дома под ней), но записаны настоящей высотой. Тот же приём, что
       на `/appointments`, и там же объяснён подробно. */
    <div
      className={`${styles.page} flex h-[calc(100vh-118px-env(safe-area-inset-bottom))] items-stretch overflow-hidden sm:h-[calc(100vh-68px)]`}
      aria-label={t('nav.inbox')}
    >
      {/* **Доли, а не проценты.** `flex-[65]` и `flex-[35]` делят то, что
          осталось, поэтому 65/35 держится при любом зазоре и любой рамке, а
          `w-[65%]` и `w-[35%]` вместе с ними дали бы больше ста и уронили бы
          вторую колонку под первую. Тот же приём, что на главной.

          `min-w-0`: элемент flex не сжимается меньше своего содержимого без
          него, и первая же длинная строка внутри сломала бы пропорцию.

          **Зазор между колонками — одна ступень шкалы, а не сумма двух
          отступов.** Внешние поля у колонок свои (24 слева, 16 справа), и
          сложенные посередине они давали 40px — полосу пустоты шире, чем
          зазор между самими папками. С `lg:pr-3` здесь и `lg:pl-3` на панели
          посередине остаётся ровно 24px: тот же шаг, которым отделены друг от
          друга карточки внутри ряда. */}
      <div className="min-w-0 flex-[65] overflow-y-auto p-4 sm:p-6 lg:pr-3">
        {/* Собственного заголовка у страницы нет: на десктопе её называет
            шапка, а на телефоне — нижняя панель, и третий раз то же слово было
            бы тем самым повтором в двух соседних кеглях, который тут запрещён
            по имени. */}
        <Section
          title={t('inbox.today')}
          actions={<DayPicker value={day} onChange={setDay} />}
        >
          {/* Настоящие записи выбранного дня. Пока их читают — ничего не
              рисуем: скелет из четырёх папок на экране, где список меняется от
              каждого нажатия стрелки, мигал бы чаще, чем успевал что-то
              сообщить.

              **Демо-строки — только пока на сегодня нет ни одной настоящей
              записи**, чтобы было на чём смотреть карточку, пока подгоняется
              её форма. Та же временная метка, что была у прежнего блока —
              удалить вместе с ним, как только форма устоится. */}
          {bookings === null ? null : bookings.length === 0 ? (
            <FolderRow rows={DEMO_TODAY_ROWS.map((row) => toBlock(row, timeZone))} />
          ) : (
            <FolderRow rows={bookings.map((row) => toBlock(row, timeZone))} />
          )}
        </Section>

        {/* 32px между секциями — ступень шкалы, а не подобранное число: 24
            внутри секции отделяет заголовок от содержимого, и такой же зазор
            между секциями стёр бы границу между ними.

            **Список, а не второй ряд папок, и это разница по смыслу.** Папка
            наверху — про один день: их немного, у каждой свой час, и они стоят
            рядом, потому что их сравнивают между собой. Здесь же вся история
            разговоров, она растёт без предела, и сравнивать в ней нечего —
            такое читают сверху вниз одной колонкой, а не разглядывают сеткой.
            Восемь папок ещё сетка, восемьдесят — уже стена. */}
        <Section
          title={t('inbox.all')}
          className="mt-6 sm:mt-8"
          actions={
            <TableTools
              query={query}
              onQuery={setQuery}
              filter={filter}
              onFilter={setFilter}
            />
          }
        >
          {/* Демо-строки — только пока настоящих нет, как и у папок выше, и
              удаляются тем же движением.

              Сужение — здесь, а не внутри таблицы: та рисует то, что ей дали, и
              не должна знать, почему строк стало меньше. */}
          <BookingTable
            rows={
              all === null
                ? null
                : (all.length === 0 ? DEMO_ALL_ROWS : all)
                    .map((row) => toBlock(row, timeZone))
                    .filter((row) => matches(row, query, filter))
            }
            narrowed={Boolean(query.trim()) || isFiltered(filter)}
          />
        </Section>
      </div>

      {/* **Правая панель — во всю высоту, и появляется только начиная с `lg`.**
          Ниже неё панель шириной в треть экрана отбирает у ряда папок больше,
          чем сама даёт: на 1024px слева остаётся ещё около семисот пикселей, а
          на 768px — уже меньше половины. Скрыта классом, а не размонтирована
          через `useMediaQuery`: здесь ничего не тикает и нечего терять при
          пересборке, значит и повода звать хук нет.

          Хайрлайна между колонками нет — в образце его тоже нет: карточки
          отделяет от фона собственная заливка, а линия рядом с ней была бы
          вторым краем у фигуры, у которой край уже есть. */}
      <aside className="hidden min-w-0 flex-[35] flex-col p-4 lg:flex lg:pl-3">
        {/* Что ассистент делает прямо сейчас: с кем говорит, в каком состоянии
            ветка, что сказано последним и как давно. */}
        <Panel title={t('home.streams.title')} count={live.length}>
          <StreamList chats={chats} live={live} bleed="-mx-5 px-5" />
        </Panel>
      </aside>
    </div>
  )
}

/**
 * Заголовок секции: название и то, чем секцию листают.
 *
 * **Один компонент на обе колонки.** Слева один, справа один, и они обязаны
 * выглядеть одинаково — это заголовки одного уровня, каждый называет свой блок.
 * Две копии одной разметки совпадают ровно до первой правки одной из них.
 *
 * **Иконки перед названием больше нет.** Двум заголовкам на экране она ничего
 * не добавляла: слово уже названо словом, а знак рядом с ним — это второй
 * способ сказать то же самое, и на 24px он спорил с ним по весу.
 *
 * Заголовок стоит **вне** карточек, а не первой строкой внутри: он называет
 * то, что под ним лежит, а подпись к предмету стоит рядом с предметом, а не на
 * нём.
 */
function SectionHeading({ title, count, actions }) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-1 pb-3">
      <h2 className="min-w-0 truncate font-display text-[24px] leading-tight font-bold tracking-[-0.02em] text-ink">
        {title}
        {/* Число рядом с названием, а не подписью под ним: это про то же самое
            и читается той же строкой. Ноль не показывается — «Потоки · 0»
            сообщает ровно то же, что пустая карточка под заголовком. */}
        {count > 0 && (
          <span className="font-normal text-muted"> · {count}</span>
        )}
      </h2>
      {/* Управление секцией — у правого края той же строки, что и её название:
          заголовок говорит, что показано, а то, что справа, решает, что
          показать. `ml-auto` вместо `justify-between` на строке — с одним
          дочерним элементом `justify-between` вырождается в `flex-start`, и
          без заголовка кнопки уехали бы влево. */}
      {actions ? <div className="ml-auto shrink-0">{actions}</div> : null}
    </div>
  )
}

/** Заголовок и то, что под ним. Высоту занимает по содержимому. */
function Section({ title, actions, className = '', children }) {
  return (
    <section className={className}>
      <SectionHeading title={title} actions={actions} />
      {children}
    </section>
  )
}

/**
 * Листалка дня: шаг назад, шаг вперёд, «Сегодня» и выбор по календарю.
 *
 * **Ничего из этого не написано здесь заново.** Кнопки — тот же `StepButton`,
 * что и в тулбаре «Записей», шаг считает `shiftDate` из `lib/dates`, а месяц
 * рисует `MonthCalendar`. Вопрос «на сколько сдвигает одна стрелка» должен
 * иметь один ответ на весь продукт, а не по ответу на экран.
 *
 * **Стрелки и календарь двигают одно состояние.** Пролистать три дня и выбрать
 * четвёртый в календаре — это одно и то же действие, сделанное двумя способами;
 *два отдельных значения разошлись бы на первом же переключении.
 *
 * **«Сегодня» — это возврат одним нажатием.** Стрелки хороши на шаг-другой, а
 * вернуться с четвёртого дня ими — четыре нажатия; тот же довод, по которому
 * эта кнопка появилась в тулбаре «Записей», и та же кнопка.
 *
 * Выбор дня закрывает поповер: календарь открывали ради одного нажатия, и
 * оставлять его открытым после — заставлять закрывать вручную то, что уже
 * сделало свою работу.
 */
function DayPicker({ value, onChange }) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center gap-2">
      <StepButton
        label={t('appointments.prev')}
        icon={ArrowLeft01Icon}
        onClick={() => onChange(shiftDate(value, 'day', -1))}
      />
      <StepButton
        label={t('appointments.next')}
        icon={ArrowRight01Icon}
        onClick={() => onChange(shiftDate(value, 'day', 1))}
      />

      <ToolbarPill onClick={() => onChange(new Date())}>
        {t('appointments.today')}
      </ToolbarPill>

      <Popover.Root open={open} onOpenChange={setOpen}>
        {/* `asChild`: `StepButton` — обычная кнопка, и Radix навешивает на неё
            свои обработчики и ref вместо того, чтобы оборачивать её ещё одной. */}
        <Popover.Trigger asChild>
          <StepButton label={t('inbox.pickDay')} icon={Calendar03Icon} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            collisionPadding={12}
            className={`z-[70] w-[300px] rounded-xl border border-line bg-surface p-3 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] ${PANEL_MOTION}`}
          >
            <MonthCalendar
              value={value}
              onChange={(picked) => {
                onChange(picked)
                setOpen(false)
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

/* --- поиск и фильтр над таблицей ------------------------------------- */

/** Пустые промежутки. Один объект на четыре поля: они всегда сбрасываются вместе. */
const EMPTY_FILTER = { dateFrom: '', dateTo: '', timeFrom: '', timeTo: '' }

/** Задан ли хоть один из промежутков — этим фильтр и «включён». */
const isFiltered = (filter) => Object.values(filter).some(Boolean)

/** Только цифры: так «+7 701 555 33 22» и «77015553322» — один и тот же номер. */
const digits = (value) => value.replace(/\D/g, '')

/**
 * Проходит ли запись через поиск и оба промежутка.
 *
 * **Сравнения — строковые, и это не экономия, а следствие форматов.** День
 * лежит как `YYYY-MM-DD`, час — как `HH:MM`; обе записи сортируются как
 * читаются, поэтому `>=` и `<=` над ними значат ровно то же, что над датами, и
 * не требуют ни разбора, ни зоны. Ради этого форматы такие и выбраны.
 *
 * **Пустая половина промежутка — это «без границы», а не «ничего не подходит».**
 * «С 10:00» без верхней границы — обычный вопрос, и заставлять заполнять обе
 * клетки значило бы отвечать на него отказом.
 *
 * **Час сравнивается по началу записи.** Запись 09:45–11:00 попадает в фильтр
 * «с 09:00 до 10:00»: спрашивают «что начинается в эти часы», а не «что целиком
 * в них укладывается» — второе выбросило бы длинную запись из окна, которое она
 * занимает.
 *
 * Поиск идёт по имени, номеру и услуге — по всем трём столбцам, которые видно.
 * Номер сравнивается без знаков препинания, как и на «Записях»: «701 555» и
 * «+7 701 555 33 22» — один человек.
 */
function matches(row, query, filter) {
  const { dateFrom, dateTo, timeFrom, timeTo } = filter

  if (dateFrom && row.day < dateFrom) return false
  if (dateTo && row.day > dateTo) return false
  if (timeFrom && row.from < timeFrom) return false
  if (timeTo && row.from > timeTo) return false

  const text = query.trim().toLowerCase()
  if (!text) return true

  const asDigits = digits(text)
  return (
    (row.client ?? '').toLowerCase().includes(text) ||
    (row.service ?? '').toLowerCase().includes(text) ||
    (asDigits.length > 0 && digits(row.phone ?? '').includes(asDigits))
  )
}

/**
 * Две кнопки у правого края заголовка: поиск и фильтр.
 *
 * Обе — тот же круг 36px, что листает день над папками: на одном экране два
 * ряда контролов, и они обязаны быть одной породы.
 */
function TableTools({ query, onQuery, filter, onFilter }) {
  return (
    <div className="flex items-center gap-2">
      <SearchTool query={query} onQuery={onQuery} />
      <FilterMenu filter={filter} onFilter={onFilter} />
    </div>
  )
}

/**
 * Поиск: сначала только значок, по нажатию — поле.
 *
 * **Поле не висит открытым.** В заголовке оно стояло бы пустым большую часть
 * времени и отбирало бы ширину у названия секции ради вопроса, который задают
 * редко. Значок занимает 36px и говорит ровно столько, сколько нужно.
 *
 * **Открылось — сразу под курсором.** `autoFocus` здесь не украшение: нажать
 * значок, а потом ещё раз щёлкнуть по появившемуся полю — это два действия там,
 * где человек просил одно.
 *
 * **Закрывается по Escape и по уходу фокуса, но только пустым.** Поле с текстом
 * — это состояние таблицы под ним, а не открытый ящик: свернуть его значило бы
 * спрятать причину, по которой строк осталось три. Крестик — он появляется,
 * только когда есть что стирать, — закрывает всегда и заодно чистит.
 *
 * **Значок не исчезает и не подменяется: кружок раздаётся в поле, а он остаётся
 * у левого края.** Подменить одно другим значило бы, что на месте кнопки просто
 * оказалось что-то ещё; когда та же фигура растёт, а знак стоит на месте, видно,
 * что это по-прежнему поиск, только теперь в него можно писать. Двигать при
 * этом почти нечего: в кружке значок стоит по центру, то есть в 10px от левого
 * края, а в поле — в 12px, и `layout` проезжает эти два пикселя, чтобы они не
 * скакнули.
 *
 * **Фон и рамка — два слоя, которые перекрёстно гаснут**, а не один
 * перекрашиваемый. Смена класса вместо этого дала бы мгновенный скачок цвета
 * посреди плавного роста; две накрытые друг другом заливки меняются только
 * прозрачностью, что и разрешено правилами движения этого проекта.
 *
 * Форма поля — та же, что у поиска в шапке: 240px, `rounded-xl`, `bg-surface` и
 * трёхступенчатое кольцо. Два поиска в одном продукте обязаны быть одним
 * предметом, и плейсхолдер у них поэтому тоже общий.
 *
 * `text-[16px]` до `sm` — правило дома против зума iOS на фокусе; выше 14, как
 * у всех полей.
 */
function SearchTool({ query, onQuery }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()

  const close = () => {
    setOpen(false)
    onQuery('')
  }

  // Один и тот же переезд для формы и для значка: они едут вместе или не едут
  // вовсе.
  const travel = reduce
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }

  return (
    // `domMax`, а не `domAnimation`: проекция раскладки — единственная функция,
    // которой в меньшем наборе нет, а именно она и растит кружок в поле. Лишнего
    // веса это не стоит — календарь на этой же странице уже её тянет.
    <LazyMotion features={domMax}>
      <m.div
        layout
        transition={travel}
        className={`relative flex h-9 shrink-0 items-center ${
          open ? 'w-[240px]' : 'w-9'
        }`}
      >
        {/* Слой «кнопка» и слой «поле». Оба всегда в разметке и оба absolute,
            поэтому ширину задаёт родитель, а не они, — и переключение между
            ними стоит ровно одну прозрачность. */}
        <m.span
          aria-hidden="true"
          animate={{ opacity: open ? 0 : 1 }}
          transition={travel}
          className="absolute inset-0 rounded-full bg-ink/12"
        />
        <m.span
          aria-hidden="true"
          animate={{ opacity: open ? 1 : 0 }}
          transition={travel}
          className="absolute inset-0 rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-field)]"
        />

        {/* Значок поверх обоих слоёв и с собственным `layout`: те самые два
            пикселя от центра кружка до левого края поля. */}
        <m.span
          layout
          transition={travel}
          aria-hidden="true"
          // **Закрытым — `ink`, открытым — `muted`, потому что это два разных
          // предмета.** В кружке значок и есть содержимое кнопки, и он обязан
          // весить столько же, сколько глиф фильтра рядом: два соседних круга с
          // разной яркостью читаются как включённый и выключенный, хотя оба
          // просто ждут нажатия. В поле он перестаёт быть кнопкой и становится
          // подсказкой рядом с плейсхолдером — там `muted` его и держит, как во
          // всех полях приложения.
          //
          // `ink`, а не литеральный белый: на тёмной теме это и есть белый, а на
          // светлой — почти чёрный, то есть значок остаётся видимым в обеих.
          className={`pointer-events-none absolute z-10 grid place-items-center transition-colors duration-150 ${
            open ? 'left-3 text-muted' : 'left-[10px] text-ink'
          }`}
        >
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </m.span>

        {open ? (
          <>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && close()}
              onBlur={() => !query && setOpen(false)}
              placeholder={t('header.search')}
              aria-label={t('inbox.search')}
              // Прозрачный: заливку и кольцо рисует слой под ним, иначе их было
              // бы два. `pl-9` — место под значок, `pr-9` — под крестик.
              className="relative z-10 h-full w-full appearance-none rounded-xl bg-transparent pr-9 pl-9 text-[16px] text-ink outline-none placeholder:text-muted sm:text-[14px] [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button
                type="button"
                onClick={close}
                aria-label={t('appointments.close')}
                className="absolute right-2 z-10 grid h-6 w-6 place-items-center rounded-full text-muted outline-none transition-[color,background-color] hover:bg-ink/8 hover:text-ink focus-visible:bg-ink/8 focus-visible:text-ink"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={14}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.2}
                />
              </button>
            )}
          </>
        ) : (
          // Кнопка занимает весь кружок, а не сидит в нём: нажимают по фигуре
          // целиком, а не по значку внутри неё.
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('inbox.search')}
            className="absolute inset-0 z-10 rounded-full outline-none transition-[background-color,scale] hover:bg-ink/8 focus-visible:bg-ink/8 active:scale-[0.95]"
          />
        )}
      </m.div>
    </LazyMotion>
  )
}

/**
 * Фильтр: меню от кнопки, два промежутка внутри.
 *
 * **Поповер, а не модалка.** Он про таблицу, которая под ним, и её видно, пока
 * его настраивают; затемнить страницу здесь значило бы забрать ровно то, ради
 * чего фильтр и открыли.
 *
 * Даты — тем же `DateField`, часы — тем же `TimeField`, что и в панели записи.
 * Второй календарь и второй разбор «1430» разошлись бы с первыми на первой же
 * правке, а вопрос «какой день» и «который час» на всём продукте один.
 *
 * `PANEL_MOTION` — общая для всего проекта манера появления панелей: меню
 * вырастает из кнопки, которая его открыла.
 *
 * **Меню правит черновик, а таблицу меняет «Применить».** Пока кнопки не было,
 * фильтр применялся на каждое касание поля — и это правильно, когда фильтр
 * один; здесь же промежуток набирают из четырёх клеток, и таблица дёргалась бы
 * на каждой полузаполненной паре: выставил «с 10:00», не успел «до 18:00» — а
 * строк уже нет. Черновик копится, применяется целиком и закрывает меню, потому
 * что нажали именно затем, чтобы посмотреть результат.
 *
 * Черновик пересевается из применённого при каждом открытии: меню обязано
 * показывать то, что сейчас действует, а не то, что в нём набрали и бросили.
 *
 * **«Сбросить» действует сразу и не ждёт «Применить».** Сброс — это не
 * очередная правка промежутка, а отмена всего, и заставлять подтверждать отмену
 * значит просить два нажатия там, где смысл один. Показывается он, только когда
 * есть что сбрасывать: кнопка, которая ничего не делает, — это кнопка, о
 * которую спотыкаются.
 */
function FilterMenu({ filter, onFilter }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(filter)
  const set = (key) => (value) => setDraft({ ...draft, [key]: value })

  const show = (next) => {
    // Открываясь — показать действующее; закрываясь — забыть недонабранное.
    if (next) setDraft(filter)
    setOpen(next)
  }

  return (
    <Popover.Root open={open} onOpenChange={show}>
      <Popover.Trigger asChild>
        <StepButton
          label={t('inbox.filter')}
          icon={FilterHorizontalIcon}
          active={isFiltered(filter)}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className={`z-[70] w-[300px] rounded-xl border border-line bg-surface p-4 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] ${PANEL_MOTION}`}
        >
          <FilterGroup title={t('appointments.date')}>
            <DateField
              value={draft.dateFrom}
              onChange={set('dateFrom')}
              label={t('inbox.from')}
            />
            <DateField
              value={draft.dateTo}
              onChange={set('dateTo')}
              label={t('inbox.to')}
            />
          </FilterGroup>

          {/* 16px между группами против 8px внутри: одна ступень разницы — это
              и есть граница между «датой» и «временем». */}
          <FilterGroup title={t('appointments.time')} className="mt-4">
            {/* **Без `compact`.** Тот вариант — фиксированные 76px для карточки
                расписания, где четыре таких поля делят узкую колонку; здесь их
                два на всю ширину меню, и жаться им не от чего. Обычный
                `TimeField` — это `flex-1`, поэтому пара разъезжается до правого
                края и встаёт ровно под датами над ней: две строки полей, один
                край. */}
            <div className="flex items-center gap-2">
              <TimeField
                value={draft.timeFrom}
                onChange={set('timeFrom')}
                label={t('inbox.from')}
              />
              <span className="shrink-0 text-[13px] text-muted">—</span>
              <TimeField
                value={draft.timeTo}
                onChange={set('timeTo')}
                label={t('inbox.to')}
              />
            </div>
          </FilterGroup>

          {/* **`bg-accent` и `text-surface`, а не белый с чёрным литералами.**
              На тёмной теме акцент и есть белый — то, что просили, — а на
              светлой он чёрный, и текст на нём обязан перевернуться вместе с
              ним. Литеральная пара сделала бы кнопку нечитаемой ровно в одной
              из двух тем. Это же правило записано в `CLAUDE.md`: на сплошном
              акценте — `text-surface`, никогда не `text-white`. */}
          <button
            type="button"
            onClick={() => {
              onFilter(draft)
              setOpen(false)
            }}
            // **`h-10`, как у полей над ней, а не `h-9`.** Высоту в этом меню
            // задаёт `CONTROL` из `controls.js`, и она равна сорока: и
            // `DateField`, и `TimeField` дописывают к нему свой `h-9`, но две
            // утилиты одного свойства разрешаются порядком в собранной таблице
            // стилей, а там `.h-10` стоит после `.h-9` и выигрывает. Кнопка
            // единственная здесь без `FIELD`, поэтому её сорок надо назвать
            // вслух — иначе она одна на четыре пикселя ниже всего столбца.
            className="mt-4 h-10 w-full rounded-md bg-accent text-[14px] font-medium text-surface outline-none transition-[opacity,scale] hover:opacity-90 focus-visible:opacity-90 active:scale-[0.99]"
          >
            {t('inbox.filterApply')}
          </button>

          {isFiltered(filter) && (
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_FILTER)
                onFilter(EMPTY_FILTER)
              }}
              className="mt-3 w-full text-[13px] text-muted underline-offset-2 outline-none hover:text-ink hover:underline focus-visible:text-ink focus-visible:underline"
            >
              {t('inbox.filterReset')}
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Заголовок группы и поля под ним. 11px прописными — тот же шаг, что у шапки таблицы. */
function FilterGroup({ title, className = '', children }) {
  return (
    <div className={className}>
      <p className="pb-2 text-[11px] tracking-wide text-muted uppercase">
        {title}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

/**
 * Всё остальное — таблицей: одна запись в одну строку.
 *
 * **Таблица, а не список из двух строк.** У списка каждая запись читается
 * сверху вниз, и, чтобы сравнить две, глаз каждый раз ищет, где в них лежит
 * одно и то же. Здесь всё уже разложено по столбцам, и столбец сам себе
 * указатель: телефоны под телефонами, часы под часами. Ради этого таблица и
 * существует — не ради рамки.
 *
 * **Рамки как раз и нет.** Ни внешней, ни между столбцами, ни через строку —
 * только волосяная линия между соседними записями, и та несёт всю работу:
 * говорит, где кончается одна и начинается следующая. Вертикальные линии
 * разгородили бы то, что и так стоит в столбцах, а зебра покрасила бы половину
 * строк без всякого повода. Это правило дома, не вкус: см. «Tables carry no
 * frame» в `CLAUDE.md`.
 *
 * **`table-fixed` и проценты — обязательны вместе.** Без первого браузер меряет
 * столбцы по самому длинному значению, и «Кератин» против «Наращивание ресниц»
 * двигали бы всю сетку от строки к строке; без вторых нечего мерить. Оба нужны
 * ещё и затем, чтобы `truncate` вообще работал: обрезать можно только то, у
 * чего есть ширина.
 *
 * **Порядок — ближайшее сверху.** Список читают, чтобы узнать, что будет
 * дальше, и первым должно стоять то, что раньше наступит.
 *
 * Три состояния: не читали — ничего; прочитали и пусто — честная строка; иначе
 * таблица.
 *
 * **Пусто и пусто — разные пустоты, отсюда `narrowed`.** «Пока ничего нет»
 * говорит о деле: записей не существует. Но та же строка под включённым
 * фильтром соврала бы — записи есть, их просто отсекли, — и человек пошёл бы
 * искать пропажу вместо того, чтобы снять фильтр. Поэтому суженная таблица
 * отвечает «Ничего не найдено»: это про запрос, а не про мир.
 */
function BookingTable({ rows, narrowed = false }) {
  const t = useT()
  if (rows === null) return null

  if (rows.length === 0) {
    return (
      <p className="py-6 text-[13px] text-muted">
        {t(narrowed ? 'appointments.searchEmpty' : 'inbox.allEmpty')}
      </p>
    )
  }

  const sorted = [...rows].sort(
    (a, b) => new Date(a.startsAt) - new Date(b.startsAt),
  )

  return (
    // Прокручивается вбок, а не ломается: на узком окне пять столбцов ужимать
    // дальше некуда, и честнее увезти их за край, чем показать пять обрубков.
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[560px] table-fixed border-collapse text-left">
        {/* 11px, прописные, разрядка — тот же шаг, которым в этом проекте
            набраны все заголовки столбцов. Заголовок не строка данных, и
            линия под ним — та же, что между записями: он такой же сосед. */}
        <thead>
          <tr className="border-b border-line text-[11px] tracking-wide text-muted uppercase">
            <Th className="w-[24%]">{t('appointments.clientName')}</Th>
            <Th className="w-[20%]">{t('appointments.clientPhone')}</Th>
            <Th className="w-[16%]">{t('appointments.date')}</Th>
            <Th className="w-[16%]">{t('appointments.time')}</Th>
            <Th className="w-[24%]">{t('appointments.service')}</Th>
          </tr>
        </thead>

        <tbody className="divide-y divide-line">
          {sorted.map((row) => (
            /* **`group` — ради подсветки.** Заливка лежит на ячейках, а не на
               строке: у `<tr>` скругление не обрезает фон дочерних `<td>`, а
               подсветка во всю ширину с прямыми углами читается как выделенная
               полоса таблицы, а не как строка, которую можно взять. Поэтому
               `group` здесь и `group-hover` на ячейке — см. `Td`.

               Курсора-указателя нет намеренно: нажатие пока ничего не
               открывает, и стрелка честно об этом говорит. Подсветка сама по
               себе полезна и без него — она держит глаз на строке, когда тот
               идёт от имени к услуге через пять столбцов. Указатель добавится
               вместе с историей чата, к которой строка будет вести. */
            <tr key={row.id} className="group text-[14px] text-ink">
              {/* Имя — единственная полужирная ячейка: строку ищут по человеку,
                  а не по услуге или часу. */}
              <Td className="font-medium">{row.client}</Td>
              {/* `tabular-nums` на номере, дате и часах: цифры одной ширины,
                  иначе столбец из десяти строк выглядит рваным. */}
              <Td className="tabular-nums">{row.phone}</Td>
              <Td className="tabular-nums">{dayLabel(row.startsAt)}</Td>
              <Td className="tabular-nums">{row.range}</Td>
              <Td>{row.service}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Ячейки таблицы.
 *
 * Отдельными компонентами ради одного: отступы и `truncate` заданы в одном
 * месте. Пять столбцов — это пять шансов разойтись на пиксель, и они разойдутся
 * при первой же правке одного из них.
 *
 * `py-3` — та же вертикальная плотность, что у строк списка рядом; `pr-4` на
 * всех, кроме последнего, разводит столбцы воздухом вместо линейки.
 *
 * **Крайние ячейки поджаты на `pl-1` / `pr-1`, а не прижаты к краю.** Это те
 * самые 4px, на которые подсветка выходит за текст с обеих сторон: без них имя
 * упиралось бы в край заливки. Ровно 4px, потому что столько же у заголовка
 * секции (`px-1`) — столбец имён и слово «Все чаты» над ним обязаны стоять на
 * одной вертикали, а подсветка при этом всё равно шире текста.
 */
function Th({ className = '', children }) {
  return (
    <th
      scope="col"
      className={`truncate py-2 pr-4 font-medium first:pl-1 last:pr-1 ${className}`}
    >
      {children}
    </th>
  )
}

/**
 * Ячейка данных — она же носитель подсветки строки.
 *
 * **`bg-ink/12`, а не белый литерал.** Просили «чтобы загоралась белым», и на
 * тёмной теме это ровно она и есть: `--ink` там белый. Литеральный `white`
 * сделал бы то же самое сегодня и испортил бы светлую тему завтра — там строка
 * подсвечивалась бы белым по белому, то есть никак. Токен даёт белый там, где
 * фон тёмный, и тёмный там, где фон белый, а «загорается» остаётся правдой в
 * обеих.
 *
 * **12%, а не 6%, с которых начинали.** Шесть — это величина для ячейки
 * календаря 36×36, а здесь полоса во всю ширину колонки: чем крупнее пятно,
 * тем слабее читается тот же процент, и на чёрном фоне строка едва теплилась.
 * Двенадцать на нём дают примерно `surface-card` — ту самую заливку, которой в
 * этом проекте нарисована карточка, лежащая *на* чём-то. Строка под курсором
 * ровно такая и есть.
 *
 * Скругление — только на крайних ячейках, иначе оно легло бы на каждую из пяти
 * и строка распалась бы на пять таблеток.
 *
 * `transition-colors` остаётся и при `prefers-reduced-motion`: смена цвета под
 * курсором — не перемещение по экрану, а единственный отклик, который строка
 * вообще даёт. Уменьшенное движение — это «меньше и мягче», а не «ничего».
 */
function Td({ className = '', children }) {
  return (
    <td
      className={`truncate py-3 pr-4 transition-colors duration-150 ease-out group-hover:bg-ink/12 first:rounded-l-lg first:pl-1 last:rounded-r-lg last:pr-1 ${className}`}
    >
      {children}
    </td>
  )
}

/**
 * Дата записи — целиком и цифрами: `11.09.2026`.
 *
 * **Две цифры у дня и месяца, а не «сокращённо, как получится».** Столбец
 * набран `tabular-nums` ровно затем, чтобы числа стояли друг под другом; `9.9`
 * рядом с `11.09` этот строй ломает, а ведущий ноль держит. С месяцем словом
 * («9 сент.») строя не было вовсе: длина ячейки менялась от «мая» к «сентября».
 *
 * **Год стоит всегда.** Раньше он появлялся, только когда отличался от
 * текущего — на короткой подписи это экономило шум, но в таблице обернулось бы
 * тем, что часть строк на два знака короче остальных, то есть ровно тем, чего
 * столбец цифр избегает. Ряд одинаковых «2026» глаз пропускает; рваная колонка
 * — нет.
 *
 * Через `getLocale`, а не через жёсткое `ru-RU`: порядок частей даты — часть
 * перевода, и английская локаль ставит их иначе.
 */
function dayLabel(iso) {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''

  return at.toLocaleDateString(getLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Ряд папок.
 *
 * Три в ряд, дальше перенос на следующую строку.
 *
 * **Число карточек в ряду — это и есть их размер**, потому что ширину колонки
 * ряд занимает целиком в любом случае.
 *
 * Доля, а не `flex-1`: тот растянул бы карточки по остатку, и неполный
 * последний ряд выглядел бы иначе, чем полный. Из ста процентов вычитаются два
 * зазора между тремя карточками — ряд занимает всю ширину колонки, без
 * остатка справа; высота идёт за шириной через `viewBox` (см. `H`).
 */
function FolderRow({ rows }) {
  return (
    <div className="flex flex-wrap content-start gap-4 sm:gap-6">
      {rows.map((row, index) => (
        <Folder
          key={row.id}
          row={row}
          color={BOOKING_COLORS[index % BOOKING_COLORS.length]}
          className="w-[calc((100%-2rem)/3)] sm:w-[calc((100%-3rem)/3)]"
        />
      ))}
    </div>
  )
}

/**
 * Заголовок и карточка под ним, во всю оставшуюся высоту.
 *
 * **`flex-1 min-h-0` на секции и на карточке.** Первое отдаёт ей высоту
 * колонки, второе — то, без чего это не работает: элемент flex не сжимается
 * меньше своего содержимого, пока ему не разрешат.
 *
 * Внутри пусто: содержимое появится, когда будет решено, что эта секция
 * показывает.
 */
function Panel({ title, count, children }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <SectionHeading title={title} count={count} />
      {/* Без рамки: `surface-raised` — заливка, которая сама отделяет блок от
          фона в обеих темах. */}
      <div className={`flex min-h-0 flex-1 flex-col ${CARD_EDGE} p-5`}>
        {children}
      </div>
    </section>
  )
}

/**
 * Запись — в то, что рисует карточка.
 *
 * **Своей функции у этого экрана больше нет — он зовёт `toBlock`.** Карточке
 * нужен промежуток целиком, а собрать его из двух `clock()` значило бы завести
 * второй ответ на вопрос, у которого ответ уже есть: `toBlock` строит `range`,
 * и он же знает, что у записи без конца это «15:00 –», а не «15:00 – 15:00».
 * Та же строка, что рисует сетка «Записей», — значит, два экрана не могут
 * разойтись в том, сколько длится одна и та же запись.
 */

/* --------------------------------------------------------------------------
 * ВРЕМЕННО — УДАЛИТЬ ВМЕСТЕ С ЭТИМ БЛОКОМ.
 *
 * Три строки, чтобы было на чём смотреть форму карточки, пока на сегодня нет
 * ни одной настоящей записи — тот же приём, что и у снятого блока «Все чаты».
 *
 * Форма — сырая, как у API, а не как у карточки: строки проходят через тот же
 * `toBlock`, что и настоящие, иначе демо показывало бы то, чего продакшен не
 * умеет. Третья — намеренно без `ends_at`: запись без конца это разрешённый
 * случай, и «15:00 –» на карточке лучше увидеть здесь, чем в первый раз на
 * чужом экране.
 * ----------------------------------------------------------------------- */
const DEMO_TODAY_ROWS = [
  {
    id: 'demo-today-1',
    client_name: 'Айгерим Сапарова',
    client_phone: '+7 701 555 33 22',
    service_name: 'Шаш алу',
    starts_at: '2026-09-09T15:00:00',
    ends_at: '2026-09-09T16:00:00',
  },
  {
    id: 'demo-today-2',
    client_name: 'Ерлан Тоқтар',
    client_phone: '+7 771 604 29 38',
    service_name: 'Сақал қию',
    starts_at: '2026-09-09T16:30:00',
    ends_at: '2026-09-09T17:15:00',
  },
  {
    id: 'demo-today-3',
    client_name: 'Гүлнұр Асқар',
    client_phone: '+7 700 852 47 63',
    service_name: 'Кератин',
    starts_at: '2026-09-09T18:15:00',
    ends_at: null,
  },
]

/*
 * То же самое для таблицы внизу — и дни здесь нарочно разные.
 *
 * Столбец «Дата» в таблице из трёх сегодняшних записей выглядел бы одинаковым
 * сверху донизу, то есть не показал бы себя вовсе; а он там как раз затем,
 * что окно у таблицы шире одного дня.
 *
 * Длинное название услуги — тоже намеренно: `truncate` в столбце на 24% надо
 * увидеть на строке, которая в него не влезает, а не поверить, что он есть.
 */
const DEMO_ALL_ROWS = [
  {
    id: 'demo-all-1',
    client_name: 'Данагүл Ермек',
    client_phone: '+7 708 441 76 15',
    service_name: 'Бояу',
    starts_at: '2026-09-11T09:45:00',
    ends_at: '2026-09-11T11:00:00',
  },
  {
    id: 'demo-all-2',
    client_name: 'Мадина Қайрат',
    client_phone: '+7 702 318 55 71',
    service_name: 'Наращивание ресниц',
    starts_at: '2026-09-14T12:00:00',
    ends_at: '2026-09-14T13:30:00',
  },
  {
    id: 'demo-all-3',
    client_name: 'Сая Бекзат',
    client_phone: '+7 775 236 90 14',
    service_name: 'Маникюр',
    starts_at: '2026-09-18T16:00:00',
    ends_at: '2026-09-18T17:00:00',
  },
]
/* ------------------------------------------------------------ конец блока */

/**
 * Размеры папки — всё, чем задаётся её форма.
 *
 * Названными числами, а не магической строкой пути: форму подгоняют на глаз, и
 * подгонка должна быть правкой одного числа, а не пересчётом координат. Всё в
 * единицах `viewBox`, поэтому меняется только пропорция, а не размер на экране.
 */
const W = 400 // ширина
const H = 270 // высота
/* **270, потому что ряд перестал оставлять пустое место справа.** Карточка
   выросла в ширину ровно на те 10%, которые раньше отрезал множитель `* 0.9`,
   а высота у неё идёт за шириной через `aspect-ratio` — так что, чтобы она
   осталась той же, отношение обязано сузиться на те же 10%: 300 → 270.

   Считать высоту отдельно от ширины (фиксированный `h-[…]` плюс растянутый
   `preserveAspectRatio="none"`) было бы проще и неверно: у фигуры со
   скруглениями стороны нельзя тянуть независимо — углы из кругов станут
   эллипсами. Пропорция живёт в `viewBox`, и менять её надо здесь.

   Саму фигуру это не ломает: путь пересобирается из констант, `R` остаётся
   прежним, а `TAB`, `SLOPE` и `DROP` заданы в единицах ширины и высоты по
   отдельности. */
const R = 28 // радиус углов
const TAB = 172 // где кончается ровная верхняя грань язычка
const SLOPE = 62 // ширина перехода: от конца язычка до верхней грани тела
const DROP = 30 // насколько верх тела ниже верха язычка
/**
 * Насколько переход «залипает» на горизонтали у своих концов, долей `SLOPE`.
 *
 * Это и есть плавность стыка. Ноль дал бы прямой отрезок и два тупых угла — то,
 * с чего этот контур начинался и от чего уходит. Половина — чистая S-образная
 * кривая, у которой середина почти не наклонена. 0.42 оставляет середину
 * наклонной, а к обоим концам подводит по касательной.
 */
const EASE = 0.42

/**
 * Контур папки, одним путём.
 *
 * **Один путь, а не два наложенных прямоугольника.** Через `div`-ы язычок и
 * тело стыкуются под прямым углом, и переход выходит тупым уступом — ровно то,
 * чего здесь быть не должно. Правый край язычка обязан уходить вниз наклоном и
 * входить в верхнюю грань тела плавно, со скруглением на обоих концах наклона,
 * а это кривая: описать её можно только контуром.
 *
 * Заодно контур снимает то, ради чего раньше приходилось изворачиваться:
 * силуэт один, внутреннего стыка нет, поэтому неоткуда взяться шву и незачем
 * подменять тень `drop-shadow` на обёртке.
 *
 * Переход — **одна кубическая кривая с горизонтальными касательными на обоих
 * концах**, а не отрезок между двумя скруглениями. У отрезка со скруглениями
 * стык гладкий только по положению: наклон меняется скачком, и глаз ловит на
 * кривой две точки перелома. У кубики с касательной, совпадающей с гранью,
 * которую она продолжает, наклон нарастает от нуля — стык не виден вовсе.
 *
 * **Углы — не дуги.** Дуга и есть окружность, и стык у неё гладкий только по
 * касательной: наклон совпадает, а кривизна прыгает с `1/R` на ноль в одной
 * точке. Глаз ловит именно этот скачок — угол читается как поджатый, «резкий»,
 * хотя излома в нём нет. Тот же изъян у `border-radius`, и по той же причине
 * iOS рисует скругления суперэллипсом, а не окружностью.
 *
 * Поэтому каждый угол — **кубика, начатая раньше и законченная позже**, чем
 * начался бы круг: кривая отходит от грани за `SMOOTH * R` до угла и приходит
 * к следующей на столько же после, а ручки, лежащие на самих гранях, держат
 * касательную. Кривизна нарастает и спадает постепенно, и поворот выходит
 * плавным.
 *
 * `SMOOTH = 1` и `PULL = 0.5523` вернули бы ровно окружность — это те самые
 * магические константы, которыми круг приближают кубикой. Сдвиг к `1.6 / 0.7`
 * и есть «сглаживание угла»: примерно то же, что 60% corner smoothing в Figma.
 */
/** Насколько раньше угла начинается поворот, долями радиуса. */
const SMOOTH = 1.6
/** Насколько ручки не доходят до угла, долями получившегося отступа. */
const PULL = 0.7

/** Отступ поворота от угла и вылет ручек — считаются один раз. */
const E = R * SMOOTH
const HANDLE = E * PULL

const FOLDER_PATH = [
  // Верхняя грань язычка, от левого угла до его среза.
  `M ${E} 0`,
  `L ${TAB} 0`,
  // Срез язычка: одна кубика с горизонтальными касательными на обоих концах.
  `C ${TAB + SLOPE * EASE} 0`,
  `  ${TAB + SLOPE * (1 - EASE)} ${DROP}`,
  `  ${TAB + SLOPE} ${DROP}`,
  // Верхняя грань тела → правый верхний угол.
  `L ${W - E} ${DROP}`,
  `C ${W - E + HANDLE} ${DROP} ${W} ${DROP + E - HANDLE} ${W} ${DROP + E}`,
  // Правая грань → правый нижний угол.
  `L ${W} ${H - E}`,
  `C ${W} ${H - E + HANDLE} ${W - E + HANDLE} ${H} ${W - E} ${H}`,
  // Нижняя грань → левый нижний угол.
  `L ${E} ${H}`,
  `C ${E - HANDLE} ${H} 0 ${H - E + HANDLE} 0 ${H - E}`,
  // Левая грань → левый верхний угол, и замыкание.
  `L 0 ${E}`,
  `C 0 ${E - HANDLE} ${E - HANDLE} 0 ${E} 0`,
  'Z',
].join(' ')

/**
 * Карточка в виде папки.
 *
 * **Пропорция живёт в `viewBox`, а не в `aspect-*` на обёртке.** У фигуры со
 * скруглениями стороны нельзя тянуть независимо — углы поплывут.
 *
 * **Фигура — фоновый слой, содержимое — обычный HTML поверх.** `foreignObject`
 * умеет вложить разметку внутрь SVG, но тянет за собой свои правила переноса
 * строк и переполнения, а здесь нужен ровно тот же текст, что и во всём
 * приложении. Обёртка держит ту же пропорцию, что и `viewBox`, поэтому SVG
 * ложится в неё точно, без искажения углов.
 *
 * **Верх содержимого отсчитан от `DROP`, а не задан на глаз.** Текст обязан
 * начинаться под язычком: `top` в процентах считается от высоты
 * контейнера — в отличие от процентного `padding`, который считался бы от
 * ширины, — поэтому доля берётся честная, `DROP / H`, и остаётся верной на
 * любом размере карточки.
 *
 * **Заливка — `surface-raised`.** Тот самый случай, ради которого токен и
 * заведён: `surface` на тёмной теме — тот же чёрный, что и фон, и папка без
 * рамки была бы ничем.
 */
function Folder({ row, color, className = '' }) {
  return (
    <article
      className={`relative ${className}`}
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        // Фигура декоративная: читать в ней нечего, и озвучивать тоже — всё,
        // что нужно прочесть, лежит текстом поверх неё.
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        {/* Через атрибут, а не классом: `fill-*` Tailwind соберёт только для
            зарегистрированного цвета, а обращение к переменной надёжнее прямо
            здесь — и видно, какой именно токен рисует фигуру.

            **Тот же край, что у остальных карточек, только обводкой.** Папка —
            карточка на странице, и оставить её единственной без края значило бы
            завести исключение из правила ради того, что оно нарисовано другим
            способом. `CARD_EDGE` тут не подходит: у SVG нет `border`, край
            задаётся `stroke` по самому контуру.

            **`vectorEffect="non-scaling-stroke"` — не мелочь.** Толщина обводки
            считается в единицах `viewBox` (400 в ширину), а карточка на экране
            около 270px, так что единица превратилась бы в две трети пикселя, и
            линия вышла бы бледнее хайрлайна у соседей. С этим атрибутом
            толщина берётся в пикселях экрана, и край получается ровно такой же,
            как у карточек с `border`. */}
        <path
          d={FOLDER_PATH}
          fill="var(--color-surface-raised)"
          stroke="var(--color-line)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div
        className="absolute inset-x-0 bottom-0 flex flex-col p-3"
        style={{ top: `${(DROP / H) * 100}%` }}
      >
        {/* Имя и метка в одной строке. Точка выровнена по первой строке, а не
            по центру блока: имя бывает и в две строки, и тогда центр уезжает
            вниз, а метка должна стоять там, где начинается чтение. */}
        <div className="flex min-w-0 gap-1.5">
          <span
            className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          {/* 17, а не 15: карточка стала шире (три в ряд вместо четырёх), и на
              этой ширине имя на 15 читалось мельче, чем весит — это первое, что
              на карточке ищут. Шаг тот же, что у подзаголовков на телефоне. */}
          {/* `font-medium`, а не `semibold`: имя остаётся самой заметной
              строкой карточки за счёт кегля, а не за счёт веса — двух ступеней
              размера над телефоном для этого достаточно, и лишний вес только
              утяжелял блок из четырёх строк. */}
          <p className="min-w-0 font-display text-[17px] leading-snug font-medium text-ink">
            {row.client}
          </p>
        </div>

        {/* Всё, что ниже, начинается от левого края — как в образце, где дата
            стоит по левому краю карточки, а не под заголовком. Отступ под имя
            выстроил бы вторую вертикаль внутри блока шириной в треть ряда:
            два края вместо одного читаются как две колонки, которых здесь нет.

            **Весь текст карточки — `ink`, ни одной строки в `muted`.** Разводит
            их вес и размер, а не цвет: имя полужирное и на ступень крупнее,
            остальное — ровный ряд фактов, и ни один из них не приписка к
            другому.

            `ink`, а не литеральный `white`: на тёмной теме это и есть белый, а
            на светлой — почти чёрный. Литерал сделал бы карточку нечитаемой
            ровно в одной из двух тем, и в какой именно — зависит от того, в
            какой её смотрели последней.

            **15, а не 13: номер вырос вместе с именем и держит от него ту же
            дистанцию в два пункта.** Это единственная строка карточки, которую
            переписывают в чужой телефон по одной цифре, — а услуга внизу
            остаётся на 13, потому что её узнают по первым буквам, и разница в
            кегле теперь сама говорит, какая из двух строк важнее. */}
        <p className="mt-1 min-w-0 truncate text-[15px] text-ink tabular-nums">
          {row.phone}
        </p>

        {/* **Промежуток целиком, а не одно начало.** Начало отвечало только на
            «во сколько», и следом всё равно вставал второй вопрос — «до
            скольки»; на него до сих пор отвечала дата, то есть строка, которую
            в секции «сегодня» и так знают наперёд. Дата ушла, промежуток занял
            её место в смысле, а не в разметке: время остаётся самой крупной
            строкой карточки, потому что за этим на неё и смотрят.

            **`range` из `lib/appointments.js`, а не собственный формат.** Та же
            строка, что рисует сетка «Записей», — и главное, тот же ответ на
            запись без конца: у неё остаётся «15:00 –», где отсутствие второго
            числа и есть факт, а не недосмотр. Своя склейка двух `clock()` эту
            разницу потеряла бы.

            `my-auto`: пустота делится поровну сверху и снизу, и время встаёт в
            середине свободного места, а не прижимается к строке под ним.

            `tabular-nums` — цифры одной ширины: без них «11:30» и «14:45»
            занимают разную длину, и в ряду столбец времени выглядит неровным. */}
        {/* **Крупному кеглю вес не нужен.** На 24px `semibold` читался как
            жирный заголовок, хотя это просто число: чем больше размер, тем
            меньше веса требуется, чтобы строка держала внимание. `font-medium`
            оставляет её самой громкой на карточке и снимает тяжесть. */}
        <p className="my-auto min-w-0 truncate font-display text-[24px] leading-none font-medium tracking-[-0.02em] text-ink tabular-nums">
          {row.range}
        </p>

        {/* Услуга там, где стояла дата. Наверх, к имени, она не идёт: имя — это
            «кто», услуга — «за чем», и на разных строках они читаются как два
            факта, а не как одна подпись. Прижимать её нечем — это уже делает
            `my-auto` на времени выше, и второй автоотступ в той же колонке
            просто поделил бы остаток ещё раз. */}
        <div className="flex items-end justify-between gap-2">
          <p className="min-w-0 truncate text-[13px] text-ink">{row.service}</p>
          {/* Три точки, а не сетка из девяти: девять означают «все приложения»,
              а не «действия над этим». Пока ничего не открывает. */}
          <HugeiconsIcon
            icon={MoreHorizontalIcon}
            size={16}
            strokeWidth={2}
            className="shrink-0 text-ink"
          />
        </div>
      </div>
    </article>
  )
}
