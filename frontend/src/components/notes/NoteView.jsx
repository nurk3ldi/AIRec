import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon, NoteAddIcon } from '@hugeicons/core-free-icons'
import { useT } from '../../lib/i18n'

/** Через сколько тишины сохранять написанное. */
const SAVE_AFTER_MS = 600

/**
 * Третья полоса: сама заметка.
 *
 * **Кнопка «новая заметка» стоит здесь, а не над списком.** Полоса шире всех, и
 * именно в ней заметка открывается, когда её заводят: действие стоит там, где
 * виден его результат. Верхний правый угол — то место, где эту кнопку держат
 * Заметки и Почта, и рука ищет её там. Значок без слова: подпись рядом с плюсом
 * сказала бы то же самое дважды, а для чтения с экрана она есть в `aria-label`.
 *
 * **Одно поле на всю заметку, без отдельного заголовка.** Заголовок — первая
 * строка текста, и второе поле над ним было бы вторым местом, где хранится то
 * же самое; список читает ту же первую строку.
 *
 * **Сохраняется по тишине, а не по кнопке.** Заметка — это то, что пишут, а не
 * то, что заполняют: «Сохранить» здесь означало бы, что написанное можно
 * потерять, не нажав. `SAVE_AFTER_MS` — пауза, после которой строка уходит на
 * сервер; таймер сбрасывается на каждом нажатии, так что запрос уходит один на
 * абзац, а не один на букву.
 *
 * **Слева — корзина, справа — новая заметка.** Два конца панели: то, что
 * убирает открытое, и то, что заводит следующее. Рядом друг с другом они
 * стояли бы как пара, и рука промахивалась бы между «выбросить» и «начать».
 *
 * **Корзина сначала откладывает, а не удаляет.** Первое нажатие переносит
 * заметку в «Корзину», откуда её можно достать; насовсем удаляет то же место и
 * только у заметки, которая уже там, и только со второго нажатия. Диалог ради
 * двух слов был бы слоем поверх слоя, а одна красная кнопка рядом с текстом —
 * один промах от чужого дня.
 *
 * **Черновик живёт здесь, а не на странице.** Пока в поле печатают, состояние
 * меняется на каждом символе, и держать его выше значило бы перерисовывать при
 * этом обе соседние полосы.
 */
export default function NoteView({
  note,
  onCreate,
  onChange,
  onRemove,
  className = '',
}) {
  const t = useT()
  const [draft, setDraft] = useState(note?.body ?? '')
  // Подтверждение окончательного удаления. Сбрасывается вместе с заметкой:
  // «удалить ещё раз» относилось к той, что была открыта, а не к следующей.
  const [confirming, setConfirming] = useState(false)
  const timer = useRef(null)

  // Открыли другую заметку — в поле её текст. Ключ — id, а не тело, и это
  // намеренно: сохранение возвращает `note.body` с сервера, и будь он в
  // зависимостях, ответ на предыдущий абзац затирал бы то, что печатают
  // сейчас.
  useEffect(() => {
    setDraft(note?.body ?? '')
    setConfirming(false)
    // `note.body` намеренно не в зависимостях — oxlint это отмечает, и
    // предупреждение здесь ожидаемое.
  }, [note?.id])

  // Незаконченный таймер при уходе с заметки: сохранить, а не потерять.
  useEffect(() => () => clearTimeout(timer.current), [])

  const write = (value) => {
    setDraft(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(note.id, value), SAVE_AFTER_MS)
  }

  return (
    <section className={`flex flex-col ${className}`}>
      {/* Панель без линии под собой: полосы на этом экране разделены только
          вертикалями, и горизонталь здесь была бы вторым видом границы. */}
      <div className="flex shrink-0 items-center justify-between p-3">
        {/* Место занято всегда, даже когда удалять нечего: иначе кнопка справа
            переезжала бы туда-сюда при каждом открытии заметки. */}
        {note ? (
          <button
            type="button"
            onClick={() => {
              if (note.trashed && !confirming) {
                setConfirming(true)
                return
              }
              onRemove(note)
            }}
            className={`flex h-9 items-center gap-2 rounded-lg px-2.5 text-[14px] font-medium text-danger outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-danger/10 focus-visible:bg-danger/10 active:scale-[0.97] ${
              confirming ? 'bg-danger/10' : ''
            }`}
          >
            <HugeiconsIcon
              icon={Delete02Icon}
              size={18}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.9}
            />
            {/* Слово появляется только когда нажатие уже необратимо: обычной
                кнопке значка довольно, этой — нет. */}
            {confirming && <span>{t('notes.deleteConfirm')}</span>}
          </button>
        ) : (
          <span className="h-9" />
        )}

        <button
          type="button"
          onClick={onCreate}
          aria-label={t('notes.newNote')}
          className="grid h-9 w-9 place-items-center rounded-lg text-ink outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-ink/6 focus-visible:bg-ink/6 active:scale-[0.95]"
        >
          <HugeiconsIcon
            icon={NoteAddIcon}
            size={19}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.9}
          />
        </button>
      </div>

      {note ? (
        <textarea
          value={draft}
          onChange={(event) => write(event.target.value)}
          placeholder={t('notes.placeholder')}
          aria-label={t('nav.notes')}
          // Без рамки и без заливки: поле занимает всю полосу, а полоса — это
          // лист. Кольцо вокруг листа обвело бы то, у чего края уже есть.
          className="min-h-0 w-full flex-1 resize-none appearance-none bg-transparent px-6 pb-6 text-[16px] leading-relaxed text-ink outline-none placeholder:text-muted sm:text-[15px]"
        />
      ) : (
        // Ничего не выбрано — и сказать об этом нечем, кроме самого пустого
        // листа. Надпись «выберите заметку» здесь была бы указанием на то, что
        // и так видно.
        <div className="min-h-0 flex-1" />
      )}
    </section>
  )
}
