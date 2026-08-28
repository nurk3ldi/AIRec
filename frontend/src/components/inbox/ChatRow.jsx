import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { clockOf } from '../../lib/appointments'
import { getLocale, useT } from '../../lib/i18n'

/**
 * One conversation in the list.
 *
 * The client and the last thing said, stacked; the time above the row's own
 * menu in a column on the right.
 *
 * **No avatar.** A circle of initials is decoration on a list where every row
 * is the same kind of thing — there is no photo to show and no second sort of
 * correspondent to tell apart, so the disc would carry nothing the name beside
 * it does not already say, while taking 56px off the width the name and the
 * preview have to share in a 340px column.
 *
 * **The mark before the preview is a single tick, not the double one.** `✓✓`
 * means delivered-and-read everywhere a person has seen it, and this product
 * has no delivery receipts at all — there is no outbound channel yet, let alone
 * a receipt from one. What the row can honestly say is *who spoke last*, which
 * is `last_message_author`: a tick when the answer was ours, and nothing when
 * the client is the one still waiting.
 */

/**
 * When the last message came in, at the width a list row can spare.
 *
 * Today is a clock, because the hour is what tells two of this morning's
 * threads apart; any other day is a date, because "15:18" on a row from last
 * Tuesday is the one piece of information nobody wants.
 */
function stampOf(iso, timeZone) {
  const at = new Date(iso)
  const today = new Date()
  const isToday =
    at.toDateString() === today.toDateString() &&
    at.getFullYear() === today.getFullYear()

  if (isToday) return clockOf(iso, timeZone)

  return new Intl.DateTimeFormat(getLocale(), {
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(at)
}

export default function ChatRow({ chat, timeZone, onOpen, onMenu }) {
  const t = useT()
  const title = chat.client_name || chat.client_phone
  // Ours, whoever said it — the owner stepping in and the assistant answering
  // are the same fact from the list's point of view: this thread is not waiting
  // on anybody here.
  const answered =
    chat.last_message_author === 'assistant' ||
    chat.last_message_author === 'owner'

  return (
    // **The menu is a sibling of the row, not a child of it.** The row is a
    // button — the whole of it opens the thread, which is what a list row is
    // for — and a button inside a button is markup a browser is entitled to
    // rearrange. Both sit in a `relative` box instead, with the row leaving
    // room on its right for the column that floats over it.
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpen?.(chat)}
        // `px-4` is the panel's own gutter, so the client's name starts on the
        // same line as the search pill's edge and the filters above it.
        className="w-full px-4 py-2.5 pr-16 text-left outline-none transition-colors hover:bg-ink/4 focus-visible:bg-ink/6"
      >
        <span className="block truncate text-[15px] font-medium text-ink">
          {title}
        </span>

        {/* The tick and the text share one line and one truncation: the mark is
            `shrink-0` so a long preview never squeezes it out, and the preview
            itself is what gives way. */}
        <span className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
          {answered && (
            <HugeiconsIcon
              icon={Tick02Icon}
              size={14}
              strokeWidth={2.4}
              className="shrink-0"
            />
          )}
          <span className="truncate">{chat.last_message_preview ?? ''}</span>
        </span>
      </button>

      {/* The right-hand column, floated over the row's reserved `pr-16`. It is
          `pointer-events-none` as a whole so the time does not eat clicks meant
          for the row underneath it, and the menu button takes its own back. */}
      <div className="pointer-events-none absolute inset-y-0 right-4 flex flex-col items-end justify-between py-2.5">
        <span className="text-[12px] leading-none text-muted tabular-nums">
          {chat.last_message_at ? stampOf(chat.last_message_at, timeZone) : ''}
        </span>

        <button
          type="button"
          onClick={() => onMenu?.(chat)}
          aria-label={t('inbox.actions')}
          className="pointer-events-auto -m-1 grid h-6 w-6 place-items-center rounded-full p-1 text-muted outline-none transition-colors hover:text-ink focus-visible:text-ink"
        >
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
