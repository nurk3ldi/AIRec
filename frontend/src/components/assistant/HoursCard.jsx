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
 * **Always seven rows.** A missing day and a closed day have to read
 * differently, so the backend creates the week on first read and this edits
 * what it hands back rather than building a list of its own.
 *
 * **Round the clock is a flag, not `00:00–00:00`.** `is_24h` leaves both times
 * null, and setting it clears the break with them — nothing can interrupt a day
 * that never closes. Written per day rather than as a whole-week switch,
 * because the per-day mark is the primitive and "24/7" is just all seven of
 * them set.
 *
 * **A day is checked here before it is sent.** `dayProblem` in `lib/schedule.js`
 * mirrors the rules the server enforces — a close at or before the open, half a
 * break, a break outside the day — because a 422 arriving after Save names a
 * weekday *number* while the owner is looking at a row. It is one function so
 * the two cannot drift; the server is still the authority.
 *
 * **A close before an open is an error, not an overnight day.** The two columns
 * cannot express "the next day", so reading it that way would turn a typo into
 * a twenty-two-hour day. A bar open till two sets `is_24h` or waits for the
 * overnight flag that does not exist yet.
 */

/** What one row of the form holds. `dayProblem` takes exactly this shape. */
const rowOf = (day) => ({
  weekday: day.weekday,
  is24h: Boolean(day.is_24h),
  from: day.opens_at ?? '',
  to: day.closes_at ?? '',
  breakFrom: day.break_starts_at ?? '',
  breakTo: day.break_ends_at ?? '',
})

const rowsOf = (week) =>
  [...(week ?? [])].sort((a, b) => a.weekday - b.weekday).map(rowOf)

/** Closed: no times at all, and not round the clock either. */
const isClosed = (row) => !row.is24h && !row.from && !row.to

export default function HoursCard({ week, onSaved }) {
  const t = useT()
  const [rows, setRows] = useState(() => rowsOf(week))
  const [saving, setSaving] = useState(false)
  const labels = weekdayLabels()

  useEffect(() => {
    setRows(rowsOf(week))
  }, [week])

  const edit = (weekday, changes) =>
    setRows((was) =>
      was.map((row) => (row.weekday === weekday ? { ...row, ...changes } : row)),
    )

  const toggle24h = (row) =>
    // Setting it clears everything it makes meaningless, so the two can never
    // be read disagreeing with each other — the same thing the server does.
    edit(row.weekday, {
      is24h: !row.is24h,
      from: '',
      to: '',
      breakFrom: '',
      breakTo: '',
    })

  const close = (row) =>
    edit(row.weekday, {
      is24h: false,
      from: '',
      to: '',
      breakFrom: '',
      breakTo: '',
    })

  const open = (row) => edit(row.weekday, { from: '10:00', to: '20:00' })

  const isDirty = JSON.stringify(rows) !== JSON.stringify(rowsOf(week))
  // The first row that cannot be read as opening hours. One message at a time:
  // seven of them at once is a wall, and the first is the one to fix.
  const problem = rows.map((row) => dayProblem(row)).find(Boolean) ?? null

  const save = async (event) => {
    event.preventDefault()
    if (!isDirty || saving || problem) return

    setSaving(true)
    try {
      await authed((token) =>
        saveWorkingHours(
          token,
          rows.map((row) => ({
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

  return (
    <form
      onSubmit={save}
      className="flex flex-col self-start rounded-2xl border border-line bg-surface p-6"
    >
      <h2 className="shrink-0 font-display text-[15px] font-semibold text-ink">
        {t('assistant.hours')}
      </h2>

      <ul className="mt-4 divide-y divide-line">
        {rows.map((row) => (
          <li
            key={row.weekday}
            className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-2"
          >
            {/* A fixed column for the name, so seven rows line up rather than
                each starting where its own label happens to end. */}
            <span className="w-8 shrink-0 text-[13px] font-medium text-muted">
              {labels[row.weekday]}
            </span>

            {row.is24h ? (
              <span className="flex-1 text-[14px] text-ink">
                {t('assistant.allDay')}
              </span>
            ) : isClosed(row) ? (
              <button
                type="button"
                onClick={() => open(row)}
                className="flex-1 text-left text-[14px] text-muted outline-none transition-colors hover:text-ink focus-visible:text-ink"
                aria-label={t('assistant.openDay')}
              >
                {t('assistant.dayOff')}
              </button>
            ) : (
              <span className="flex flex-1 items-center gap-1.5">
                <TimeField
                  value={row.from}
                  onChange={(value) => edit(row.weekday, { from: value })}
                  label={t('assistant.hours')}
                />
                <span aria-hidden="true" className="text-[13px] text-muted">
                  —
                </span>
                <TimeField
                  value={row.to}
                  onChange={(value) => edit(row.weekday, { to: value })}
                  label={t('assistant.hours')}
                />
              </span>
            )}

            {/* **The chip stays visible while it is off**, muted rather than
                appearing on hover: this is the only place in the product that
                offers a round-the-clock day, and a hover-only affordance would
                leave the feature undiscoverable. */}
            <button
              type="button"
              onClick={() => toggle24h(row)}
              aria-pressed={row.is24h}
              className={`h-7 shrink-0 rounded-full border px-2.5 text-[12px] font-medium outline-none transition-colors ${
                row.is24h
                  ? 'border-transparent bg-surface-chip text-ink'
                  : 'border-line text-muted hover:text-ink focus-visible:text-ink'
              }`}
            >
              {t('assistant.allDay')}
            </button>

            {!isClosed(row) && (
              <button
                type="button"
                onClick={() => close(row)}
                className="h-7 shrink-0 rounded-full px-2.5 text-[12px] font-medium text-muted outline-none transition-colors hover:text-danger focus-visible:text-danger"
              >
                {t('assistant.dayOff')}
              </button>
            )}

            {/* The break is a second line and only for a day that has hours to
                interrupt — nothing can break a closed day or one that never
                closes, which is also what the server drops. */}
            {!row.is24h && !isClosed(row) && (
              <span className="flex w-full items-center gap-1.5 pl-10">
                {row.breakFrom || row.breakTo ? (
                  <>
                    <span className="text-[12px] text-muted">
                      {t('assistant.break')}
                    </span>
                    <TimeField
                      value={row.breakFrom}
                      onChange={(value) =>
                        edit(row.weekday, { breakFrom: value })
                      }
                      label={t('assistant.break')}
                    />
                    <span aria-hidden="true" className="text-[13px] text-muted">
                      —
                    </span>
                    <TimeField
                      value={row.breakTo}
                      onChange={(value) => edit(row.weekday, { breakTo: value })}
                      label={t('assistant.break')}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        edit(row.weekday, { breakFrom: '', breakTo: '' })
                      }
                      aria-label={t('assistant.breakRemove')}
                      className="h-7 rounded-full px-2 text-[12px] text-muted outline-none transition-colors hover:text-danger focus-visible:text-danger"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      edit(row.weekday, {
                        breakFrom: '13:00',
                        breakTo: '14:00',
                      })
                    }
                    className="text-[12px] text-muted outline-none transition-colors hover:text-ink focus-visible:text-ink"
                  >
                    {t('assistant.breakAdd')}
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* The first unreadable day, said in words rather than as a 422 naming a
          weekday number. Save is held until it is fixed. */}
      {problem && (
        <p className="mt-4 shrink-0 text-[13px] text-danger">{problem}</p>
      )}

      {isDirty && (
        <button
          type="submit"
          disabled={saving || Boolean(problem)}
          className="mt-6 h-10 shrink-0 self-end rounded-full bg-accent px-5 text-[14px] font-medium text-surface outline-none transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t(saving ? 'assistant.saving' : 'assistant.save')}
        </button>
      )}
    </form>
  )
}
