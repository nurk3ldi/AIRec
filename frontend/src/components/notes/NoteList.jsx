import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { useT } from '../../lib/i18n'
import { notePreview, noteStamp, noteTitle } from '../../lib/notes'

/**
 * Вторая полоса: поиск сверху, заметки под ним.
 *
 * **Строка в списке — это сама заметка, прочитанная сверху вниз.** Первая её
 * строка становится заголовком, остальное — предпросмотром: отдельного
 * заголовка у заметки нет ни здесь, ни в таблице, потому что он был бы вторым
 * экземпляром того, что и так лежит в тексте.
 *
 * У пустой заметки заголовка нет — вместо него подпись «Новая заметка»: только
 * что заведённая строка иначе оказалась бы пустой, и в списке её было бы не
 * отличить от пробела.
 *
 * **Строка запроса лежит на странице, а не здесь.** Ищет сервер, запрос делает
 * тот, кто владеет списком.
 *
 * **Поле не в карточке и без своей рамки-коробки** — полосы на этом экране
 * разделены только линиями, и поле внутри одной из них подчиняется тому же:
 * заливка `surface` и кольцо в один пиксель, как у любого поля в приложении.
 *
 * 16px до `sm` — как у каждого поля здесь: iOS увеличивает страницу, когда
 * фокус получает поле мельче, и обратно не возвращает.
 */
export default function NoteList({
  notes,
  selected,
  onSelect,
  query,
  onQuery,
  className = '',
}) {
  const t = useT()

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
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t('notes.search')}
          aria-label={t('notes.search')}
          className="h-9 w-full appearance-none rounded-lg bg-surface pr-9 pl-9 text-[16px] text-ink shadow-[0_0_0_1px_var(--color-field)] outline-none transition-shadow duration-150 placeholder:text-muted hover:shadow-[0_0_0_1px_var(--color-field-hover)] focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)] sm:text-[14px]"
        />
        {/* Появляется только когда есть что стирать: крестик над пустым полем —
            кнопка, которой нечего делать. */}
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            aria-label={t('notes.searchClear')}
            className="absolute top-1/2 right-6 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted outline-none transition-[color,background-color,scale] duration-150 ease-out hover:bg-ink/8 hover:text-ink focus-visible:bg-ink/8 focus-visible:text-ink active:scale-[0.95]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {notes === null || notes.length === 0 ? (
        // Пустое состояние по центру полосы, как в Заметках: сообщение об
        // отсутствии — единственное, что здесь есть, и прижимать его к верху
        // значило бы оставить под ним полосу пустоты, которая ничего не
        // говорит. Пока список не пришёл, здесь тоже пусто: сообщать «ничего
        // нет» до ответа сервера значит утверждать то, чего мы не знаем.
        <div className="grid min-h-0 flex-1 place-items-center p-6">
          {notes !== null && (
            <p className="text-center text-[14px] text-muted">
              {t(query ? 'notes.nothingFound' : 'notes.empty')}
            </p>
          )}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {notes.map((note) => (
            <li key={note.id}>
              <Row
                note={note}
                isActive={note.id === selected}
                onSelect={() => onSelect(note.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Одна заметка в списке: заголовок, под ним время и остаток текста.
 *
 * Время и предпросмотр стоят на одной строке, как в Заметках: время — то, по
 * чему список отсортирован, и держать его рядом с текстом дешевле, чем отдавать
 * ему третью строку в полосе шириной в четверть экрана.
 */
function Row({ note, isActive, onSelect }) {
  const t = useT()
  const title = noteTitle(note)
  const preview = notePreview(note)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive ? 'true' : undefined}
      className={`w-full rounded-lg px-2.5 py-2 text-left outline-none transition-colors active:bg-ink/10 ${
        isActive ? 'bg-surface-chip' : 'hover:bg-ink/5'
      }`}
    >
      <p
        className={`truncate text-[14px] font-semibold ${
          title ? 'text-ink' : 'text-muted'
        }`}
      >
        {title || t('notes.untitled')}
      </p>
      <p className="mt-0.5 flex min-w-0 items-baseline gap-1.5 text-[13px]">
        <span className="shrink-0 text-ink tabular-nums">
          {noteStamp(note)}
        </span>
        <span className="min-w-0 truncate text-muted">
          {preview || t('notes.noText')}
        </span>
      </p>
    </button>
  )
}
