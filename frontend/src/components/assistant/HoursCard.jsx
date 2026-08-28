import { useEffect, useState } from 'react'
import { saveWorkingHours } from '../../lib/api'
import { authed } from '../../lib/auth'
import { weekdayLabels } from '../../lib/dates'
import { dayProblem } from '../../lib/schedule'
import { useT } from '../../lib/i18n'
import TimeField from '../appointments/TimeField'

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

export default function HoursCard({ week, onSaved }) {
  const t = useT()
  const [days, setDays] = useState(() => weekOf(week))
  const [picked, setPicked] = useState(0)
  const [saving, setSaving] = useState(false)
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

  const save = async (event) => {
    event.preventDefault()
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
      onSaved?.()
    } catch {
      // Left as typed: a save that failed is one the owner still means to make.
    } finally {
      setSaving(false)
    }
  }

  if (!day) return null

  return (
    <form
      onSubmit={save}
      className="flex flex-col rounded-2xl bg-surface-raised p-4"
    >
      <h2 className="font-display text-[15px] font-semibold text-ink">
        {t('assistant.hours')}
      </h2>

      {/* The week itself. Seven equal cells, so the row is the same shape
          whatever the labels are in — `flex-1` rather than a fixed width, which
          would only be right for one language. */}
      <div className="mt-3 flex gap-1">
        {days.map((item) => {
          const closed = isClosed(item)
          const isPicked = item.weekday === picked

          return (
            <button
              key={item.weekday}
              type="button"
              onClick={() => setPicked(item.weekday)}
              aria-pressed={isPicked}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1.5 outline-none transition-colors ${
                isPicked ? 'bg-surface-chip' : 'hover:bg-ink/6'
              }`}
            >
              <span
                className={`text-[11px] font-medium ${
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
                className={`h-1.5 w-1.5 rounded-full ${
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

      {/* The day that was pressed. One set of controls rather than seven. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {day.is24h ? (
          <span className="flex-1 text-[14px] text-ink">
            {t('assistant.allDay')}
          </span>
        ) : isClosed(day) ? (
          <button
            type="button"
            onClick={() => edit({ from: '10:00', to: '20:00' })}
            aria-label={t('assistant.openDay')}
            className="flex-1 text-left text-[14px] text-muted outline-none transition-colors hover:text-ink focus-visible:text-ink"
          >
            {t('assistant.dayOff')}
          </button>
        ) : (
          <span className="flex flex-1 items-center gap-1.5">
            <TimeField
              value={day.from}
              onChange={(value) => edit({ from: value })}
              label={t('assistant.hours')}
            />
            <span aria-hidden="true" className="text-[13px] text-muted">
              —
            </span>
            <TimeField
              value={day.to}
              onChange={(value) => edit({ to: value })}
              label={t('assistant.hours')}
            />
          </span>
        )}

        {/* **Visible while it is off**, muted rather than appearing on hover:
            this is the only place in the product that offers a round-the-clock
            day, and a hover-only affordance would leave it undiscoverable. */}
        <button
          type="button"
          onClick={() => edit({ is24h: !day.is24h, ...blank })}
          aria-pressed={day.is24h}
          className={`h-7 shrink-0 rounded-full border px-2.5 text-[12px] font-medium outline-none transition-colors ${
            day.is24h
              ? 'border-transparent bg-surface-chip text-ink'
              : 'border-line text-muted hover:text-ink focus-visible:text-ink'
          }`}
        >
          {t('assistant.allDay')}
        </button>

        {!isClosed(day) && (
          <button
            type="button"
            onClick={() => edit({ is24h: false, ...blank })}
            className="h-7 shrink-0 rounded-full px-2.5 text-[12px] font-medium text-muted outline-none transition-colors hover:text-danger focus-visible:text-danger"
          >
            {t('assistant.dayOff')}
          </button>
        )}
      </div>

      {/* The break, and only for a day that has hours to interrupt — nothing
          can break a closed day or one that never closes, which is also what
          the server drops. */}
      {!day.is24h && !isClosed(day) && (
        <div className="mt-2 flex items-center gap-1.5">
          {day.breakFrom || day.breakTo ? (
            <>
              <span className="text-[12px] text-muted">
                {t('assistant.break')}
              </span>
              <TimeField
                value={day.breakFrom}
                onChange={(value) => edit({ breakFrom: value })}
                label={t('assistant.break')}
              />
              <span aria-hidden="true" className="text-[13px] text-muted">
                —
              </span>
              <TimeField
                value={day.breakTo}
                onChange={(value) => edit({ breakTo: value })}
                label={t('assistant.break')}
              />
              <button
                type="button"
                onClick={() => edit({ breakFrom: '', breakTo: '' })}
                aria-label={t('assistant.breakRemove')}
                className="h-7 shrink-0 rounded-full px-2 text-[12px] text-muted outline-none transition-colors hover:text-danger focus-visible:text-danger"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => edit({ breakFrom: '13:00', breakTo: '14:00' })}
              className="text-[12px] text-muted outline-none transition-colors hover:text-ink focus-visible:text-ink"
            >
              {t('assistant.breakAdd')}
            </button>
          )}
        </div>
      )}

      {/* The first unreadable day, said in words rather than as a 422 naming a
          weekday number. Save is held until it is fixed. */}
      {problem && <p className="mt-3 text-[13px] text-danger">{problem}</p>}

      {isDirty && (
        <button
          type="submit"
          disabled={saving || Boolean(problem)}
          className="mt-4 h-10 shrink-0 self-end rounded-full bg-accent px-5 text-[14px] font-medium text-surface outline-none transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t(saving ? 'assistant.saving' : 'assistant.save')}
        </button>
      )}
    </form>
  )
}
