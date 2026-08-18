import BookingRow from './BookingRow'
import { MONTHS_ABBR } from '../../lib/dates'

/**
 * Every visit by whoever was searched for, hanging under the search field.
 *
 * Attached to the field rather than shown in the side column: the results are
 * the field's answer, and an answer that appears in the far corner of the
 * screen from the question has to be *found* before it can be read. It floats,
 * so unlike a card it carries a shadow.
 *
 * The results are split in two and sorted away from now in both directions.
 * "Когда придёт Айгуль" and "когда она была в прошлый раз" are the two
 * questions a name is ever typed to answer, and one list ordered one way can
 * only put one of them at the top.
 *
 * The search itself deliberately carries no date range — the server drops it
 * when a query arrives alone — because looking for a client means looking for
 * every visit they ever made, not the ones that happen to be on screen.
 */
export default function SearchResults({ query, results, loading, onSelect }) {
  const now = Date.now()
  const thisYear = new Date(now).getFullYear()

  const at = (block) => new Date(block.startsAt).getTime()

  const upcoming = results
    .filter((block) => at(block) >= now)
    .sort((a, b) => at(a) - at(b))
  const past = results
    .filter((block) => at(block) < now)
    .sort((a, b) => at(b) - at(a))

  const label = (block) => {
    const [year, month, day] = block.day.split('-').map(Number)
    const short = `${day} ${MONTHS_ABBR[month - 1]}`
    // The year only when it isn't this one — on a list that reaches back
    // through the whole history, that is what marks where last year began.
    return year === thisYear ? short : `${short} ${year}`
  }

  return (
    <div
      role="listbox"
      aria-label="Результаты поиска"
      // Capped at roughly six rows: past that it is a list to scroll rather
      // than a menu to pick from, and it would cover the calendar it is
      // supposed to be pointing into.
      // Hung from the field's *right* edge, not its left. The field sits at the
      // right end of the calendar's header, and a 340px list opening rightwards
      // would run past the column into the day panel — where the card's
      // `overflow-hidden` would cut it off rather than let it float.
      className="absolute top-full right-0 z-30 mt-2 max-h-[360px] w-[340px] overflow-y-auto rounded-xl border border-[#999999]/25 bg-white p-2 shadow-[0_16px_40px_-8px_rgba(23,18,21,0.28)]"
    >
      {loading ? (
        <p className="px-2 py-2 text-[14px] text-[#999999]">Ищем…</p>
      ) : results.length === 0 ? (
        <p className="px-2 py-2 text-[14px] break-words text-[#999999]">
          По запросу «{query}» ничего не найдено.
        </p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <Group>Предстоящие</Group>
              {upcoming.map((block) => (
                <BookingRow
                  key={block.id}
                  block={block}
                  date={label(block)}
                  onSelect={onSelect}
                />
              ))}
            </>
          )}

          {past.length > 0 && (
            <>
              <Group className={upcoming.length > 0 ? 'mt-2' : ''}>
                Прошедшие
              </Group>
              {past.map((block) => (
                <BookingRow
                  key={block.id}
                  block={block}
                  date={label(block)}
                  onSelect={onSelect}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}

function Group({ children, className = '' }) {
  return (
    <p
      className={`px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-[#999999] uppercase ${className}`}
    >
      {children}
    </p>
  )
}
