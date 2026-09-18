import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUp02Icon, Cancel01Icon, PlusSignIcon } from '@hugeicons/core-free-icons'
import { ASSISTANT_ICON } from '../navigation'
import { CROSSFADE, SPRING } from '../../lib/motion'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/i18n'

/**
 * Низ треда — кто ведёт разговор, и как его перехватить. Два состояния, и
 * каждое — одно ясное действие, а не выключатель посреди поля ввода.
 *
 * **Ассистент ведёт.** Поля нет вовсе: писать рукой сейчас значило бы выключить
 * модель случайно (`add_message`). Вместо него — строка «Ассистент ведёт
 * разговор» и одна кнопка «Ответить самому». Что модель делает прямо сейчас,
 * сказано не здесь, а в самой переписке: печатающий пузырь или подпись «Ждёт
 * ответа клиента» под последним сообщением — см. `Thread`.
 *
 * **Отвечаете вы.** Поле iMessage: «+» снаружи слева, поле без обводки, стрелка
 * отправки внутри справа и только когда есть что отправить; выбранный снимок —
 * внутри поля над текстом. Над полем — тихая строка «Вы отвечаете сами ·
 * Вернуть ассистенту»: обратный путь виден всегда, но не спорит с полем.
 *
 * Смена состояний — одна и та же пружина в обе стороны (спокойная, без отскока:
 * ничего не бросали), поле получает фокус, как только появилось, и только если его
 * открыли нажатием, — иначе на телефоне каждое открытие треда поднимало бы
 * клавиатуру.
 */
export default function Composer({ aiOn, onToggle, onSend }) {
  const t = useT()
  const reduce = useReducedMotion()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [photo, setPhoto] = useState(null)
  const picker = useRef(null)
  const field = useRef(null)
  const focusNext = useRef(false)

  useEffect(() => {
    const box = field.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, MAX_FIELD)}px`
  }, [text, aiOn])

  // Превью живёт, пока выбран снимок; старый адрес освобождается.
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo])
  // Вернули ассистенту — выбранный снимок уже никуда не уйдёт.
  useEffect(() => {
    if (aiOn) setPhoto(null)
  }, [aiOn])

  const canSend = text.trim().length > 0 || photo !== null

  const takeOver = () => {
    haptic('snap')
    focusNext.current = true
    onToggle(false)
  }

  const handBack = () => {
    haptic('snap')
    onToggle(true)
  }

  const pick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhoto({ file, url: URL.createObjectURL(file) })
    field.current?.focus()
  }

  const send = async () => {
    const body = text.trim()
    if ((!body && !photo) || sending) return
    setSending(true)
    try {
      await onSend(body, photo?.file)
      setText('')
      setPhoto(null)
      haptic('commit')
    } catch {
      // Текст остаётся в поле — повторить можно тем же нажатием.
    } finally {
      setSending(false)
      field.current?.focus()
    }
  }

  // Одна пружина на вход и выход: состояние уезжает тем же путём, каким
  // приехало, — чуть вниз и в прозрачность.
  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: reduce
      ? { opacity: 0, transition: CROSSFADE.out }
      : { opacity: 0, y: 10, transition: { y: SPRING, opacity: CROSSFADE.out } },
    transition: reduce ? CROSSFADE.in : { y: SPRING, opacity: CROSSFADE.in },
  }

  return (
    <div className="shrink-0 border-t border-line px-3 pt-2.5 pb-3">
      <AnimatePresence mode="wait" initial={false}>
        {aiOn ? (
          <m.div key="assistant" {...swap} className="flex min-h-11 items-center gap-3 pl-1">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink/12 text-ink"
            >
              <HugeiconsIcon icon={ASSISTANT_ICON} size={17} strokeWidth={1.8} />
            </span>
            <p className="min-w-0 flex-1 truncate text-[14px] text-ink">
              {t('thread.ai.leading')}
            </p>
            <button
              type="button"
              onClick={takeOver}
              className="h-9 shrink-0 rounded-full bg-accent px-4 text-[14px] font-medium text-surface outline-none transition-[scale,opacity] duration-[160ms] ease-out hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ink/30 active:scale-[0.96]"
            >
              {t('thread.ai.takeOver')}
            </button>
          </m.div>
        ) : (
          <m.div key="owner" {...swap}>
            {/* Обратный путь — тихой строкой над полем: виден всегда и не
                спорит с тем, ради чего это состояние открыли. */}
            <p className="mb-2 flex items-center gap-1.5 pl-1 text-[12px] text-muted">
              <HugeiconsIcon icon={ASSISTANT_ICON} size={14} strokeWidth={1.8} />
              <span>{t('thread.ai.youReply')}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={handBack}
                className="touch-target relative font-medium text-ink outline-none transition-opacity duration-150 hover:opacity-70 focus-visible:underline active:opacity-50"
              >
                {t('thread.ai.handBack')}
              </button>
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                send()
              }}
              className="flex items-end gap-2"
            >
              <input
                ref={picker}
                type="file"
                accept="image/*"
                onChange={pick}
                className="hidden"
                tabIndex={-1}
              />

              {/* «+» снаружи поля, слева, — как в iMessage: сначала «что
                  прикрепить», потом «что сказать». */}
              <button
                type="button"
                onClick={() => picker.current?.click()}
                aria-label={t('thread.photo.add')}
                title={t('thread.photo.add')}
                className="touch-target relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink outline-none transition-[opacity,scale] duration-[160ms] ease-out hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ink/30 active:scale-90"
              >
                <HugeiconsIcon icon={PlusSignIcon} size={20} strokeWidth={2} />
              </button>

              {/* Поле — заливка без обводки: в тёмной теме рамка вокруг поля
                  рядом с линией над ним читалась двумя чертами. */}
              <div className="flex min-w-0 flex-1 flex-col rounded-[20px] bg-ink/8 transition-colors duration-150 focus-within:bg-ink/10">
                <AnimatePresence initial={false}>
                  {photo && (
                    <m.div
                      key={photo.url}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, transition: CROSSFADE.out }}
                      transition={reduce ? CROSSFADE.in : { scale: SPRING, opacity: CROSSFADE.in }}
                      style={{ originX: 0, originY: 1 }}
                      className="relative mt-2 ml-2 w-fit"
                    >
                      <img
                        src={photo.url}
                        alt=""
                        className="h-24 max-w-[180px] rounded-2xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setPhoto(null)}
                        aria-label={t('thread.photo.remove')}
                        className="touch-target absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white outline-none backdrop-blur-sm transition-[scale] duration-[160ms] ease-out active:scale-90"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2.4} />
                      </button>
                    </m.div>
                  )}
                </AnimatePresence>

                <div className="flex items-end gap-1 py-[3px] pr-[3px] pl-4">
                  <textarea
                    // Фокус в момент появления поля — если его открыли нажатием
                    // «Ответить самому». Колбэк-реф, а не эффект: при
                    // `mode="wait"` поле монтируется позже смены состояния, и
                    // эффект на `aiOn` застал бы пустой ref.
                    ref={(node) => {
                      field.current = node
                      if (node && focusNext.current) {
                        focusNext.current = false
                        node.focus({ preventScroll: true })
                      }
                    }}
                    rows={1}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault()
                        send()
                      }
                    }}
                    placeholder={t('thread.placeholder')}
                    aria-label={t('thread.placeholder')}
                    className="max-h-[120px] min-w-0 flex-1 resize-none bg-transparent py-[7px] text-[16px] leading-5 text-ink outline-none placeholder:text-muted sm:text-[14px]"
                  />

                  {/* Стрелка — внутри поля и только когда есть что отправить:
                      пустое поле не предлагает действия, которого нет. */}
                  <AnimatePresence initial={false}>
                    {canSend && (
                      <m.button
                        key="send"
                        type="submit"
                        disabled={sending}
                        aria-label={t('thread.send')}
                        title={t('thread.send')}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                        transition={reduce ? CROSSFADE.in : { scale: SPRING, opacity: { duration: 0.12 } }}
                        whileTap={{ scale: 0.9 }}
                        className="touch-target relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-surface outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:opacity-50"
                      >
                        <HugeiconsIcon icon={ArrowUp02Icon} size={15} strokeWidth={2.4} />
                      </m.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </form>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Пять строк по 20px плюс поля — дальше поле прокручивается внутри себя. */
const MAX_FIELD = 120
