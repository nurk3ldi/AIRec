import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Archive02Icon,
  ArrowDown01Icon,
  Delete02Icon,
  PinIcon,
  PinOffIcon,
} from '@hugeicons/core-free-icons'
import { clockOf } from '../../lib/appointments'
import { getLocale, useT } from '../../lib/i18n'
import { PANEL_MOTION } from '../appointments/panel'

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
 * **The preview says who spoke, in words rather than in a mark.** It was a
 * tick, which was wrong in both directions: `✓✓` means delivered-and-read to
 * anybody who has used a messenger, and this product has no delivery receipts
 * at all — while a mark that meant "ours" could not say *which* of us. A label
 * can: «Ассистент:» when the bot answered, «Вы:» when the owner did, and
 * nothing at all when the client wrote last, because the client's own words
 * need no attribution on a row that is already titled with their name.
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

export default function ChatRow({ chat, timeZone, onOpen, onAction }) {
  const t = useT()
  /**
   * Whether the delete row is armed.
   *
   * **Two presses, not a dialog** — the same answer `BookingPopover` gives to
   * the same question. A confirmation window inside a menu is a layer on a
   * layer for a two-word question, and one red row a slip away from destroying
   * a conversation and every message in it is worse than either. Reset whenever
   * the menu closes, so an armed row never survives to the next opening.
   */
  const [armed, setArmed] = useState(false)
  // Controlled, so an action can close the menu itself. `Popover.Close` would
  // do it for pin and archive, but not for delete — that one has to stay open
  // through its first press to show the confirm.
  const [menuOpen, setMenuOpen] = useState(false)
  const title = chat.client_name || chat.client_phone
  // Who said the last thing, as a word. The client gets none — see the note
  // above.
  const said =
    chat.last_message_author === 'assistant'
      ? t('inbox.byAssistant')
      : chat.last_message_author === 'owner'
        ? t('inbox.byYou')
        : null

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
        {/* **The pin sits beside the name, not on the far side of the row.**
            It explains why this thread is at the top, and an explanation four
            inches from the thing it explains is not one. `shrink-0` after a
            `truncate`d name, so a long name gives way and the mark never
            does. */}
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-[15px] font-medium text-ink">
            {title}
          </span>
          {chat.pinned && (
            <HugeiconsIcon
              icon={PinIcon}
              size={13}
              strokeWidth={2.2}
              // **Filled, and it has to be done in CSS.** The free icon set is
              // stroke-only — there is no solid variant to import — and the
              // paths carry `stroke` but no `fill`, so filling them is one
              // rule. The needle is an open path and encloses no area, which is
              // why it stays a line while the head becomes solid.
              className="shrink-0 text-muted [&_path]:fill-current"
              aria-label={t('inbox.pin')}
            />
          )}
        </span>

        {/* One line and one truncation, label included: «Вы: …» is a single
            sentence, and truncating the two halves separately would cut the
            name off before the message it belongs to. */}
        <span className="mt-0.5 block truncate text-[13px] text-muted">
          {said && `${said}: `}
          {chat.last_message_preview ?? ''}
        </span>
      </button>

      {/* The right-hand column, floated over the row's reserved `pr-16`. It is
          `pointer-events-none` as a whole so the time does not eat clicks meant
          for the row underneath it, and the menu button takes its own back. */}
      <div className="pointer-events-none absolute inset-y-0 right-4 flex flex-col items-end justify-between py-2.5">
        <span className="text-[12px] leading-none text-muted tabular-nums">
          {chat.last_message_at ? stampOf(chat.last_message_at, timeZone) : ''}
        </span>

        <Popover.Root
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open)
            if (!open) setArmed(false)
          }}
        >
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label={t('inbox.actions')}
              className="pointer-events-auto -m-1 grid h-6 w-6 place-items-center rounded-full p-1 text-muted outline-none transition-colors hover:text-ink focus-visible:text-ink"
            >
              <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={2} />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            {/* The app's one panel entrance, shared with everything that opens
                on `/appointments`: it grows out of the control that opened it.
                See `PANEL_MOTION`. */}
            <Popover.Content
              side="bottom"
              align="end"
              sideOffset={6}
              collisionPadding={12}
              className={`z-50 w-[220px] rounded-xl border border-line bg-surface p-1 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)] outline-none ${PANEL_MOTION}`}
            >
              {/* Label left, glyph right — the reference's order, and the one
                  that lets the eye run down the words rather than the icons. */}
              {/* The glyph says which way the row goes, like the label beside
                  it: a struck-through pin for the one that takes it off. */}
              <MenuItem
                icon={chat.pinned ? PinOffIcon : PinIcon}
                label={t(chat.pinned ? 'inbox.unpin' : 'inbox.pin')}
                onClick={() => {
                  setMenuOpen(false)
                  onAction?.(chat, { pinned: !chat.pinned })
                }}
              />
              <MenuItem
                icon={Archive02Icon}
                label={t(chat.archived ? 'inbox.unarchive' : 'inbox.archive')}
                onClick={() => {
                  setMenuOpen(false)
                  onAction?.(chat, { archived: !chat.archived })
                }}
              />
              <MenuItem
                icon={Delete02Icon}
                label={t(armed ? 'inbox.deleteConfirm' : 'inbox.delete')}
                danger
                onClick={() => {
                  if (!armed) {
                    setArmed(true)
                    return
                  }
                  setMenuOpen(false)
                  onAction?.(chat, 'delete')
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  )
}

/**
 * One row of the menu.
 *
 * `danger` is the delete row and nothing else. It is the only coloured thing in
 * here, which is what makes it readable as the one action that cannot be taken
 * back — a menu where two rows are tinted has nothing left to say that with.
 */
function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-[15px] outline-none transition-colors ${
        danger
          ? 'text-danger hover:bg-danger/8 focus-visible:bg-danger/8'
          : 'text-ink hover:bg-ink/6 focus-visible:bg-ink/6'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <HugeiconsIcon
        icon={icon}
        size={17}
        strokeWidth={2}
        className="shrink-0"
      />
    </button>
  )
}
