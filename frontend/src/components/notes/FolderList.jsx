import { useEffect, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Archive02Icon,
  Delete02Icon,
  Folder01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
} from '@hugeicons/core-free-icons'
import { PANEL_MOTION } from '../appointments/panel'
import { useT } from '../../lib/i18n'

/**
 * Первая полоса: три состояния сверху, папки владельца под ними.
 *
 * **Три верхние не создаются, не переименовываются и не удаляются.** Это не
 * папки, а три состояния, в которых бывает заметка: живая, убранная с глаз,
 * выброшенная. Поэтому массив — константа модуля, и меню с тремя точками у них
 * нет: переименовать «Корзину» значит соврать о том, что она делает, а удалить
 * её — убрать состояние, в которое заметки всё равно попадают.
 *
 * `labelKey`, а не готовая строка: константа вычисляется один раз при импорте,
 * и переведённый текст здесь застыл бы на том языке, который был при первом
 * запуске, и никогда не последовал бы за переключением. То же правило, что у
 * `NAVIGATION` и `PROFILE_SECTIONS`. У папок владельца, наоборот, имя — данные,
 * и переводить его нечем.
 *
 * **Под ними ещё нет базы.** Ни таблицы `folders`, ни `notes` не существует,
 * поэтому и папка, и её переименование, и отправка в архив живут в состоянии
 * страницы и исчезают при перезагрузке. Кнопки при этом не мёртвые — делают
 * ровно то, что обещают, — но чтобы всё это сохранялось, нужны таблица и
 * эндпоинт.
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
  onRename,
  onMove,
  className = '',
}) {
  const t = useT()
  // Какую папку сейчас переименовывают, по id. Одна на весь список: две
  // открытые строки ввода — это два имени, и непонятно, какое из них в работе.
  const [renaming, setRenaming] = useState(null)

  return (
    <nav className={`flex flex-col p-2 ${className}`}>
      <div className="flex flex-col gap-0.5">
        {FOLDERS.map((folder) => (
          <Row
            key={folder.id}
            folder={folder}
            label={t(folder.labelKey)}
            isActive={folder.id === value}
            onSelect={() => onChange(folder.id)}
          />
        ))}

        {custom.map((folder) => (
          <Row
            key={folder.id}
            folder={folder}
            label={folder.name}
            isActive={folder.id === value}
            onSelect={() => onChange(folder.id)}
            renaming={renaming === folder.id}
            onRenameStart={() => setRenaming(folder.id)}
            onRenameEnd={(name) => {
              setRenaming(null)
              if (name && name !== folder.name) onRename?.(folder.id, name)
            }}
            onMove={(to) => onMove?.(folder.id, to)}
          />
        ))}
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

/**
 * Одна строка.
 *
 * **Подсветка живёт на строке, а не на кнопке.** Справа от кнопки стоит меню, и
 * выделение обязано накрывать его тоже — иначе выбранная строка обрывается, не
 * дойдя до края. Кнопка в кнопке к тому же недопустима, а нажатие на меню
 * заодно открывало бы папку.
 */
function Row({
  folder,
  label,
  isActive,
  onSelect,
  renaming,
  onRenameStart,
  onRenameEnd,
  onMove,
}) {
  return (
    <div
      className={`flex items-center rounded-lg transition-colors ${
        isActive ? 'bg-surface-chip' : 'hover:bg-ink/5'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? 'true' : undefined}
        className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] outline-none transition-colors active:bg-ink/10 ${
          isActive ? 'font-medium text-ink' : 'text-muted'
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
        {renaming ? (
          <NameField value={label} onDone={onRenameEnd} />
        ) : (
          <span className="min-w-0 truncate">{label}</span>
        )}
      </button>

      {onMove && !renaming && (
        <FolderMenu onRename={onRenameStart} onMove={onMove} />
      )}
    </div>
  )
}

/**
 * Переименование прямо в строке.
 *
 * Не диалог: имя папки — одно поле, а окно ради одного поля закрывает список, в
 * котором и видно, чем это имя отличается от соседних. Enter подтверждает,
 * Escape отменяет, потеря фокуса подтверждает — так ведёт себя переименование в
 * файловых менеджерах, и это то, чего ждёт рука.
 */
function NameField({ value, onDone }) {
  const [draft, setDraft] = useState(value)
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.select()
  }, [])

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onDone(draft.trim())}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onDone(draft.trim())
        if (event.key === 'Escape') onDone(null)
      }}
      // Клик по полю не должен открывать папку.
      onClick={(event) => event.stopPropagation()}
      className="min-w-0 flex-1 appearance-none rounded-md bg-surface px-1.5 py-0.5 text-[14px] text-ink shadow-[0_0_0_1px_var(--color-field-focus)] outline-none"
    />
  )
}

/** Три точки и то, что за ними. */
function FolderMenu({ onRename, onMove }) {
  const t = useT()
  const [open, setOpen] = useState(false)

  const act = (run) => {
    setOpen(false)
    run()
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t('notes.folderActions')}
          className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted outline-none transition-[color,background-color,scale] duration-150 ease-out hover:bg-ink/8 hover:text-ink focus-visible:bg-ink/8 focus-visible:text-ink active:scale-[0.95]"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={16} strokeWidth={2} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          side="right"
          sideOffset={6}
          collisionPadding={12}
          className={`z-50 w-52 rounded-xl border border-line bg-surface p-1 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] outline-none ${PANEL_MOTION}`}
        >
          <MenuItem icon={PencilEdit02Icon} onClick={() => act(onRename)}>
            {t('notes.rename')}
          </MenuItem>
          <MenuItem
            icon={Archive02Icon}
            onClick={() => act(() => onMove('archive'))}
          >
            {t('notes.toArchive')}
          </MenuItem>

          {/* Черта перед необратимым: остальные пункты меняют папку, этот её
              убирает, и рука не должна попадать в него, промахнувшись на
              строку. */}
          <div className="my-1 h-px bg-line" />

          <MenuItem
            icon={Delete02Icon}
            tone="danger"
            onClick={() => act(() => onMove('trash'))}
          >
            {t('notes.toTrash')}
          </MenuItem>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function MenuItem({ icon, tone, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] outline-none transition-colors active:bg-ink/10 ${
        tone === 'danger'
          ? 'text-danger hover:bg-danger/10 focus-visible:bg-danger/10'
          : 'text-ink hover:bg-ink/6 focus-visible:bg-ink/6'
      }`}
    >
      <HugeiconsIcon
        icon={icon}
        size={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
        className="shrink-0"
      />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  )
}
