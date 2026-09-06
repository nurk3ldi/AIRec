import { HugeiconsIcon } from '@hugeicons/react'
import { NoteAddIcon } from '@hugeicons/core-free-icons'
import { useT } from '../../lib/i18n'

/**
 * Третья полоса: сама заметка, а пока — только её панель.
 *
 * **Кнопка «новая заметка» стоит здесь, а не над списком.** Полоса шире всех и
 * пуста, и именно в ней заметка появится, когда её заведут: действие стоит там,
 * где виден его результат. Верхний правый угол — то место, где эту кнопку
 * держат Заметки и Почта, и рука ищет её там.
 *
 * Значок без слова: «новая заметка» рядом с плюсом сказало бы то же самое
 * дважды, а подпись для чтения с экрана живёт в `aria-label`.
 *
 * **Пока она ничего не создаёт.** Таблицы `notes` не существует, есть только
 * `note_folders`. Это тот случай, когда элемент управления временно
 * бездействует — в отличие от поля поиска рядом, где отсутствие данных ещё
 * можно назвать незавершённостью. Кнопка оживёт вместе с таблицей и
 * эндпоинтом; до тех пор она стоит на своём месте и ждёт их.
 */
export default function NoteView({ onCreate, className = '' }) {
  const t = useT()

  return (
    <section className={`flex flex-col ${className}`}>
      {/* Панель без линии под собой: полосы на этом экране разделены только
          вертикалями, и горизонталь здесь была бы вторым видом границы. */}
      <div className="flex shrink-0 items-center justify-end p-3">
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

      {/* Место под саму заметку. */}
      <div className="min-h-0 flex-1" />
    </section>
  )
}
