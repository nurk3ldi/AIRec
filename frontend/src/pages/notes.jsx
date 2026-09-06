import { useEffect, useState } from 'react'
import {
  createNoteFolder,
  listNoteFolders,
  updateNoteFolder,
} from '../lib/api'
import { authed } from '../lib/auth'
import { useT } from '../lib/i18n'
import FolderList from '../components/notes/FolderList'
import NoteList from '../components/notes/NoteList'
import NoteView from '../components/notes/NoteView'
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
  // Папки владельца. `null`, пока не пришёл первый ответ, — это отличает «ещё
  // спрашиваем» от «спросили, и их нет».
  const [custom, setCustom] = useState(null)

  useEffect(() => {
    let alive = true
    authed(listNoteFolders)
      .then((rows) => alive && setCustom(rows))
      // Проглатываем, как и все чтения на экранах: полоса ошибки над пустым
      // списком говорит меньше, чем сам пустой список.
      .catch(() => alive && setCustom([]))
    return () => {
      alive = false
    }
  }, [])

  /**
   * Всё, что меняет папки, идёт одним путём: отправить, взять ответ сервера,
   * заменить строку.
   *
   * Ответом, а не тем, что мы послали: `updated_at` и порядок считает сервер, и
   * состояние, собранное из запроса, разошлось бы с базой на первом же поле,
   * которое он трогает сам.
   */
  const createFolder = async () => {
    const made = await authed((token) =>
      createNoteFolder(token, t('notes.newFolder')),
    )
    setCustom((was) => [...(was ?? []), made])
    // Заведённая папка сразу открывается: её завели, чтобы в неё что-то
    // положить, а не чтобы посмотреть на строку в списке.
    setFolder(made.id)
  }

  const patch = async (id, changes) => {
    const saved = await authed((token) => updateNoteFolder(token, id, changes))
    setCustom((was) => (was ?? []).map((f) => (f.id === id ? saved : f)))
    return saved
  }

  const renameFolder = (id, name) => patch(id, { name })

  const moveFolder = async (id, to) => {
    await patch(id, to === 'archive' ? { archived: true } : { trashed: true })
    // Открытой остаётся папка, которую видно: убранная со списка уже не она.
    setFolder((open) => (open === id ? 'all' : open))
  }

  // На полосе — только те, что лежат на месте. Архив и корзина показывают свои
  // собственные содержимое, когда им будет что показывать.
  const shelf = (custom ?? []).filter((f) => !f.archived && !f.trashed)

  return (
    <div
      className={`${styles.page} flex h-[calc(100vh-118px-env(safe-area-inset-bottom))] divide-x divide-line overflow-hidden sm:h-[calc(100vh-68px)]`}
      aria-label={t('nav.notes')}
    >
      <FolderList
        value={folder}
        onChange={setFolder}
        custom={shelf}
        onCreate={createFolder}
        onRename={renameFolder}
        onMove={moveFolder}
        className="hidden w-[20%] shrink-0 sm:flex"
      />

      <NoteList className="hidden w-[25%] shrink-0 sm:flex" />

      {/* Сама заметка — оставшиеся 55%, и она же единственная на телефоне. */}
      <NoteView className="min-w-0 flex-1" />
    </div>
  )
}
