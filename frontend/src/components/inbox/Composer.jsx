import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUp02Icon } from '@hugeicons/core-free-icons'
import { ASSISTANT_ICON } from '../navigation'
import { CROSSFADE, SPRING } from '../../lib/motion'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/i18n'

/**
 * Низ треда: кто сейчас отвечает клиенту — ассистент или вы.
 *
 * **Слева всегда значок ассистента, и это выключатель.** Включён — залитый
 * круг и строка о том, что отвечает он; полю ввода тут делать нечего, потому
 * что написанное рукой всё равно выключило бы его (`add_message`). Выключен —
 * круг гаснет, а из-под него выезжает поле: ответ рукой становится тем, что
 * владелец *сделал*, а не тем, что случилось, потому что курсор стоял в поле.
 * Нажать значок ещё раз — и модель снова отвечает сама.
 *
 * Поле растёт по тексту до пяти строк; Enter отправляет, Shift+Enter —
 * перенос. Текст уходит только после ответа сервера: неудача оставляет его в
 * поле, а не теряет.
 */
export default function Composer({ aiOn, onToggle, onSend }) {
  const t = useT()
  const reduce = useReducedMotion()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const field = useRef(null)
  // Фокус — только когда поле появилось по нажатию, а не при открытии треда,
  // где ассистент уже был выключен: иначе на телефоне каждое открытие
  // разговора поднимало бы клавиатуру.
  const focusNext = useRef(false)

  useEffect(() => {
    const box = field.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, MAX_FIELD)}px`
  }, [text, aiOn])

  const toggle = () => {
    haptic('snap')
    focusNext.current = aiOn
    onToggle(!aiOn)
  }

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      await onSend(body)
      setText('')
      haptic('commit')
    } catch {
      // Текст остаётся в поле — повторить можно тем же нажатием.
    } finally {
      setSending(false)
      field.current?.focus()
    }
  }

  const ready = text.trim().length > 0 && !sending

  return (
    <div className="flex shrink-0 items-end gap-2 border-t border-line px-3 py-3">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={aiOn}
        aria-label={t(aiOn ? 'thread.ai.turnOff' : 'thread.ai.turnOn')}
        title={t(aiOn ? 'thread.ai.turnOff' : 'thread.ai.turnOn')}
        className={`touch-target relative grid h-10 w-10 shrink-0 place-items-center rounded-full outline-none transition-[background-color,color,scale] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ink/30 active:scale-[0.95] ${
          aiOn ? 'bg-accent text-surface' : 'bg-ink/12 text-ink hover:bg-ink/16'
        }`}
      >
        <HugeiconsIcon icon={ASSISTANT_ICON} size={20} strokeWidth={1.8} />
      </button>

      <div className="relative flex min-h-10 min-w-0 flex-1 items-end">
        <AnimatePresence mode="popLayout" initial={false}>
          {aiOn ? (
            <m.p
              key="ai"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: CROSSFADE.out }}
              transition={CROSSFADE.in}
              className="flex min-h-10 min-w-0 flex-1 items-center text-[13px] text-muted"
            >
              <span className="truncate font-medium text-ink">{t('thread.ai.on')}</span>
            </m.p>
          ) : (
            // Поле выезжает из-под значка: сдвиг и масштаб от левого края,
            // на пружине, — видно, откуда оно пришло и куда уйдёт обратно.
            <m.form
              key="field"
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: -24, scaleX: 0.9 }}
              animate={{ opacity: 1, x: 0, scaleX: 1 }}
              exit={
                reduce
                  ? { opacity: 0, transition: CROSSFADE.out }
                  : { opacity: 0, x: -24, scaleX: 0.9, transition: { ...SPRING, opacity: CROSSFADE.out } }
              }
              transition={reduce ? CROSSFADE.in : { ...SPRING, opacity: CROSSFADE.in }}
              onAnimationComplete={() => {
                if (focusNext.current) field.current?.focus()
                focusNext.current = false
              }}
              style={{ originX: 0 }}
              onSubmit={(event) => {
                event.preventDefault()
                send()
              }}
              className="flex min-w-0 flex-1 items-end gap-2 rounded-[20px] bg-surface-raised py-1 pr-1 pl-4 shadow-[0_0_0_1px_var(--color-field)] transition-shadow duration-150 focus-within:shadow-[0_0_0_1px_var(--color-field-focus)]"
            >
              <textarea
                ref={field}
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
                className="max-h-[120px] min-w-0 flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-5 text-ink outline-none placeholder:text-muted sm:text-[14px]"
              />
              <button
                type="submit"
                disabled={!ready}
                aria-label={t('thread.send')}
                className="touch-target relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-surface outline-none transition-[opacity,scale] duration-[160ms] ease-out focus-visible:ring-2 focus-visible:ring-ink/30 active:scale-[0.92] disabled:opacity-30"
              >
                <HugeiconsIcon icon={ArrowUp02Icon} size={16} strokeWidth={2.2} />
              </button>
            </m.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** Пять строк по 20px плюс поля — дальше поле прокручивается внутри себя. */
const MAX_FIELD = 120
