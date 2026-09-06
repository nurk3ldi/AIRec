import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { useT } from '../../lib/i18n'

/**
 * Вторая полоса: поиск сверху, заметки под ним.
 *
 * **Пока искать нечего.** Ни таблицы `notes`, ни эндпоинта под ней не
 * существует, так что поле есть, а списка нет. Это не то же самое, что мёртвая
 * кнопка: кнопка, которая ничего не делает при нажатии, — сломанный элемент
 * управления, а поле, которому пока некуда отправлять текст, просто
 * недоделано. Тем же различием живёт `HeaderSearch`.
 *
 * **Строка запроса лежит здесь, а не на странице.** Отвечает на неё список, а
 * список — это и есть эта полоса. Когда заметки появятся и запрос уйдёт на
 * сервер, он переедет наверх, к тому, кто делает запрос.
 *
 * **Поле не в карточке и без своей рамки-коробки** — полосы на этом экране
 * разделены только линиями, и поле внутри одной из них подчиняется тому же:
 * заливка `surface` и кольцо в один пиксель, как у любого поля в приложении.
 *
 * 16px до `sm` — как у каждого поля здесь: iOS увеличивает страницу, когда
 * фокус получает поле мельче, и обратно не возвращает.
 */
export default function NoteList({ className = '' }) {
  const t = useT()
  const [query, setQuery] = useState('')

  return (
    <section className={`flex flex-col ${className}`}>
      <div className="relative shrink-0 p-3">
        <HugeiconsIcon
          icon={Search01Icon}
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          // `pointer-events-none`, иначе значок съедает клик по левому краю
          // поля — у поля появляется мёртвый угол.
          className="pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 text-muted"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('notes.search')}
          aria-label={t('notes.search')}
          className="h-9 w-full appearance-none rounded-lg bg-surface pr-9 pl-9 text-[16px] text-ink shadow-[0_0_0_1px_var(--color-field)] outline-none transition-shadow duration-150 placeholder:text-muted hover:shadow-[0_0_0_1px_var(--color-field-hover)] focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)] sm:text-[14px]"
        />
        {/* Появляется только когда есть что стирать: крестик над пустым полем —
            кнопка, которой нечего делать. */}
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('notes.searchClear')}
            className="absolute top-1/2 right-6 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted outline-none transition-[color,background-color,scale] duration-150 ease-out hover:bg-ink/8 hover:text-ink focus-visible:bg-ink/8 focus-visible:text-ink active:scale-[0.95]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* Пустое состояние по центру полосы, как в Заметках: сообщение об
          отсутствии — единственное, что здесь есть, и прижимать его к верху
          значило бы оставить под ним полосу пустоты, которая ничего не
          говорит. */}
      <div className="grid min-h-0 flex-1 place-items-center p-6">
        <p className="text-center text-[14px] text-muted">
          {t(query ? 'notes.nothingFound' : 'notes.empty')}
        </p>
      </div>
    </section>
  )
}
