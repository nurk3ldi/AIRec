import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Archive02Icon,
  Delete02Icon,
  Folder01Icon,
} from '@hugeicons/core-free-icons'
import { useT } from '../../lib/i18n'

/**
 * Первая полоса: три папки, и других не будет.
 *
 * **Три верхние не создаются и не удаляются.** Это не папки пользователя, а
 * три состояния, в которых бывает заметка: живая, убранная с глаз,
 * выброшенная. Поэтому массив — константа модуля: добавить сюда четвёртую
 * строку значит завести четвёртое состояние, и решаться это должно в коде, а не
 * кликом. Папки, которые заводит владелец, — другое дело и живут ниже, отдельным
 * списком.
 *
 * **Под ними ещё нет базы.** Ни таблицы `folders`, ни `notes` не существует,
 * поэтому созданная папка живёт в состоянии страницы и исчезает при
 * перезагрузке. Кнопка при этом не мёртвая — она делает ровно то, что обещает,
 * — но чтобы папка сохранялась, нужна таблица и эндпоинт.
 *
 * `labelKey`, а не готовая строка: константа вычисляется один раз при импорте,
 * и переведённый текст здесь застыл бы на том языке, который был при первом
 * запуске, и никогда не последовал бы за переключением. То же правило, что у
 * `NAVIGATION` и `PROFILE_SECTIONS`.
 *
 * **Выбранная строка — `surface-chip`.** Этот токен во всём приложении значит
 * «то, что выбрано»: сегмент переключателя, кнопка добавления, сегодня в
 * календаре. Не `accent`: на светлой теме он чёрный, и строка превратилась бы в
 * плашку, кричащую громче всего на экране, ради указания на то, что и так
 * открыто.
 *
 * Строки подсвечиваются, а не сжимаются: `active:bg-ink/10`. Сжимать имеет
 * смысл предмет, а строка списка — область, и уменьшать её под пальцем некуда.
 */
const FOLDERS = [
  { id: 'all', labelKey: 'notes.all', icon: Folder01Icon },
  { id: 'archive', labelKey: 'notes.archive', icon: Archive02Icon },
  { id: 'trash', labelKey: 'notes.trash', icon: Delete02Icon },
]

export default function FolderList({
  value,
  onChange,
  custom = [],
  onCreate,
  className = '',
}) {
  const t = useT()

  return (
    <nav className={`flex flex-col p-2 ${className}`}>
      <div className="flex flex-col gap-0.5">
      {[...FOLDERS, ...custom].map((folder) => {
        const isActive = folder.id === value

        return (
          <button
            key={folder.id}
            type="button"
            onClick={() => onChange(folder.id)}
            aria-current={isActive ? 'true' : undefined}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] outline-none transition-colors active:bg-ink/10 ${
              isActive
                ? 'bg-surface-chip font-medium text-ink'
                : 'text-muted hover:bg-ink/5 hover:text-ink focus-visible:bg-ink/5 focus-visible:text-ink'
            }`}
          >
            <HugeiconsIcon
              icon={folder.icon}
              size={17}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.9}
              className="shrink-0"
            />
            <span className="min-w-0 truncate">
              {folder.labelKey ? t(folder.labelKey) : folder.name}
            </span>
          </button>
        )
      })}
      </div>

      {/* Прижата к низу — там же, где она в Заметках и в Почте: список растёт
          сверху вниз, и действие «завести ещё одну» стоит после последней, а не
          перед первой.

          Текст в `ink` и полужирный, а не приглушённый: в `muted` кнопка
          сливалась с фоном полосы и находилась только на ощупь. Заливки при
          этом нет — залитая читалась бы как главное действие полосы, а главное
          здесь выбрать папку, в которой лежат заметки. */}
      <button
        type="button"
        onClick={onCreate}
        className="mt-auto flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] font-medium text-ink outline-none transition-colors hover:bg-ink/6 focus-visible:bg-ink/6 active:bg-ink/10"
      >
        <HugeiconsIcon
          icon={Add01Icon}
          size={17}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          className="shrink-0"
        />
        <span className="min-w-0 truncate">{t('notes.newFolder')}</span>
      </button>
    </nav>
  )
}
