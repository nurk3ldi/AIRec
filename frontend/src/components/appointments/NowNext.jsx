import { useEffect, useState } from 'react'
import { MONTHS_ABBR } from '../../lib/dates'

/**
 * Who is in the chair, and who is coming after them.
 *
 * The calendar answers "what does the week look like"; this answers "what is
 * happening", which is the question the owner actually has open all day. It
 * lives beside the grid rather than in it because the answer must not move when
 * the calendar is scrolled to next Thursday — looking ahead is exactly when you
 * still want to know that someone is waiting now.
 *
 * The bookings it reads come from their own request, for the same reason: they
 * are anchored to today, not to whatever range is on screen.
 *
 * Only bookings that are still going to happen count. A cancelled one is not
 * next, and one already marked completed or no-show is not "now" however its
 * hours read — the owner has already said what became of it.
 */
const LIVE = ['pending', 'confirmed']

const UPCOMING_SHOWN = 5

const humanGap = (minutes) => {
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

const dayLabel = (block, today, tomorrow) => {
  if (block.day === today) return null
  if (block.day === tomorrow) return 'Завтра'
  const [, month, date] = block.day.split('-').map(Number)
  return `${date} ${MONTHS_ABBR[month - 1]}`
}

const keyOf = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${String(date.getDate()).padStart(2, '0')}`
}

export default function NowNext({ blocks, onSelect }) {
  // Half a minute, matching the grid's own clock: this panel counts down in
  // whole minutes, so anything finer would re-render for nothing.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const live = (blocks ?? []).filter((block) => LIVE.includes(block.status))

  const current = live.find(
    (block) =>
      new Date(block.startsAt).getTime() <= now &&
      now < new Date(block.endsAt).getTime()
  )

  const upcoming = live
    .filter((block) => new Date(block.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, UPCOMING_SHOWN)

  const today = keyOf(new Date(now))
  const tomorrow = keyOf(new Date(now + 86_400_000))

  return (
    <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#999999]/15 px-6 py-5">
      <SectionLabel>Сейчас</SectionLabel>

      {current ? (
        // A lavender block rather than a solid accent one: this is the loudest
        // thing in the column and it is on screen all day, so it gets the tint
        // the rest of the product gives to data that matters, not the fill the
        // product reserves for a button you press.
        <button
          type="button"
          onClick={() => onSelect?.(current)}
          className="mt-2 block w-full rounded-xl bg-[#3248F2]/8 px-3.5 py-3 text-left outline-none transition-colors hover:bg-[#3248F2]/12"
        >
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3248F2]" />
            <span className="truncate text-[15px] font-semibold text-[#171215]">
              {current.client}
            </span>
          </span>
          <span className="mt-1 block truncate text-[13px] text-[#171215]">
            {current.from}–{current.to} · {current.service}
          </span>
          <span className="mt-0.5 block text-[12px] text-[#999999]">
            осталось{' '}
            {humanGap(
              Math.max(
                Math.round((new Date(current.endsAt).getTime() - now) / 60000),
                0
              )
            )}
          </span>
        </button>
      ) : (
        <p className="mt-2 text-[14px] text-[#999999]">Сейчас никого нет.</p>
      )}

      <SectionLabel className="mt-6">Дальше</SectionLabel>

      {upcoming.length === 0 ? (
        <p className="mt-2 text-[14px] text-[#999999]">Ближайших записей нет.</p>
      ) : (
        <ul className="mt-1">
          {upcoming.map((block, index) => {
            // Named only when the day turns over — today is left unlabelled
            // and a run on the same date reads as one list rather than
            // repeating itself.
            const label = dayLabel(block, today, tomorrow)
            const previous =
              index === 0 ? undefined : dayLabel(upcoming[index - 1], today, tomorrow)

            return (
              <li key={block.id}>
                {label !== null && label !== previous && (
                  <p className="mt-3 mb-1 text-[12px] font-medium text-[#171215]">
                    {label}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => onSelect?.(block)}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-[#F6F8FA]"
                >
                  <span className="w-[42px] shrink-0 pt-px text-[13px] text-[#999999] tabular-nums">
                    {block.from}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[#171215]">
                      {block.client}
                    </span>
                    <span className="block truncate text-[12px] text-[#999999]">
                      {block.service}
                    </span>
                  </span>
                  {/* Only while it is close enough to be worth watching. "через
                      6 ч" beside a booking tomorrow afternoon is arithmetic
                      nobody asked for. */}
                  {new Date(block.startsAt).getTime() - now < 3 * 3600_000 && (
                    <span className="shrink-0 pt-px text-[12px] text-[#999999]">
                      через{' '}
                      {humanGap(
                        Math.round(
                          (new Date(block.startsAt).getTime() - now) / 60000
                        )
                      )}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SectionLabel({ children, className = '' }) {
  return (
    <p
      className={`text-[11px] font-medium tracking-wide text-[#999999] uppercase ${className}`}
    >
      {children}
    </p>
  )
}
