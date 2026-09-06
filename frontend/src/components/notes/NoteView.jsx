import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckListIcon,
  Delete02Icon,
  NoteAddIcon,
  TextBoldIcon,
} from '@hugeicons/core-free-icons'
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
 * **Посередине — жирный и список задач.** Оба правят текст, а не оформление
 * поля: заметка лежит в базе одной колонкой обычного текста, так что жирное —
 * это `**слово**`, а пункт списка — `- [ ] строка`. Разметка остаётся видимой,
 * потому что показывать её иначе нечем: чтобы текст в самом поле стал жирным,
 * нужен редактор с форматированием и другой формат хранения — HTML вместо
 * текста, а с ним и другой поиск, и другой заголовок, и очистка чужого HTML.
 * Это отдельная работа, и делать её вслепую дороже, чем сначала посмотреть на
 * разметку.
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
  const field = useRef(null)

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

  /**
   * Правка вокруг курсора, с возвратом фокуса и выделения.
   *
   * Без этого каждая кнопка выбрасывала бы из текста: нажатие уводит фокус на
   * неё, и печатать после этого приходится, снова прицелившись мышью. Позиция
   * ставится в следующем кадре — до перерисовки её негде выставлять.
   */
  const edit = (change) => {
    const el = field.current
    if (!el) return

    const { value, selectionStart: from, selectionEnd: to } = el
    const next = change(value, from, to)
    write(next.value)

    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(next.from, next.to)
    })
  }

  /** Оборачивает выделенное в `**…**`, а снятое — разворачивает обратно. */
  const bold = () =>
    edit((value, from, to) => {
      const picked = value.slice(from, to)
      const wrapped =
        value.slice(from - 2, from) === '**' && value.slice(to, to + 2) === '**'

      if (wrapped) {
        return {
          value: value.slice(0, from - 2) + picked + value.slice(to + 2),
          from: from - 2,
          to: to - 2,
        }
      }

      return {
        value: `${value.slice(0, from)}**${picked}**${value.slice(to)}`,
        // Без выделения курсор встаёт между звёздочками — туда, где начнут
        // печатать.
        from: from + 2,
        to: to + 2,
      }
    })

  /** Помечает строки под курсором как пункты списка — или снимает пометку. */
  const todo = () =>
    edit((value, from, to) => {
      const head = value.lastIndexOf('\n', from - 1) + 1
      const tailAt = value.indexOf('\n', to)
      const tail = tailAt === -1 ? value.length : tailAt

      const lines = value.slice(head, tail).split('\n')
      const marked = lines.every((line) => /^\s*- \[[ x]\] /.test(line))
      const next = lines
        .map((line) =>
          marked
            ? line.replace(/^(\s*)- \[[ x]\] /, '$1')
            : line.replace(/^(\s*)/, '$1- [ ] '),
        )
        .join('\n')

      const shift = next.length - (tail - head)
      return {
        value: value.slice(0, head) + next + value.slice(tail),
        from: from + (marked ? -6 : 6),
        to: to + shift,
      }
    })

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

        {/* Правки текста — посередине, между тем, что убирает заметку, и тем,
            что заводит следующую: они относятся к открытой, а не к списку. */}
        {note && (
          <div className="flex items-center gap-1">
            <ToolButton icon={TextBoldIcon} label={t('notes.bold')} onClick={bold} />
            <ToolButton icon={CheckListIcon} label={t('notes.todo')} onClick={todo} />
          </div>
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
          ref={field}
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

/** Одна кнопка правки: значок и подпись только для чтения с экрана. */
function ToolButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-lg text-ink outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-ink/6 focus-visible:bg-ink/6 active:scale-[0.95]"
    >
      <HugeiconsIcon
        icon={icon}
        size={18}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </button>
  )
}
