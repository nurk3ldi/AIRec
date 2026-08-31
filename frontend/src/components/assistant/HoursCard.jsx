import { useEffect, useId, useState } from 'react'
import { domMax, LazyMotion, m, useReducedMotion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { MinusSignCircleIcon } from '@hugeicons/core-free-icons'
import { saveWorkingHours } from '../../lib/api'
import { authed } from '../../lib/auth'
import { weekdayLabels } from '../../lib/dates'
import { dayProblem } from '../../lib/schedule'
import { haptic } from '../../lib/haptics'
import { useT } from '../../lib/i18n'
import TimeField from '../appointments/TimeField'
import Reveal from '../Reveal'

/**
 * The working week — the hours the assistant may offer, and the ones it may
 * not.
 *
 * **Seven cells and one editor, not seven rows.** A row per day is seven copies
 * of the same four controls, which is most of a card for a thing that is set
 * once and then glanced at. As a week strip the card answers the question it is
 * actually opened with — *which days are we open* — in one line, and the day you
 * press is the one you get controls for.
 *
 * A cell is filled when the day is worked and outlined when it is not, so the
 * shape of the week reads before any of the numbers do. The chosen day keeps
 * the app's `surface-chip` lift, the same mark every other choice here uses.
 *
 * **Always seven.** A missing day and a closed day have to read differently, so
 * the backend creates the week on first read and this edits what it hands back
 * rather than building a list of its own.
 *
 * **Round the clock is a flag, not `00:00–00:00`.** `is_24h` leaves both times
 * null, and setting it clears the break with them — nothing can interrupt a day
 * that never closes.
 *
 * **A day is checked here before it is sent.** `dayProblem` in `lib/schedule.js`
 * mirrors the rules the server enforces — a close at or before the open, half a
 * break, a break outside the day — because a 422 arriving after Save names a
 * weekday *number* while the owner is looking at a day. It is one function so
 * the two cannot drift; the server is still the authority.
 */

/** What one day of the form holds. `dayProblem` takes exactly this shape. */
const dayOf = (row) => ({
  weekday: row.weekday,
  is24h: Boolean(row.is_24h),
  from: row.opens_at ?? '',
  to: row.closes_at ?? '',
  breakFrom: row.break_starts_at ?? '',
  breakTo: row.break_ends_at ?? '',
})

const weekOf = (rows) =>
  [...(rows ?? [])].sort((a, b) => a.weekday - b.weekday).map(dayOf)

/** Closed: no times at all, and not round the clock either. */
const isClosed = (day) => !day.is24h && !day.from && !day.to

/**
 * The three things a day can be, as one closed set.
 *
 * **They were three controls and are one.** A chip for «24 ч», a text button
 * for «Выходной» and the presence of two time fields for everything else — one
 * question answered by three shapes that did not look related, in a card 350px
 * wide. They are mutually exclusive by definition, which is exactly what a
 * segmented control says and three separate toggles cannot.
 *
 * The times move underneath and appear only for `working`, so the card is
 * quiet on the two states that have no hours to show.
 */
const STATES = [
  { id: 'working', labelKey: 'assistant.dayWorking' },
  { id: 'allDay', labelKey: 'assistant.allDay' },
  { id: 'closed', labelKey: 'assistant.dayOff' },
]

const stateOf = (day) =>
  day.is24h ? 'allDay' : isClosed(day) ? 'closed' : 'working'

export default function HoursCard({ week, onSaved }) {
  const t = useT()
  const [days, setDays] = useState(() => weekOf(week))
  const [picked, setPicked] = useState(0)
  const [saving, setSaving] = useState(false)
  // **Read-only until asked.** The week is looked at far more often than it is
  // changed — it is set once and then glanced at — so the card shows the day
  // and keeps its controls behind «Редактировать», the same bargain the price
  // list makes with its remove button. Local and forgotten on reload: it is a
  // mode you are in for a moment, not a preference.
  const [editing, setEditing] = useState(false)
  const reduce = useReducedMotion()
  // **One id per marker, from `useId`.** Two selections travel on this card and
  // a shared name would fly the pill from the week strip into the segmented
  // control the moment both were on screen — which is always.
  const weekMarker = useId()
  const stateMarker = useId()
  const labels = weekdayLabels()

  useEffect(() => {
    setDays(weekOf(week))
  }, [week])

  const day = days[picked]

  const edit = (changes) =>
    setDays((was) =>
      was.map((row) => (row.weekday === picked ? { ...row, ...changes } : row)),
    )

  // Setting either of these clears what it makes meaningless, so the two can
  // never be read disagreeing with each other — the same thing the server does.
  const blank = { from: '', to: '', breakFrom: '', breakTo: '' }

  const isDirty = JSON.stringify(days) !== JSON.stringify(weekOf(week))
  // The first day that cannot be read as opening hours. One message at a time:
  // seven at once is a wall, and the first is the one to fix.
  const problem = days.map((row) => dayProblem(row)).find(Boolean) ?? null

  /**
   * **«Готово» is the save.** A separate «Сохранить» underneath was a second
   * button for the same moment: you finish editing and you want it kept, and
   * two controls for one intention is one of them you have to explain. Leaving
   * edit mode commits, and a day that cannot be read as opening hours keeps
   * you in it — the message is already on screen.
   */
  const commit = async () => {
    if (!isDirty || saving || problem) return

    setSaving(true)
    try {
      await authed((token) =>
        saveWorkingHours(
          token,
          days.map((row) => ({
            weekday: row.weekday,
            is_24h: row.is24h,
            // Empty is `null`, which is what a closed day is made of — and what
            // round the clock leaves behind.
            opens_at: row.is24h ? null : row.from || null,
            closes_at: row.is24h ? null : row.to || null,
            break_starts_at: row.is24h ? null : row.breakFrom || null,
            break_ends_at: row.is24h ? null : row.breakTo || null,
          })),
        ),
      )
      // Two ticks: something was written. Fired here rather than on the
      // press, because the press is a request and this is the answer.
      haptic('commit')
      onSaved?.()
    } catch {
      // Left as typed: a save that failed is one the owner still means to make.
    } finally {
      setSaving(false)
    }
  }

  const done = async () => {
    if (problem) return
    await commit()
    setEditing(false)
  }

  // Straight back to the week the server holds — which also clears whatever
  // made `problem` true, so a day edited into nonsense is never a trap.
  const cancel = () => {
    setDays(weekOf(week))
    setEditing(false)
  }

  if (!day) return null

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        done()
      }}
      // **The same resting floor as the card above it in the column**, so an
      // empty price list and a full week do not come out as two boxes of
      // visibly different size stacked on each other. «Услуги» still grows past
      // it when its list is unfolded, which is the whole point of the fold.
      //
      // **And it takes whatever the column has left** — `flex-1`, which is what
      // lands its bottom edge on the same line as the two cards beside it
      // rather than somewhere short of them. A `min-height` on the column is
      // enough for that: the main axis resolves against it, so there is real
      // leftover to grow into.
      className="flex min-h-[240px] flex-1 flex-col rounded-2xl bg-surface-raised p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate font-display text-[15px] font-semibold text-ink">
          {t('assistant.hours')}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
        {/* **The row opens to let it in.** «Отмена» is the direct result of
            pressing «Редактировать», so it has to arrive from somewhere rather
            than be there on the next frame — and the somewhere is the row it
            widens. Same shape as the price list's red minus, which is the one
            other control on this page that a mode reveals. */}
        <Reveal open={editing} axis="x">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="h-10 shrink-0 rounded-full px-2.5 text-[13px] font-medium text-muted outline-none transition-[opacity,color,scale] duration-150 ease-out hover:text-ink focus-visible:text-ink active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8"
          >
            {t('assistant.cancel')}
          </button>
        </Reveal>
        <button
          type="button"
          onClick={() => (editing ? done() : setEditing(true))}
          disabled={saving || (editing && Boolean(problem))}
          className={`h-10 shrink-0 rounded-full px-2.5 text-[13px] text-ink outline-none transition-[opacity,scale] duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 ${editing ? 'font-semibold' : 'font-medium'}`}
        >
          {t(
            saving
              ? 'assistant.saving'
              : editing
                ? 'assistant.editDone'
                : 'assistant.edit',
          )}
        </button>
        </div>
      </div>

      {/* The week itself. Seven equal cells, so the row is the same shape
          whatever the labels are in — `flex-1` rather than a fixed width, which
          would only be right for one language. */}
      {/* **`domMax`, not the `domAnimation` the rest of the app runs on.**
          Layout projection — the thing that carries a fill from one cell to
          another — is the one feature the smaller bundle leaves out. It costs
          nothing extra: the sidebar's active marker already pulls it in on
          every dashboard page. Nested inside the shell's own `LazyMotion`,
          which is allowed; the inner features win for this subtree. */}
      <LazyMotion features={domMax}>
        <div className="mt-3 flex gap-1">
          {days.map((item) => {
            const closed = isClosed(item)
            const isPicked = item.weekday === picked

            return (
              <button
                key={item.weekday}
                type="button"
                onClick={() => {
                  // One tick, on the press that changes it — the selection
                  // landing somewhere new is exactly what a snap is for.
                  if (item.weekday !== picked) haptic('snap')
                  setPicked(item.weekday)
                }}
                aria-pressed={isPicked}
                className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-3 outline-none sm:py-1.5 transition-[background-color,scale] duration-150 ease-out active:scale-[0.96] ${
                  isPicked ? '' : 'hover:bg-ink/6'
                }`}
              >
                {/* **The chosen day is one fill that moves**, not seven that take
                    turns being coloured — `layoutId` is what makes Motion read
                    the cell you left and the one you picked as the same object.
                    A spring rather than a duration: Monday to Sunday and Monday
                    to Tuesday are the same gesture at very different distances,
                    and one fixed time cannot be right for both. */}
                {isPicked && (
                  <m.span
                    layoutId={weekMarker}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-lg bg-surface-chip"
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 520, damping: 42 }
                    }
                  />
                )}
                {/* Above the fill: an absolutely positioned sibling paints over
                    static content whatever the DOM order says. */}
                <span
                  className={`relative z-10 text-[11px] font-medium ${
                    isPicked ? 'text-ink' : 'text-muted'
                  }`}
                >
                  {labels[item.weekday]}
                </span>
                {/* **A mark, not the hours.** Two times will not fit in a
                    forty-five-pixel cell at a size anybody can read, and they are
                    not the question this row answers — it says which days are
                    worked, and the editor underneath says when. */}
                <span
                  aria-hidden="true"
                  className={`relative z-10 h-1.5 w-1.5 rounded-full ${
                    closed
                      ? 'bg-transparent ring-1 ring-line-strong'
                      : item.is24h
                        ? 'bg-now'
                        : 'bg-ink'
                  }`}
                />
              </button>
            )
          })}
        </div>

        {/* The day that was pressed. One set of controls rather than seven.
            Always visible — it is how the day *reads* as well as how it is set —
            and only pressable while the card is being edited. */}
        <div
          role="group"
          aria-label={t('assistant.hours')}
          className="mt-4 flex items-center gap-0.5 rounded-full bg-ink/6 p-0.5"
        >
          {STATES.map((item) => {
            const isOn = item.id === stateOf(day)

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!isOn) haptic('snap')
                  edit(
                    item.id === 'allDay'
                      ? { is24h: true, ...blank }
                      : item.id === 'closed'
                        ? { is24h: false, ...blank }
                        : // Coming back to working: keep whatever hours the day
                          // had, and fall back to a plausible pair only when it
                          // has none — a day being reopened has usually just been
                          // closed by mistake.
                          {
                            is24h: false,
                            from: day.from || '10:00',
                            to: day.to || '20:00',
                          },
                  )
                }}
                aria-pressed={isOn}
                disabled={!editing}
                className={`relative grid h-9 min-w-0 flex-1 place-items-center truncate rounded-full px-2 text-[12px] font-medium outline-none sm:h-7 transition-[color,scale] duration-150 ease-out ${
                  editing ? 'active:scale-[0.96]' : ''
                } ${
                  isOn
                    ? 'text-ink'
                    : `text-muted ${
                        editing
                          ? 'hover:text-ink focus-visible:text-ink'
                          : 'cursor-default'
                      }`
                }`}
              >
                {/* The pill lifts and slides, the way a segmented control has
                    always shown its choice — the same moving fill as the week
                    strip above, so one card does not have two ways of saying
                    "this one". */}
                {isOn && (
                  <m.span
                    layoutId={stateMarker}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-surface-chip"
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 520, damping: 42 }
                    }
                  />
                )}
                <span className="relative z-10 truncate">{t(item.labelKey)}</span>
              </button>
            )
          })}
        </div>
      </LazyMotion>

      {/* **Both rows are the same three cells**, so the four fields come out
          identical: a label of its own width, then the pair. The break's ✕
          hangs off the end rather than sitting between them, which is what used
          to squeeze its two fields narrower than the day's.

          The label is what the numbers are *of* — «10:00 — 21:00» on its own
          says a span and not which span, and this card holds two of them. */}
      {/* **Closing a day takes its hours away, so they leave the way they
          arrived.** Pressing «Выходной» removed two rows of fields on one
          frame and the card jumped up by their height; pressing «Работает»
          put them back the same way. It is the clearest cause-and-effect on
          this card — a press, and the thing the press is about — so it is
          worth the only motion here that changes a height. */}
      <Reveal open={stateOf(day) === 'working'}>
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
              {t('assistant.workingTime')}
            </span>
            <TimeField
              compact
              readOnly={!editing}
              value={day.from}
              onChange={(value) => edit({ from: value })}
              label={t('appointments.start')}
            />
            <span aria-hidden="true" className="text-[12px] text-muted">
              —
            </span>
            <TimeField
              compact
              readOnly={!editing}
              value={day.to}
              onChange={(value) => edit({ to: value })}
              label={t('appointments.end')}
            />
          </div>

          {/* The break, and only for a day that has hours to interrupt —
              nothing can break a closed day or one that never closes, which is
              also what the server drops. */}
          {day.breakFrom || day.breakTo ? (
            <div className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
                {t('assistant.break')}
              </span>
              {/* **Between the label and the fields**, which is the only slot
                  that leaves both ends alone: at the head it pushed the labels
                  off the left edge, at the tail it held the fields off the
                  right one. It lives in the gap the label's `flex-1` was
                  absorbing anyway.

                  **Kept mounted and faded rather than mounted and unmounted**,
                  for that same reason: the space is already spare, so nothing
                  moves when it arrives, and a control that grows into place is
                  one the eye has found by the time it can be pressed. */}
              <button
                type="button"
                onClick={() => edit({ breakFrom: '', breakTo: '' })}
                disabled={!editing}
                aria-hidden={!editing}
                aria-label={t('assistant.breakRemove')}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-danger outline-none sm:h-5 sm:w-5 transition-[opacity,background-color,scale] duration-200 ease-out hover:bg-danger/10 focus-visible:bg-danger/10 active:scale-[0.9] ${
                  editing ? 'opacity-100' : 'pointer-events-none scale-75 opacity-0'
                }`}
              >
                {/* The same red minus the price list removes a row with — one
                    vocabulary for "take this out" across the page. */}
                <HugeiconsIcon
                  icon={MinusSignCircleIcon}
                  size={15}
                  strokeWidth={2}
                />
              </button>
              <TimeField
                compact
                readOnly={!editing}
                value={day.breakFrom}
                onChange={(value) => edit({ breakFrom: value })}
                label={t('appointments.start')}
              />
              <span aria-hidden="true" className="text-[12px] text-muted">
                —
              </span>
              <TimeField
                compact
                readOnly={!editing}
                value={day.breakTo}
                onChange={(value) => edit({ breakTo: value })}
                label={t('appointments.end')}
              />

            </div>
          ) : editing ? (
            <button
              type="button"
              onClick={() => edit({ breakFrom: '13:00', breakTo: '14:00' })}
              className="-my-2 self-end py-2 text-[14px] font-medium text-ink outline-none transition-[opacity,scale] sm:my-0 sm:py-0 duration-150 ease-out hover:opacity-70 focus-visible:opacity-70 active:scale-[0.97]"
            >
              {t('assistant.breakAdd')}
            </button>
          ) : null}
        </div>
      </Reveal>

      {/* The first unreadable day, said in words rather than as a 422 naming a
          weekday number. Save is held until it is fixed. */}
      {problem && <p className="mt-3 text-[13px] text-danger">{problem}</p>}

    </form>
  )
}
