import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, TelegramIcon } from '@hugeicons/core-free-icons'
import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listConversations } from '../lib/api'
import { authed } from '../lib/auth'
import { clientName } from '../lib/conversations'
import { getLocale, useT } from '../lib/i18n'

/** Как часто спрашивать, не написал ли кто, — ритм открытого треда. */
const POLL_MS = 5000
/** Сколько уведомление держится само, если его не трогать. */
const SHOW_MS = 6000
/** Свёрнутый остров — круг под иконку: 36px знак и по 6px вокруг. */
const DOT = 48
/** Во сколько раскрывается; на узком экране — во всю ширину минус поля. */
const MAX_WIDTH = 400
/** Насколько выше шапки остров прячется до и после показа. */
const RISE = -64

const spring = (bounce, visualDuration) => ({ type: 'spring', bounce, visualDuration })

/**
 * Новое сообщение клиента из Telegram — островом посреди шапки.
 *
 * **Форма — Dynamic Island, и порядок движений оттуда же.** Круг с иконкой
 * падает сверху и чуть пружинит (он *прилетел*), потом раздаётся в обе стороны
 * в пилюлю, и только тогда проявляется текст — имя, время, что написано.
 * Уходит в обратном порядке: текст гаснет, пилюля собирается в круг, круг
 * уезжает вверх, туда, откуда пришёл. Ширина здесь анимируется честно, а не
 * через `scale`: остров лежит поверх шапки абсолютно и никого не двигает, а
 * `scaleX` растянул бы круг в овал и сплющил буквы.
 *
 * **Текст не переносится, пока пилюля растёт**: внутренний ряд сразу
 * финальной ширины и обрезается краем, как поле поиска в «Диалогах».
 *
 * **Живёт в шапке, а значит на каждом экране панели**, и сам спрашивает
 * сервер раз в пять секунд — пуша в проекте нет. Первое чтение — точка отсчёта:
 * всё, что пришло до открытия страницы, уведомлением не становится. Считается
 * только последнее сообщение ветки, и только если его написал клиент в
 * Telegram; архив и корзина не смотрятся (клиент, написавший в корзину, из неё
 * выходит сам).
 *
 * **Держится шесть секунд и не уходит из-под курсора**: пока на острове мышь
 * или фокус, таймер стоит. × закрывает, нажатие на остальное открывает этот
 * чат в «Диалогах». Новое сообщение, пришедшее пока остров открыт, заменяет
 * текст и начинает шесть секунд заново; пришедшее, пока остров уходит, ждёт и
 * показывается следом.
 *
 * Под `prefers-reduced-motion` ничто не падает и не раздаётся — остров
 * проявляется сразу раскрытым и гаснет на месте.
 */
export default function TelegramIsland() {
  const t = useT()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const [note, setNote] = useState(null)
  // hidden → dot → open → fade → close → leave → hidden
  const [phase, setPhase] = useState('hidden')
  const [width, setWidth] = useState(MAX_WIDTH)
  const [held, setHeld] = useState(false)

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const waiting = useRef(null)

  const arrive = (next) => {
    const now = phaseRef.current
    if (now === 'hidden') {
      setWidth(Math.min(MAX_WIDTH, window.innerWidth - 32))
      setNote(next)
      setPhase(reduce ? 'open' : 'dot')
    } else if (now === 'dot' || now === 'open') {
      setNote(next)
    } else {
      waiting.current = next
    }
  }
  const arriveRef = useRef(arrive)
  arriveRef.current = arrive

  const dismiss = () => {
    const now = phaseRef.current
    // Из круга текст гасить не нужно — его ещё не было, и ожидание его угасания
    // не кончилось бы никогда.
    if (now === 'dot') setPhase('close')
    else if (now === 'open') setPhase(reduce ? 'leave' : 'fade')
  }

  // Опрос. `seen` — когда в каждой ветке было последнее сообщение, которое мы
  // уже видели; `null` до первого ответа, чтобы старое не всплыло уведомлением.
  useEffect(() => {
    let alive = true
    let seen = null
    // Ветка, которой не было в первом чтении (новый клиент, вернули из архива),
    // считается новой только если её сообщение моложе открытия страницы —
    // минута запаса на расхождение часов сервера и браузера.
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
            const was = before.get(row.id)
            const fresh = at > (was ?? since)
            if (
              fresh &&
              row.channel === 'telegram' &&
              row.last_message_author === 'client' &&
              (!newest || at > newest.at)
            ) {
              newest = { row, at }
            }
          }

          if (newest) {
            const { row, at } = newest
            arriveRef.current({
              key: `${row.id}-${at}`,
              id: row.id,
              name: clientName(row, t('chat.noName')),
              time: new Date(at).toLocaleTimeString(getLocale(), {
                hour: '2-digit',
                minute: '2-digit',
              }),
              text: row.last_message_preview ?? '',
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
    // отсчёта, а имя «Без имени» возьмётся на следующем уведомлении.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Шесть секунд — заново на каждое новое сообщение, и стоят, пока остров
  // держат курсором или фокусом.
  useEffect(() => {
    if (phase !== 'open' || held) return
    const timer = setTimeout(dismiss, SHOW_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, held, note?.key])

  // То, что пришло, пока остров уходил, показывается следом.
  useEffect(() => {
    if (note || !waiting.current) return
    const next = waiting.current
    waiting.current = null
    arriveRef.current(next)
  }, [note])

  const island = reduce
    ? {
        hidden: { opacity: 0, width },
        open: { opacity: 1, width, transition: { duration: 0.2 } },
        leave: { opacity: 0, width, transition: { duration: 0.2 } },
      }
    : {
        hidden: { y: RISE, opacity: 0, width: DOT },
        dot: { y: 0, opacity: 1, width: DOT, transition: { ...spring(0.3, 0.45), restDelta: 0.5 } },
        open: { y: 0, opacity: 1, width, transition: spring(0.2, 0.5) },
        fade: { y: 0, opacity: 1, width },
        // `restDelta` — чтобы круг не ждал последних долей пикселя, прежде чем
        // уехать вверх: хвост пружины невидим, а пауза перед подъёмом — нет.
        close: { y: 0, opacity: 1, width: DOT, transition: { ...spring(0, 0.35), restDelta: 0.5 } },
        leave: {
          y: RISE,
          opacity: 0,
          width: DOT,
          transition: { ...spring(0, 0.35), opacity: { duration: 0.25, delay: 0.1 } },
        },
      }

  const settled = (definition) => {
    if (definition === 'dot') setPhase('open')
    else if (definition === 'close') setPhase('leave')
    else if (definition === 'leave') {
      setHeld(false)
      setNote(null)
      setPhase('hidden')
    }
  }

  const content = {
    gone: { opacity: 0, filter: 'blur(4px)', transition: { duration: 0.12 } },
    shown: {
      opacity: 1,
      filter: 'blur(0px)',
      transition: { duration: 0.25, delay: reduce ? 0 : 0.12, ease: [0.23, 1, 0.32, 1] },
    },
  }

  const open = () => {
    if (!note) return
    navigate(`/inbox?chat=${note.id}`)
    dismiss()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-[10px] z-10 flex justify-center"
    >
      {note && (
        <LazyMotion features={domAnimation} strict>
          <m.div
            initial="hidden"
            animate={phase}
            variants={island}
            onAnimationComplete={settled}
            whileTap={{ scale: 0.98 }}
            onPointerEnter={() => setHeld(true)}
            onPointerLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
            className="pointer-events-auto h-12 overflow-hidden rounded-full bg-surface-card p-1.5 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] ring-1 ring-line"
          >
            <div
              className="flex h-full items-center gap-2"
              style={{ width: width - 12 }}
            >
              <button
                type="button"
                onClick={open}
                aria-label={t('island.open', { name: note.name })}
                className="flex h-full min-w-0 flex-1 items-center gap-3 text-left outline-none"
              >
                {/* Цвет Telegram — единственный цвет на острове, и он говорит,
                    откуда пришло, а не украшает. */}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#2AABEE] text-white">
                  <HugeiconsIcon icon={TelegramIcon} size={20} strokeWidth={1.8} />
                </span>

                <m.span
                  key={note.key}
                  initial="gone"
                  animate={phase === 'open' ? 'shown' : 'gone'}
                  variants={content}
                  onAnimationComplete={(definition) => {
                    if (definition === 'gone' && phaseRef.current === 'fade') {
                      setPhase('close')
                    }
                  }}
                  className="flex min-w-0 flex-1 flex-col"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] leading-4 font-medium text-ink">
                      {note.name}
                    </span>
                    <span className="shrink-0 text-[12px] leading-4 text-muted">
                      {note.time}
                    </span>
                  </span>
                  <span className="mt-0.5 truncate text-[13px] leading-4 text-muted">
                    {note.text}
                  </span>
                </m.span>
              </button>

              <m.button
                type="button"
                onClick={dismiss}
                aria-label={t('island.close')}
                initial="gone"
                animate={phase === 'open' ? 'shown' : 'gone'}
                variants={content}
                className="touch-target relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink/12 text-ink transition-colors duration-150 hover:bg-ink/20"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2.2} />
              </m.button>
            </div>
          </m.div>
        </LazyMotion>
      )}
    </div>
  )
}
