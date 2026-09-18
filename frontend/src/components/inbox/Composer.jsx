import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUp02Icon, Cancel01Icon, PlusSignIcon } from '@hugeicons/core-free-icons'
import { ASSISTANT_ICON } from '../navigation'
import { CROSSFADE, SPRING } from '../../lib/motion'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/i18n'
import Switch from '../Switch'

/**
 * Низ треда: одно длинное поле и одна круглая кнопка в нём.
 *
 * **Слева — выключатель ассистента.** Пока модель включена, на месте текста — что она делает: «Отвечает…» с
 * бегущими точками, если последним писал клиент, и «Ждёт ответа клиента»,
 * если ответ уже ушёл. Писать в этот момент нельзя: сообщение рукой всё равно
 * выключило бы её (`add_message`), и это должно быть действием, а не
 * случайностью. Сдвинуть выключатель — модель выключается, поле становится
 * полем; набранный текст добавляет рядом стрелку отправки. Сдвинуть обратно —
 * модель снова отвечает сама.
 *
 * Enter отправляет, Shift+Enter — перенос. Текст уходит только после ответа
 * сервера: неудача оставляет его в поле.
 */
export default function Composer({ aiOn, replying, onToggle, onSend }) {
  const t = useT()
  const reduce = useReducedMotion()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  // Выбранный снимок: сам файл и адрес превью. Уходит вместе с текстом —
  // текст становится подписью.
  const [photo, setPhoto] = useState(null)
  const picker = useRef(null)
  const field = useRef(null)
  // Фокус — только когда поле открыли нажатием, не при открытии треда: иначе
  // на телефоне каждое открытие разговора поднимало бы клавиатуру.
  const focusNext = useRef(false)

  useEffect(() => {
    const box = field.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, MAX_FIELD)}px`
  }, [text, aiOn])

  useEffect(() => {
    if (!aiOn && focusNext.current) field.current?.focus()
    focusNext.current = false
  }, [aiOn])

  // Превью живёт, пока выбран снимок; старый адрес освобождается.
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo])
  // Включили модель — выбранный снимок уже никуда не уйдёт.
  useEffect(() => {
    if (aiOn) setPhoto(null)
  }, [aiOn])

  const willSend = !aiOn && (text.trim().length > 0 || photo !== null)

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

  const toggle = () => {
    haptic('snap')
    focusNext.current = aiOn
    onToggle(!aiOn)
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
      className="shrink-0 border-t border-line px-3 py-3"
    >
      <input
        ref={picker}
        type="file"
        accept="image/*"
        onChange={pick}
        className="hidden"
        tabIndex={-1}
      />

      {/* Выбранный снимок — над полем, как в мессенджерах, с крестиком,
          чтобы передумать. */}
      <AnimatePresence initial={false}>
        {photo && !aiOn && (
          <m.div
            key={photo.url}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: CROSSFADE.out }}
            transition={reduce ? CROSSFADE.in : { ...SPRING, opacity: CROSSFADE.in }}
            className="relative mb-2 ml-1 w-fit"
          >
            <img
              src={photo.url}
              alt=""
              className="h-20 max-w-[160px] rounded-xl object-cover ring-1 ring-line"
            />
            <button
              type="button"
              onClick={() => setPhoto(null)}
              aria-label={t('thread.photo.remove')}
              className="touch-target absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-surface outline-none transition-[scale] duration-[160ms] ease-out active:scale-90"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2.4} />
            </button>
          </m.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 rounded-[22px] bg-surface-raised py-1 pr-1 pl-2 shadow-[0_0_0_1px_var(--color-field)] transition-shadow duration-150 focus-within:shadow-[0_0_0_1px_var(--color-field-focus)]">
        {/* Выключатель ассистента — одна капсула: значок и ползунок на общей
            подложке, чтобы читались как один элемент «ассистент: вкл/выкл».
            Значок тоже нажимается и делает то же, что ползунок. */}
        <span className="-ml-1 flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink/10 pr-[5px] pl-2">
          <span
            aria-hidden="true"
            onClick={toggle}
            className={`grid cursor-pointer place-items-center transition-colors duration-200 ${
              aiOn ? 'text-ink' : 'text-muted'
            }`}
          >
            <HugeiconsIcon icon={ASSISTANT_ICON} size={22} strokeWidth={1.8} />
          </span>
          <Switch
            checked={aiOn}
            onChange={toggle}
            label={t(aiOn ? 'thread.ai.turnOff' : 'thread.ai.turnOn')}
          />
        </span>

        {/* Плюс — прикрепить фото. Только когда пишете вы: при включённой
            модели полю ввода делать нечего, и снимку тоже. */}
        <AnimatePresence initial={false}>
          {!aiOn && (
            <m.button
              key="attach"
              type="button"
              onClick={() => picker.current?.click()}
              aria-label={t('thread.photo.add')}
              title={t('thread.photo.add')}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              whileTap={{ scale: 0.9 }}
              className="touch-target relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/10 text-ink outline-none transition-colors duration-150 hover:bg-ink/16 focus-visible:ring-2 focus-visible:ring-ink/30"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={18} strokeWidth={2} />
            </m.button>
          )}
        </AnimatePresence>

        <div className="relative flex min-h-9 min-w-0 flex-1 items-center pl-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {aiOn ? (
              <m.p
                key={replying ? 'replying' : 'waiting'}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: CROSSFADE.out }}
                transition={reduce ? CROSSFADE.in : { y: SPRING, opacity: CROSSFADE.in }}
                aria-live="polite"
                className="ml-auto flex min-w-0 items-baseline py-1.5 pr-2 text-[16px] leading-5 text-ink sm:text-[14px]"
              >
                {replying ? (
                  <>
                    <span className="truncate text-ink">{t('thread.ai.replying')}</span>
                    <Dots still={reduce} />
                  </>
                ) : (
                  <>
                    <span className="truncate">{t('thread.ai.waiting')}</span>
                    {/* Маленький крутящийся круг: ожидание, у которого нет
                        конца, который можно было бы показать полосой. */}
                    <span
                      aria-hidden="true"
                      className="ml-2 inline-block h-3.5 w-3.5 shrink-0 animate-spin self-center rounded-full border-2 border-ink/20 border-t-ink"
                    />
                  </>
                )}
              </m.p>
            ) : (
              <m.textarea
                key="field"
                ref={field}
                rows={1}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: CROSSFADE.out }}
                transition={CROSSFADE.in}
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
                className="max-h-[120px] w-full min-w-0 resize-none bg-transparent py-1.5 text-[16px] leading-5 text-ink outline-none placeholder:text-muted sm:text-[14px]"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Стрелка отправки появляется, только когда есть что отправить, —
            рядом с выключателем, а не вместо него: включить модель обратно
            можно в любую секунду. */}
        <AnimatePresence initial={false}>
          {willSend && (
            <m.button
              key="send"
              type="submit"
              disabled={sending}
              aria-label={t('thread.send')}
              title={t('thread.send')}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              whileTap={{ scale: 0.92 }}
              className="touch-target relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-surface outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
            >
              <HugeiconsIcon icon={ArrowUp02Icon} size={17} strokeWidth={2.2} />
            </m.button>
          )}
        </AnimatePresence>

      </div>
    </form>
  )
}

/**
 * Три точки «печатает». Каждая дышит прозрачностью со сдвигом по фазе — волна
 * слева направо, как в мессенджерах. Под пониженным движением стоят на месте.
 */
function Dots({ still }) {
  return (
    <span aria-hidden="true" className="ml-0.5 inline-flex text-ink">
      {[0, 1, 2].map((index) => (
        <m.span
          key={index}
          animate={still ? undefined : { opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 }}
        >
          .
        </m.span>
      ))}
    </span>
  )
}

/** Пять строк по 20px плюс поля — дальше поле прокручивается внутри себя. */
const MAX_FIELD = 120
