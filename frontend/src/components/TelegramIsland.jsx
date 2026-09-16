import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, TelegramIcon, UserIcon } from '@hugeicons/core-free-icons'
import {
  animate,
  domAnimation,
  LazyMotion,
  m,
  useMotionValue,
  useReducedMotion,
} from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listConversations } from '../lib/api'
import { authed } from '../lib/auth'
import { clientName, initials, timeAgo } from '../lib/conversations'
import { useT } from '../lib/i18n'
import {
  project,
  rubberband,
  SPRING,
  velocityFrom,
  VELOCITY_WINDOW,
} from '../lib/motion'

/** Как часто спрашивать, не написал ли кто, — ритм открытого треда. */
const POLL_MS = 5000
/** Сколько уведомление держится само, если его не трогать. */
const SHOW_MS = 6000
/**
 * Высота острова и, значит, диаметр свёрнутого круга. **Остров целиком живёт
 * внутри шапки**: шапка 68px, остров 52px с 8px сверху — снизу остаётся столько
 * же воздуха, и страница под шапкой ничем не перекрыта. Две строки по 16 —
 * имя и сообщение — плюс поля.
 */
const DOT = 52
/**
 * Радиус раскрытой карточки. Не полный круг: у пилюли концы — две
 * полуокружности, и текст зажат между ними. 16px на 52px высоты — та же
 * пропорция, что 22px у раскрытого Dynamic Island. Свёрнутый круг — `DOT / 2`,
 * и радиус едет вместе с шириной, так что круг *становится* карточкой.
 */
const RADIUS = 16
/** Во сколько раскрывается; на узком экране — во всю ширину минус поля. */
const MAX_WIDTH = 400
/** Где остров прячется: выше шапки целиком. */
const RISE = -96
/** Сколько пикселей движения отличают перетаскивание от нажатия. */
const DRAG_PX = 10
/** Куда должен *лететь* бросок вверх, чтобы остров ушёл. */
const FLICK_PX = -24

/**
 * Новое сообщение клиента из Telegram — островом посреди шапки.
 *
 * **Одеждой — этот сайт, а не iPhone.** Монохром: знак Telegram белым в той же
 * `ink/12`-подложке, что аватары и круглые кнопки «Диалогов», без фирменного
 * синего — в продукте нет ни одного цветного акцента, и первый не должен
 * появиться ради уведомления. Сама пилюля — край карточки (`surface-raised` +
 * хайрлайн `line`), плюс тень «плавающего» уровня, потому что она лежит поверх
 * страницы. Всё в ней `ink`; вторичное только время.
 *
 * **Движением — Apple.**
 * - *Пружины без отскока* (`SPRING`, bounce 0): уведомление прилетает само, его
 *   никто не бросал, а отскок у Apple — только для брошенного.
 * - *Одно непрерывное движение*, а не цепочка «упал → подождал → раскрылся»:
 *   круг опускается и через 0.12s, пока ещё едет, начинает раздаваться — так
 *   промежуточные кадры с первого же показывают, во что это превращается.
 *   Текст проявляется из размытия (`blurReplace`) уже на растущей пилюле.
 * - *Уходит тем же путём*: текст гаснет, пилюля собирается в круг, круг
 *   поднимается туда, откуда пришёл.
 * - *Прерываемо в любой момент.* Всё — `MotionValue` и `animate`, поэтому
 *   каждое новое движение начинается с того, что на экране, и забирает текущую
 *   скорость. Новое сообщение посреди ухода разворачивает остров обратно, а не
 *   ждёт в очереди; остров можно схватить на лету.
 * - *Смахивается вверх, как баннер iOS.* Тянется за пальцем или мышью 1:1 от
 *   точки захвата, вниз — с резиной; решение уйти принимается по тому, куда
 *   летел жест (`позиция + project(скорость)`), и скорость отпускания уходит в
 *   пружину ухода, без шва.
 * - *Отклик на нажатие*: вся пилюля и × проседают сразу, на pointer-down.
 * - Под `prefers-reduced-motion` ничто не едет и не раздаётся — остров
 *   проявляется на месте; смахнуть его можно, движение своим пальцем не
 *   вестибулярное.
 *
 * **Держится шесть секунд и не уходит из-под руки**: пока курсор, палец или
 * фокус на острове, таймер стоит. × закрывает, нажатие на остальное открывает
 * чат в «Диалогах» (`/inbox?chat=<id>`).
 *
 * **Опрос, потому что пуша нет**: `GET /conversations` раз в пять секунд, пока
 * вкладка видна. Первое чтение — точка отсчёта; уведомлением становится ветка,
 * чьё последнее сообщение новее увиденного, написано клиентом и пришло из
 * Telegram. Ветка, которой не было в первом чтении, — только если сообщение
 * моложе открытия страницы (с минутой на расхождение часов), иначе возврат
 * старой ветки из архива объявил бы давнее сообщение.
 */
export default function TelegramIsland() {
  const t = useT()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const [note, setNote] = useState(null)
  // Текст виден: `false`, пока пилюля уходит.
  const [shown, setShown] = useState(false)
  const [held, setHeld] = useState(false)

  const y = useMotionValue(RISE)
  const width = useMotionValue(DOT)
  const opacity = useMotionValue(0)
  const radius = useMotionValue(DOT / 2)
  const full = useRef(MAX_WIDTH)

  const noteRef = useRef(null)
  const leaving = useRef(false)
  const running = useRef([])
  // Номер текущего движения: завершение старого не должно убрать новое.
  const generation = useRef(0)

  const stop = () => {
    running.current.forEach((animation) => animation.stop())
    running.current = []
  }

  const present = (next) => {
    const fresh = !noteRef.current
    generation.current += 1
    leaving.current = false
    stop()

    if (fresh) {
      full.current = Math.min(MAX_WIDTH, window.innerWidth - 32)
      y.jump(reduce ? 0 : RISE)
      width.jump(reduce ? full.current : DOT)
      radius.jump(reduce ? RADIUS : DOT / 2)
      opacity.jump(0)
    }
    noteRef.current = next
    setNote(next)
    setShown(true)

    running.current = reduce
      ? [animate(opacity, 1, { duration: 0.2 })]
      : [
          animate(y, 0, SPRING),
          animate(opacity, 1, { duration: 0.2 }),
          animate(width, full.current, { ...SPRING, delay: fresh ? 0.12 : 0 }),
          animate(radius, RADIUS, { ...SPRING, delay: fresh ? 0.12 : 0 }),
        ]
  }

  const dismiss = (velocity = 0) => {
    if (!noteRef.current || leaving.current) return
    leaving.current = true
    const mine = ++generation.current
    stop()
    setShown(false)

    const thrown = velocity < -50
    running.current = reduce
      ? [animate(opacity, 0, { duration: 0.2 })]
      : [
          animate(width, DOT, { ...SPRING, visualDuration: 0.35 }),
          animate(radius, DOT / 2, { ...SPRING, visualDuration: 0.35 }),
          // Брошенный уходит сразу и со своей скоростью; закрытый — после
          // того как начал собираться в круг, тем же путём, каким пришёл.
          animate(y, RISE, {
            ...SPRING,
            visualDuration: 0.35,
            velocity,
            delay: thrown ? 0 : 0.15,
          }),
          animate(opacity, 0, { duration: 0.2, delay: thrown ? 0.08 : 0.3 }),
        ]

    Promise.all(running.current).then(() => {
      if (generation.current !== mine) return
      leaving.current = false
      noteRef.current = null
      setNote(null)
      setHeld(false)
    })
  }

  const presentRef = useRef(present)
  presentRef.current = present
  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss

  // Опрос.
  useEffect(() => {
    let alive = true
    let seen = null
    const since = Date.now() - 60_000

    const read = () =>
      authed((token) =>
        listConversations(token, { archived: false, deleted: false, limit: 100 }),
      )
        .then((rows) => {
          if (!alive) return
          const first = seen === null
          const before = seen ?? new Map()
          seen = new Map()
          let newest = null

          for (const row of rows) {
            if (!row.last_message_at) continue
            const at = Date.parse(row.last_message_at)
            seen.set(row.id, at)
            if (first) continue
            if (
              at > (before.get(row.id) ?? since) &&
              row.channel === 'telegram' &&
              row.last_message_author === 'client' &&
              (!newest || at > newest.at)
            ) {
              newest = { row, at }
            }
          }

          if (newest) {
            const { row, at } = newest
            presentRef.current({
              key: `${row.id}-${at}`,
              id: row.id,
              name: clientName(row, t('chat.noName')),
              // Из имени или @username, но не из номера и не из «Без имени».
              initials: initials(row.client_name || row.client_username),
              at: row.last_message_at,
              text: row.last_message_preview ?? '',
              // Остальные непрочитанные этой ветки — «ещё N», а не потерянные.
              more: Math.max(0, (row.unread_count ?? 1) - 1),
            })
          }
        })
        .catch(() => {})

    read()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') read()
    }, POLL_MS)
    const wake = () => document.visibilityState === 'visible' && read()
    document.addEventListener('visibilitychange', wake)

    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', wake)
    }
    // `t` намеренно не в зависимостях: смена языка не повод сбрасывать точку
    // отсчёта.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Шесть секунд — заново на каждое сообщение; стоят, пока остров держат.
  useEffect(() => {
    if (!shown || held) return
    const timer = setTimeout(() => dismissRef.current(), SHOW_MS)
    return () => clearTimeout(timer)
  }, [shown, held, note?.key])

  // ——— Жест ———
  const press = useRef(null)
  const dragged = useRef(false)

  const onPointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('[data-island-close]')) return
    // Схватить остров на лету — значит остановить его там, где он сейчас:
    // уходящий перестаёт уходить и дальше идёт за рукой.
    stop()
    if (leaving.current) {
      generation.current += 1
      leaving.current = false
      setShown(true)
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragged.current = false
    press.current = {
      id: event.pointerId,
      offset: event.clientY - y.get(),
      origin: event.clientY,
      trail: [{ at: performance.now(), value: y.get() }],
    }
    setHeld(true)
  }

  const onPointerMove = (event) => {
    const now = press.current
    if (!now || now.id !== event.pointerId) return
    if (!dragged.current && Math.abs(event.clientY - now.origin) < DRAG_PX) return
    dragged.current = true
    const raw = event.clientY - now.offset
    const next = raw <= 0 ? raw : rubberband(raw, DOT)
    y.set(next)
    const at = performance.now()
    now.trail.push({ at, value: next })
    while (now.trail.length > 2 && at - now.trail[1].at > VELOCITY_WINDOW) {
      now.trail.shift()
    }
  }

  const onPointerUp = (event) => {
    const now = press.current
    if (!now || now.id !== event.pointerId) return
    press.current = null
    if (event.pointerType !== 'mouse') setHeld(false)
    const velocity = dragged.current ? velocityFrom(now.trail) : 0
    // Флаг гасит только тот `click`, что браузер пришлёт сразу за этим
    // отпусканием; дольше он жить не должен, иначе следующее нажатие —
    // клавишей или на новом уведомлении — молча пропадёт.
    if (dragged.current) setTimeout(() => (dragged.current = false), 0)
    if (dragged.current && y.get() + project(velocity) < FLICK_PX) {
      dismissRef.current(velocity)
      return
    }
    // Не бросили — остров возвращается на место с той скоростью, с какой его
    // отпустили, и доводит всё, что остановило касание.
    running.current = [
      animate(y, 0, { ...SPRING, velocity }),
      animate(width, full.current, SPRING),
      animate(radius, RADIUS, SPRING),
      animate(opacity, 1, { duration: 0.2 }),
    ]
  }

  const open = (event) => {
    // Крестик закрывает, а не открывает: его `click` всплывает сюда же.
    if (event.target.closest('[data-island-close]')) return
    // Отпущенное после перетаскивания — не нажатие.
    if (dragged.current) {
      dragged.current = false
      return
    }
    if (!noteRef.current) return
    navigate(`/inbox?chat=${noteRef.current.id}`)
    dismissRef.current()
  }

  const reveal = {
    gone: { opacity: 0, filter: 'blur(6px)', transition: { duration: 0.12 } },
    shown: {
      opacity: 1,
      filter: 'blur(0px)',
      transition: { duration: 0.3, delay: reduce ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] },
    },
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center"
    >
      {note && (
        <LazyMotion features={domAnimation} strict>
          {/* Внешний слой несёт движение, жест и ×; внутренний — форму и
              обрезку. Раздельно, потому что × висит *за* краем карточки, а
              `overflow-hidden`, нужный растущей ширине, срезал бы его. */}
          <m.div
            style={{ y, width, opacity, height: DOT }}
            whileTap={{ scale: 0.97 }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerEnter={() => setHeld(true)}
            onPointerLeave={() => !press.current && setHeld(false)}
            // **Открытие слушает сама карточка, а не кнопка внутри.** Захват
            // указателя (`setPointerCapture` при нажатии) переносит `pointerup`
            // на карточку, и Chrome шлёт `click` ей, а не кнопке под пальцем.
            // Клавиатура по-прежнему жмёт кнопку, и её `click` всплывает сюда.
            onClick={open}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
            className="group pointer-events-auto relative touch-none select-none"
          >
            <m.div
              style={{ borderRadius: radius }}
              className="h-full overflow-hidden border border-card-edge bg-surface-raised shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)]"
            >
              {/* Ряд сразу финальной ширины: текст не переносится, пока
                  карточка растёт, а обрезается её краем. Левое поле — чтобы
                  36px аватар стоял ровно в центре свёрнутого 52px круга. */}
              <button
                type="button"
                aria-label={t('island.open', { name: note.name })}
                className="flex h-full items-center gap-2.5 pr-3.5 pl-[7px] text-left outline-none"
                style={{ width: full.current - 2 }}
              >
                {/* Кто написал — главное; из какого приложения — значок в углу,
                    как у «коммуникационных» уведомлений iOS. */}
                <span className="relative shrink-0">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-ink/12 text-[13px] font-semibold text-ink">
                    {note.initials ?? (
                      <HugeiconsIcon icon={UserIcon} size={16} strokeWidth={2} />
                    )}
                  </span>
                  <span className="absolute -right-0.5 -bottom-0.5 grid h-4 w-4 place-items-center rounded-full bg-ink text-surface ring-2 ring-surface-raised">
                    <HugeiconsIcon icon={TelegramIcon} size={10} strokeWidth={2.2} />
                  </span>
                </span>

                <m.span
                  key={note.key}
                  initial="gone"
                  animate={shown ? 'shown' : 'gone'}
                  variants={reveal}
                  className="flex min-w-0 flex-1 flex-col"
                >
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate text-[14px] leading-4 font-semibold text-ink">
                      {note.name}
                    </span>
                    {/* Остальные непрочитанные этой ветки — числом рядом с
                        именем: третьей строки в шапке нет. */}
                    {note.more > 0 && (
                      <span className="shrink-0 text-[12px] leading-4 text-muted tabular-nums">
                        +{note.more}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 pl-1 text-[12px] leading-4 text-muted">
                      {timeAgo(note.at)}
                    </span>
                  </span>
                  <span className="mt-0.5 truncate text-[13px] leading-4 text-ink">
                    {note.text}
                  </span>
                </m.span>
              </button>
            </m.div>

            {/* × как у уведомлений macOS: в левом верхнем углу и только под
                курсором или с клавиатуры — всегда видимый крестик забирал
                половину веса карточки. Где курсора нет, его нет вовсе:
                уведомление смахивается вверх. */}
            <button
              type="button"
              data-island-close
              onClick={() => dismissRef.current()}
              aria-label={t('island.close')}
              className="pointer-events-none absolute -top-1.5 -left-1.5 grid h-[22px] w-[22px] place-items-center rounded-full border border-card-edge bg-surface-raised text-ink opacity-0 shadow-[0_2px_8px_rgba(23,18,21,0.18)] outline-none transition-[opacity,scale,background-color] duration-150 ease-out group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-surface-chip focus-visible:pointer-events-auto focus-visible:opacity-100 active:scale-90 [@media(hover:none)]:hidden"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={2.4} />
            </button>
          </m.div>
        </LazyMotion>
      )}
    </div>
  )
}
