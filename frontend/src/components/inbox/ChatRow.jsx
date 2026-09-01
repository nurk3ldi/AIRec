import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Delete02Icon,
  More02Icon,
  PinIcon,
  PinOffIcon,
} from '@hugeicons/core-free-icons'
import { getLocale, useT } from '../../lib/i18n'
import { PANEL_MOTION } from '../appointments/panel'

/**
 * Один разговор в списке.
 *
 * **Строка, а не карточка.** Правило записано на `/appointments`, в
 * `MobileList`: карточка нужна там, где в одной колонке лежат вещи разного
 * рода, а линия — там, где все они одного. Здесь все одного: разговор. К тому
 * же полоса узкая, и собственные поля карточки съедали бы у каждой строки
 * сорок с лишним пикселей на то, чтобы сообщить, что она карточка.
 *
 * **Время — в верхней строке, у правого края.** Так его собирают все списки
 * переписок, и не по привычке: время — то, по чему список отсортирован, а
 * колонка, задающая порядок, читается сверху вниз одним движением. Уехав вниз,
 * к реплике, оно вставало в неровный столбец — реплики разной длины, и правый
 * край у них у каждой свой.
 *
 * **Меню — три точки у правого края, по центру строки.** По центру, потому что
 * оно относится ко всей строке, а не к одной из двух её линий. В нём два
 * действия: закрепить и удалить.
 *
 * **Удаление просит второго нажатия, а не диалога.** Диалог поверх поповера —
 * слой на слое ради вопроса в два слова; а одна красная кнопка рядом с
 * «Закрепить» — одно промахнувшееся касание от потерянной переписки. Тот же
 * размен, что у кнопки удаления в панели записи.
 */
export default function ChatRow({ chat, selected, onSelect, onAction }) {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const act = (action) => {
    // Меню закрывается само: оставшись открытым над строкой, которая только что
    // переехала наверх или исчезла, оно висит над чужой строкой.
    setMenuOpen(false)
    setConfirming(false)
    onAction?.(action, chat)
  }

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => onSelect?.(chat)}
        // **`pr-10` держит место под меню.** Кнопка с тремя точками лежит
        // поверх строки абсолютом, и без этого запаса реплика уезжала бы под
        // неё: текст обрезался бы там, где его ничто не обрезает на вид.
        className={`flex w-full items-center gap-2 rounded-xl py-3 pr-10 pl-3 text-left outline-none transition-colors ${
          selected ? 'bg-ink/6' : 'hover:bg-ink/4 active:bg-ink/8'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {chat.pinned && (
              <HugeiconsIcon
                icon={PinIcon}
                size={13}
                strokeWidth={2}
                aria-hidden="true"
                // Залитая, а не контурная: на тринадцати пикселях контур
                // читается как пятно, а закреплённость — состояние, а не намёк.
                className="shrink-0 self-center text-muted [&_path]:fill-current"
              />
            )}
            <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
              {chat.client_name || chat.client_phone}
            </p>
            {/* `tabular-nums`, чтобы столбец не дёргался, когда «9:05» сменяется
                на «14:22»: у пропорциональных цифр разная ширина. */}
            <time className="shrink-0 text-[12px] text-muted tabular-nums">
              {stamp(chat.last_message_at)}
            </time>
          </div>

          <p className="mt-0.5 truncate text-[13px] text-muted">
            {/* Кто сказал — половина смысла реплики: «записал вас на четверг»
                от ассистента и от клиента значат разное. Клиента не
                подписываем: он и есть тот, чьё имя стоит строкой выше. */}
            {chat.last_message_author === 'assistant' && (
              <span className="text-ink/70">{t('inbox.byAssistant')}: </span>
            )}
            {chat.last_message_author === 'owner' && (
              <span className="text-ink/70">{t('inbox.byYou')}: </span>
            )}
            {chat.last_message_preview}
          </p>
        </div>
      </button>

      {/* Вне кнопки строки, а не внутри: кнопка в кнопке — недопустимая
          вложенность, и нажатие на меню открывало бы заодно и разговор. */}
      <Popover.Root
        open={menuOpen}
        onOpenChange={(next) => {
          setMenuOpen(next)
          // Закрыли, не подтвердив, — значит передумали; в следующий раз меню
          // должно открыться в спокойном состоянии.
          if (!next) setConfirming(false)
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={t('inbox.actions')}
            className="absolute top-1/2 right-1 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted outline-none transition-[color,background-color,scale] duration-150 ease-out hover:bg-ink/6 hover:text-ink focus-visible:bg-ink/6 focus-visible:text-ink active:scale-[0.95]"
          >
            <HugeiconsIcon icon={More02Icon} size={16} strokeWidth={2} />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="end"
            side="bottom"
            sideOffset={4}
            collisionPadding={12}
            className={`z-50 w-44 rounded-xl border border-line bg-surface p-1 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] outline-none ${PANEL_MOTION}`}
          >
            <MenuItem
              icon={chat.pinned ? PinOffIcon : PinIcon}
              onClick={() => act(chat.pinned ? 'unpin' : 'pin')}
            >
              {t(chat.pinned ? 'inbox.unpin' : 'inbox.pin')}
            </MenuItem>

            <MenuItem
              icon={Delete02Icon}
              tone="danger"
              onClick={() =>
                confirming ? act('delete') : setConfirming(true)
              }
            >
              {t(confirming ? 'inbox.deleteConfirm' : 'inbox.delete')}
            </MenuItem>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </li>
  )
}

function MenuItem({ icon, tone, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] outline-none transition-colors hover:bg-ink/6 focus-visible:bg-ink/6 active:bg-ink/10 ${
        tone === 'danger' ? 'text-danger' : 'text-ink'
      }`}
    >
      <HugeiconsIcon icon={icon} size={16} strokeWidth={2} className="shrink-0" />
      {children}
    </button>
  )
}

/**
 * Время последней реплики.
 *
 * Сегодняшнее — часами, всё прочее — датой: «14:22» у разговора недельной
 * давности отвечает не на тот вопрос, который задают, глядя на список.
 */
function stamp(iso) {
  if (!iso) return ''

  const at = new Date(iso)
  const today = new Date()
  const sameDay =
    at.getFullYear() === today.getFullYear() &&
    at.getMonth() === today.getMonth() &&
    at.getDate() === today.getDate()

  return at.toLocaleString(
    getLocale(),
    sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short' },
  )
}
