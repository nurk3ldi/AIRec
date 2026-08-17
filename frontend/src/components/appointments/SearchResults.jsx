import BookingRow from './BookingRow'
import { MONTHS_ABBR } from '../../lib/dates'

/**
 * Every visit by whoever was searched for.
 *
 * It takes the side column's place while a query is being typed, rather than
 * dropping out of the search field as a menu: a popover would cover the
 * calendar, which is the thing you are searching in order to look at. The
 * column is also tall, so the answer is a list you can read rather than eight
 * rows and a scrollbar.
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
    <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#999999]/15 px-6 py-5">
      <p className="text-[11px] font-medium tracking-wide text-[#999999] uppercase">
        Поиск
      </p>

      {loading ? (
        <p className="mt-2 text-[14px] text-[#999999]">Ищем…</p>
      ) : results.length === 0 ? (
        <p className="mt-2 text-[14px] break-words text-[#999999]">
          По запросу «{query}» ничего не найдено.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[14px] text-[#171215]">
            Найдено {results.length}
          </p>

          {upcoming.length > 0 && (
            <>
              <p className="mt-4 mb-1 text-[12px] font-medium text-[#171215]">
                Предстоящие
              </p>
              <ul>
                {upcoming.map((block) => (
                  <li key={block.id}>
                    <BookingRow
                      block={block}
                      date={label(block)}
                      onSelect={onSelect}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}

          {past.length > 0 && (
            <>
              <p className="mt-4 mb-1 text-[12px] font-medium text-[#171215]">
                Прошедшие
              </p>
              <ul>
                {past.map((block) => (
                  <li key={block.id}>
                    <BookingRow
                      block={block}
                      date={label(block)}
                      onSelect={onSelect}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
