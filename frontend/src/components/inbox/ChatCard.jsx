import { HugeiconsIcon } from '@hugeicons/react'
import { MoreHorizontalIcon } from '@hugeicons/core-free-icons'

/**
 * Один разговор — карточкой, а не строкой списка.
 *
 * Квадрат: сторона выводится из ширины доли (`aspect-square`), а не задаётся в
 * пикселях, поэтому карточка держит форму на любом окне.
 *
 * **Слева вверху: номер, под ним имя.** Порядок не случайный. Номер — то, чем
 * человек опознан в самом канале: он есть всегда, он один и тот же между
 * разговорами, и именно по нему находят прошлые визиты. Имя — то, что клиент
 * сказал о себе, и его может не быть вовсе; тогда вторая строка просто не
 * рисуется, а не превращается в «Без имени», которое сообщает меньше, чем
 * номер строкой выше.
 *
 * Верхний левый угол — там, где начинается чтение, поэтому там стоит то, что
 * отвечает на «чей это разговор».
 */
export default function ChatCard({ chat, className = '' }) {
  return (
    // Без рамки: `surface-raised` — белый на светлой теме и на ступень выше
    // чёрного на тёмной, то есть заливка, которая сама отделяет блок от фона.
    // Рамка поверх неё — обводка вокруг фигуры, у которой край уже есть.
    <article
      className={`flex aspect-square min-w-0 flex-col rounded-2xl bg-surface-raised p-5 ${className}`}
    >
      {/* Верхняя строка: кто это — слева, действия над карточкой — справа.

          Три точки, а не сетка из девяти (`More02`): девять точек означают
          «все приложения», а не «действия над этим». Пока кнопка ничего не
          открывает — меню появится, когда будет чему в нём быть. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
        {/* Обе строки в `ink`, а не имя в `muted`: это одно и то же — кто это,
            — сказанное дважды, а не факт и приписка к нему. Разводит их вес, а
            не цвет: номер полужирный, имя обычным начертанием.

            Отрицательный трекинг на номере — крупный текст читается
            разреженным, если его не поджать; на 15px это уже не нужно. */}
          <p className="truncate font-display text-[17px] leading-tight font-semibold tracking-[-0.01em] text-ink">
            {chat.client_phone}
          </p>
          {chat.client_name && (
            <p className="mt-1 truncate text-[15px] leading-tight text-ink">
              {chat.client_name}
            </p>
          )}
        </div>

        <button
          type="button"
          className="-mt-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-ink/6 focus-visible:bg-ink/6 active:scale-[0.95]"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={18} strokeWidth={2} />
        </button>
      </div>
    </article>
  )
}
