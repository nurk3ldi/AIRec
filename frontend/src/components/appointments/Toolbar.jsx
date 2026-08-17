import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import SearchResults from './SearchResults'
import {
  DAY_NAMES,
  MONTHS_OF,
  MONTHS_SHORT,
  shiftDate,
  weekStart,
} from '../../lib/dates'

const VIEWS = [
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
]

function title(date, view) {
  if (view === 'day') {
    return `${date.getDate()} ${MONTHS_OF[date.getMonth()]} ${date.getFullYear()}`
  }

  const first = weekStart(date)
  const last = new Date(first)
  last.setDate(last.getDate() + 6)

  // The month is named once when both ends share it — "24 – 30 августа", not
  // "24 августа – 30 августа".
  const from =
    first.getMonth() === last.getMonth()
      ? `${first.getDate()}`
      : `${first.getDate()} ${MONTHS_OF[first.getMonth()]}`
  return `${from} – ${last.getDate()} ${MONTHS_OF[last.getMonth()]} ${last.getFullYear()}`
}

function subtitle(date, view) {
  return view === 'day' ? DAY_NAMES[date.getDay()] : 'Неделя'
}

/**
 * The bar above the calendar: which day is open, how it's being looked at, and
 * the one action the page exists for.
 *
 * It is the top band of the calendar's card, cut off from the rest by a
 * hairline — not a card header. A card header is allowed one control beside its
 * title, and this row carries four; giving them their own band inside the same
 * card keeps that rule intact without spending a second card on chrome.
 */
export default function Toolbar({
  date,
  onDateChange,
  view,
  onViewChange,
  query,
  onQueryChange,
  results,
  searchLoading,
  onResultSelect,
  overlayOpen,
  onCreate,
}) {
  const [searching, setSearching] = useState(false)
  const searchRef = useRef(null)
  const searchBox = useRef(null)

  const shift = (direction) => onDateChange(shiftDate(date, view, direction))

  useEffect(() => {
    if (searching) searchRef.current?.focus()
  }, [searching])

  const closeSearch = () => {
    setSearching(false)
    onQueryChange('')
  }

  // A press anywhere else puts the toolbar back the way it was. Without it the
  // results would hang over the calendar until the ✕ was found, and the ✕ is
  // the last place anyone looks once they have what they came for.
  //
  // Suspended while a dialog is open, and that is the whole point of the flag:
  // a booking opened from these results renders in a portal outside this box,
  // so every click inside it — including its own Close button — would read as
  // "outside" and take the results away underneath it. Looking at one result is
  // usually the prelude to looking at the next.
  useEffect(() => {
    if (!searching || overlayOpen) return

    const dismiss = (event) => {
      if (!searchBox.current?.contains(event.target)) closeSearch()
    }
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, overlayOpen])

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Two stacked halves rather than a badge with text on it: the month is
          a label and the day is the value, and at 64px they need different
          weights to be read as such. The strip carries the accent — red was
          tried and dropped, since `#DC2626` already means an error here. */}
      <div className="flex h-16 w-16 shrink-0 flex-col overflow-hidden rounded-2xl border border-[#999999]/20 bg-white">
        <span className="bg-[#3248F2] py-1 text-center text-[11px] font-semibold tracking-wide text-white">
          {MONTHS_SHORT[date.getMonth()]}
        </span>
        <span className="grid flex-1 place-items-center font-display text-[22px] font-semibold tracking-[-0.02em] text-[#171215]">
          {date.getDate()}
        </span>
      </div>

      <div className="min-w-0">
        <p className="truncate font-display text-[20px] font-semibold tracking-[-0.02em] text-[#171215]">
          {title(date, view)}
        </p>
        <p className="mt-0.5 truncate text-[14px] text-[#999999]">
          {subtitle(date, view)}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* The field takes the button's place rather than appearing beside it:
            a search box that pushes three controls sideways every time it opens
            makes the whole bar move under the pointer. */}
        {searching ? (
          // `relative`, because the results hang off this box rather than off
          // the toolbar: they are the field's own answer and have to move with
          // it if the bar ever wraps.
          <div ref={searchBox} className="relative">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-[#999999]/25 bg-white pr-2 pl-3">
              {/* No placeholder and no icon inside: the field only ever appears
                  straight after its own magnifier was pressed, so what it is for
                  is already established — repeating it would be labelling the
                  answer to a question just asked. `aria-label` still carries it
                  for anyone who arrives without having seen that. */}
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => event.key === 'Escape' && closeSearch()}
                aria-label="Поиск по клиенту"
                className="w-56 bg-transparent text-[14px] text-[#171215] outline-none"
              />
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Закрыть поиск"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#999999] outline-none transition-colors hover:bg-[#F6F8FA] hover:text-[#171215]"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2.4} />
              </button>
            </div>

            {query.trim() && (
              <SearchResults
                query={query.trim()}
                results={results ?? []}
                loading={searchLoading}
                // The list stays exactly as it was. Opening one result is
                // rarely the end of a search — checking a client's next three
                // visits means coming straight back to the row below, and
                // closing the list would mean typing the name again for each
                // one.
                onSelect={onResultSelect}
              />
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearching(true)}
            aria-label="Поиск по клиенту"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#999999]/25 bg-white text-[#171215] outline-none transition-colors hover:bg-[#F6F8FA]"
          >
            <HugeiconsIcon icon={Search01Icon} size={18} strokeWidth={2} />
          </button>
        )}

        {/* One bordered group, not three buttons: stepping back, jumping to
            now and stepping forward are the same job, and spacing them apart
            would make them read as three unrelated controls. The outer border
            does that grouping on its own — dividers inside it would only chop
            the group back up. */}
        <div className="flex h-10 items-center rounded-xl border border-[#999999]/25 bg-white">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={view === 'week' ? 'Предыдущая неделя' : 'Предыдущий день'}
            className="grid h-full w-10 place-items-center rounded-l-xl text-[#171215] outline-none transition-colors hover:bg-[#F6F8FA]"
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              size={16}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.2}
            />
          </button>

          <button
            type="button"
            onClick={() => onDateChange(new Date())}
            className="h-full px-4 text-[14px] font-medium text-[#171215] outline-none transition-colors hover:bg-[#F6F8FA]"
          >
            Сегодня
          </button>

          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={view === 'week' ? 'Следующая неделя' : 'Следующий день'}
            className="grid h-full w-10 place-items-center rounded-r-xl text-[#171215] outline-none transition-colors hover:bg-[#F6F8FA]"
          >
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={16}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.2}
            />
          </button>
        </div>

        <ViewSwitch value={view} onChange={onViewChange} />

        {/* The accent, like every other primary action in the app — a page
            with its own button colour would read as a different product. */}
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#3248F2] px-4 text-[14px] font-medium text-white outline-none transition-colors hover:bg-[#2839c9] focus-visible:bg-[#2839c9]"
        >
          <HugeiconsIcon
            icon={Add01Icon}
            size={16}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.4}
          />
          Запись
        </button>
      </div>
    </div>
  )
}

/**
 * Both views, side by side, rather than a dropdown.
 *
 * With two options a menu costs a click to see what the other one even is, and
 * hides the current choice behind a chevron. Laid out flat, the switch says
 * what it does and what it will do next without being opened.
 *
 * The active pill carries the only shadow on this page. It is small enough to
 * read as "this control is raised" rather than as a floating layer, which is
 * what the shadow rule is there to protect — and without it a white pill on a
 * light grey track has almost nothing separating it.
 */
function ViewSwitch({ value, onChange }) {
  return (
    <div className="flex h-10 items-center gap-1 rounded-xl bg-[#999999]/15 p-1">
      {VIEWS.map((item) => {
        const active = item.id === value

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-pressed={active}
            className={`h-8 rounded-lg px-4 text-[14px] font-medium outline-none transition-colors ${
              active
                ? 'bg-white text-[#171215] shadow-[0_1px_2px_rgba(23,18,21,0.12)]'
                : 'text-[#999999] hover:text-[#171215]'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
