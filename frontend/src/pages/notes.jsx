import { useState } from 'react'
import { useT } from '../lib/i18n'
import { Folder01Icon } from '@hugeicons/core-free-icons'
import FolderList from '../components/notes/FolderList'
import styles from '../styles/Notes.module.css'

/**
 * Заметки — три полосы: папки, список, сама заметка.
 *
 * Пока пусто: ни модели, ни эндпоинта под этим нет — `notes` в базе не
 * существует, и `lib/api.js` о них не знает. Стоит одна раскладка, чтобы
 * посмотреть на неё прежде, чем в неё что-то класть.
 *
 * **Определённая высота, а не минимальная**, как на `/appointments`: каждая
 * полоса будет прокручиваться у себя, а измерить ребёнка можно только
 * относительно высоты, которая определена. Под `min-height` цепочка flex имеет
 * неопределённый поперечный размер, каждый `flex-1` внутри разрешается в
 * собственное содержимое, и страница отращивает полосу прокрутки вместо того,
 * чтобы её отрастил список. Числа — те же, что в модуле, записанные второй раз
 * настоящей высотой; двигать их нужно вместе.
 *
 * **Между полосами только линия — ни карточек, ни заливок, ни радиусов.** Так
 * устроены Почта, Заметки и всё, что делится на колонки: колонка — это область
 * одной поверхности, а не предмет, лежащий на ней. Карточка сказала бы, что
 * полосы можно переставить или убрать, а их нельзя.
 *
 * `divide-x` вместо трёх `border-r`: линия ставится между соседями, поэтому
 * лишней справа от последней полосы не появится.
 *
 * **Ниже `sm` остаётся одна полоса.** Четверть телефона — это девяносто
 * пикселей, то есть не колонка. Как папки и список туда попадут, решается
 * отдельно — так же, как на `/appointments`, где телефон получил свой
 * собственный экран.
 */
export default function NotesPage() {
  const t = useT()
  // Какая папка открыта. Локально и без запоминания между визитами: три
  // состояния, и «все заметки» — то, с чего начинают каждый раз.
  const [folder, setFolder] = useState('all')
  // Папки, заведённые владельцем. Пока живут только здесь: таблицы под ними
  // нет — см. `FolderList`.
  const [custom, setCustom] = useState([])

  const createFolder = () => {
    const id = `folder-${Date.now()}`
    setCustom((was) => [
      ...was,
      { id, name: `${t('notes.newFolder')} ${was.length + 1}`, icon: Folder01Icon },
    ])
    // Заведённая папка сразу открывается: её завели, чтобы в неё что-то
    // положить, а не чтобы посмотреть на строку в списке.
    setFolder(id)
  }

  const renameFolder = (id, name) =>
    setCustom((was) => was.map((f) => (f.id === id ? { ...f, name } : f)))

  // В архив и в корзину — пока просто «убрать из списка»: показывать
  // содержимое этих двух папок ещё нечем, а держать строку на месте после
  // «удалить» значит соврать о том, что действие произошло.
  const moveFolder = (id) => {
    setCustom((was) => was.filter((f) => f.id !== id))
    setFolder((open) => (open === id ? 'all' : open))
  }

  return (
    <div
      className={`${styles.page} flex h-[calc(100vh-118px-env(safe-area-inset-bottom))] divide-x divide-line overflow-hidden sm:h-[calc(100vh-68px)]`}
      aria-label={t('nav.notes')}
    >
      <FolderList
        value={folder}
        onChange={setFolder}
        custom={custom}
        onCreate={createFolder}
        onRename={renameFolder}
        onMove={moveFolder}
        className="hidden w-[20%] shrink-0 sm:flex"
      />

      {/* Список заметок */}
      <div className="hidden w-[25%] shrink-0 sm:block" />

      {/* Сама заметка — оставшиеся 55%, и она же единственная на телефоне. */}
      <div className="min-w-0 flex-1" />
    </div>
  )
}
