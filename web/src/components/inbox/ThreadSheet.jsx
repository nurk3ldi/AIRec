import { useEffect, useLayoutEffect, useRef } from 'react'
import {
  animate,
  m,
  useMotionValue,
  usePresence,
  useReducedMotion,
  useTransform,
} from 'motion/react'
import { haptic } from '../../lib/haptics'
import {
  project,
  rubberband,
  SPRING,
  velocityFrom,
  VELOCITY_WINDOW,
} from '../../lib/motion'
import { SHEET_TIMING } from '../appointments/panel'
import Thread from './Thread'

/**
 * Первые пиксели движения решают, свайп это или прокрутка.
 *
 * Та же величина, что у `MobileDay`: одно решение на весь нажим, а не
 * пересматриваемое на каждом кадре, иначе диагональный жест мигает между
 * «листаю переписку» и «ухожу назад».
 */
const AXIS_PX = 8

/**
 * Где проходит точка невозврата — половина ширины экрана.
 *
 * Спрашивается не у того, где остановился палец, а у того, **куда шёл жест**
 * (`позиция + project(скорость)`): короткий быстрый смахивающий жест — самый
 * ясный способ сказать «назад», и порог по одному расстоянию его бы отверг.
 * Половина — это ответ iOS на тот же вопрос в `UINavigationController`.
 */
const COMMIT_SHARE = 0.5

/**
 * Пружина, которая доводит отпущенный жест.
 *
 * **Пружина, а не кривая с длительностью, и только здесь.** Появление и уход
 * по кнопке едут на кривой листа (`SHEET_TIMING`), как все листы продукта: их
 * никто не держит, и у них нет скорости, которую надо продолжить. У
 * отпущенного пальца она есть — и продолжить её без шва умеет только пружина,
 * потому что она стартует с текущей скорости, а кривая начинает с нуля.
 * Критическое затухание (`bounce: 0`) и отклик 0.4 с — значения Apple для
 * перемещения: без перелёта, потому что край экрана — не упругая стенка.
 */
const RELEASE = SPRING

/**
 * Насколько гаснет список под тредом, пока его тянут назад.
 *
 * Меньше половины `--scrim`: это не модальная пелена, а подсказка глубины —
 * тред лежит *над* списком, и чем дальше его сдвинули, тем светлее то, к чему
 * возвращаются.
 */
const DIM = 0.4

/**
 * Проявление вместо переезда — под пониженным движением.
 *
 * Коротко и одинаково в обе стороны: прозрачность не несёт направления, и
 * медленный уход здесь был бы ожиданием, а не смыслом.
 */
const FADE = { duration: 0.2, ease: 'easeOut' }

/**
 * Тред на узком экране — слой, приезжающий справа, и уходящий так же.
 *
 * **Его можно утащить назад пальцем.** Это главный жест навигации на телефоне:
 * экран, открытый вглубь, закрывается движением туда, откуда он приехал, и
 * кнопка «назад» в шапке — второй путь к тому же, а не единственный.
 *
 * Правила, по которым сделан жест, — «Motion under the hand» в `CLAUDE.md`:
 *
 * - **1:1 под пальцем, от места захвата.** Отсчёт идёт от точки, где ось
 *   определилась, поэтому слой не прыгает на восемь пикселей в момент решения.
 * - **Можно схватить на лету.** Нажим посреди появления или ухода
 *   останавливает анимацию (`x.stop()`) и продолжает *с того места, где слой
 *   сейчас на экране*, а не с того, куда он ехал.
 * - **Решение — по направлению броска**, скорость — из последних 100 мс
 *   (`velocityFrom`), и она же уходит в пружину, так что шва между пальцем и
 *   анимацией нет.
 * - **Влево дальше края — упругое сопротивление** (`rubberband`), а не
 *   стенка.
 * - **Ничего из этого не идёт через состояние React**: всё пишется в
 *   `MotionValue`, и перерисовка на каждый `pointermove` не случается.
 * - **Вибро — один раз, на пересечении порога**, и только на пересечении
 *   внутрь: это момент, когда отпускание изменит исход.
 *
 * Мышью не тащится: на десктопе этот слой не показывается вовсе (`lg:hidden`),
 * а в узком окне браузера протягивание мышью — это выделение текста, и
 * отнимать его ради жеста, которого там никто не ждёт, нечестно.
 *
 * **Под пониженным движением слой не ездит, а проявляется**: переезд через
 * весь экран — ровно то, от чего эта настройка защищает, а смена прозрачности
 * — нет. Жест при этом остаётся: движение, которое ведёт сам человек, не
 * вестибулярное — оно происходит под его пальцем и по его воле.
 */
export default function ThreadSheet({ conversation, onBack }) {
  const reduce = useReducedMotion()
  const [isPresent, safeToRemove] = usePresence()
  const root = useRef(null)

  // **Ширина экрана до первого замера**, а не ноль: слой начинает за правым
  // краем уже в первом кадре. С нулём он на кадр встал бы поверх списка во весь
  // рост и только потом отпрыгнул бы вправо, чтобы въехать.
  const width = useRef(typeof window === 'undefined' ? 0 : window.innerWidth)
  const x = useMotionValue(reduce ? 0 : width.current)
  const opacity = useMotionValue(reduce ? 0 : 1)

  // Сколько слоя «на месте», от 0 до 1 — из сдвига и из прозрачности сразу,
  // чтобы пелена под ним вела себя одинаково при переезде и при проявлении.
  const dim = useTransform([x, opacity], ([offset, shown]) => {
    const share = width.current ? Math.min(Math.max(offset / width.current, 0), 1) : 0
    return (1 - share) * shown * DIM
  })

  const drag = useRef(null)
  const trail = useRef([])
  const crossed = useRef(false)
  // Анимация, запущенная отпусканием. Уход по `usePresence` дожидается её, а не
  // запускает свою: вторая стартовала бы с нуля и съела бы скорость пальца.
  const released = useRef(null)

  useLayoutEffect(() => {
    width.current = root.current?.offsetWidth || width.current
    if (reduce) {
      animate(opacity, 1, FADE)
    } else {
      x.set(width.current)
      animate(x, 0, SHEET_TIMING.in)
    }
    // Один раз, на появление: всё дальнейшее ведут жест и уход.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isPresent) return

    const leaving =
      released.current ??
      (reduce
        ? animate(opacity, 0, FADE)
        : animate(x, width.current, SHEET_TIMING.out))
    leaving.then(safeToRemove)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])

  const start = (event) => {
    if (event.pointerType === 'mouse' || !isPresent) return
    drag.current = { x: event.clientX, y: event.clientY, axis: null, from: 0 }
  }

  const move = (event) => {
    const from = drag.current
    if (!from || from.axis === 'y') return

    if (from.axis === null) {
      const dx = event.clientX - from.x
      const dy = event.clientY - from.y
      if (Math.abs(dx) + Math.abs(dy) <= AXIS_PX) return

      // Назад — это только вправо. Влево из треда уходить некуда, и такой жест
      // отдаётся прокрутке целиком, а не удерживается ради сопротивления.
      from.axis = Math.abs(dx) > Math.abs(dy) && dx > 0 ? 'x' : 'y'
      if (from.axis !== 'x') return

      // Захват — только когда ось уже известна: взятый на `pointerdown`, он
      // отнял бы у браузера вертикальную прокрутку переписки.
      event.currentTarget.setPointerCapture?.(event.pointerId)
      x.stop()
      released.current = null
      width.current = root.current?.offsetWidth || width.current
      from.x = event.clientX
      from.from = x.get()
      trail.current = [{ at: performance.now(), value: from.from }]
      crossed.current = from.from > width.current * COMMIT_SHARE
    }

    const raw = from.from + (event.clientX - from.x)
    const next = raw < 0 ? rubberband(raw, width.current) : raw
    x.set(next)

    const at = performance.now()
    trail.current.push({ at, value: next })
    while (trail.current.length > 2 && at - trail.current[1].at > VELOCITY_WINDOW) {
      trail.current.shift()
    }

    const past = next > width.current * COMMIT_SHARE
    if (past && !crossed.current) haptic('snap')
    crossed.current = past
  }

  const end = (event) => {
    const from = drag.current
    drag.current = null
    if (!from || from.axis !== 'x') return

    const velocity = velocityFrom(trail.current)
    trail.current = []
    const projected = x.get() + project(velocity)

    if (event.type !== 'pointercancel' && projected > width.current * COMMIT_SHARE) {
      released.current = animate(x, width.current, { ...RELEASE, velocity })
      onBack()
      return
    }

    // Не дотянули — слой возвращается, унося с собой ту же скорость, с какой
    // его отпустили: брошенный назад, он и доезжает быстрее.
    animate(x, 0, { ...RELEASE, velocity })
  }

  return (
    <>
      {/* Пелена под слоем: список гаснет, пока тред над ним, и светлеет по мере
          того, как тред утаскивают. Нажатия сквозь неё не ловятся — это
          глубина, а не стена. */}
      <m.div
        aria-hidden="true"
        style={{ opacity: dim }}
        className="pointer-events-none absolute inset-0 z-20 bg-scrim lg:hidden"
      />

      <m.div
        ref={root}
        style={{ x, opacity }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        // `touch-pan-y`: без него горизонтальный жест забирает браузер, и
        // события указателя приходят уже отменёнными. Вертикаль остаётся
        // прокрутке переписки.
        //
        // Тень у левого края видна, только пока слой сдвинут: это край листа,
        // лежащего над списком, а в покое он совпадает с краем экрана.
        className="absolute inset-0 z-30 flex touch-pan-y flex-col bg-ground shadow-[-12px_0_32px_-12px_rgb(0_0_0/0.45)] lg:hidden"
      >
        <Thread
          conversation={conversation}
          onBack={onBack}
          className="min-h-0 flex-1"
        />
      </m.div>
    </>
  )
}
