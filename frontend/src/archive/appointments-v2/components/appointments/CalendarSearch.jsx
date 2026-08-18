import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import SearchResults from './SearchResults'

/**
 * Finding a client, from the calendar's own header.
 *
 * Lifted out of version one's toolbar, where it worked exactly like this: a
 * magnifier that becomes a field, and results hanging off that field rather
 * than shown somewhere else on the page. An answer that appears in the far
 * corner of the screen from the question has to be *found* before it can be
 * read.
 *
 * The field takes the button's place rather than appearing beside it: a search
 * box that pushes the month and its arrows sideways every time it opens makes
 * the whole header move under the pointer.
 */
export default function CalendarSearch({
  query,
  onQueryChange,
  results,
  loading,
  onSelect,
  overlayOpen,
}) {
  const [open, setOpen] = useState(false)
  const field = useRef(null)
  const box = useRef(null)

  useEffect(() => {
    if (open) field.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    onQueryChange('')
  }

  // A press anywhere else puts the header back the way it was. Suspended while
  // a dialog is open: a booking opened from these results renders in a portal
  // outside this box, so every click inside it — including its own Close button
  // — would read as "outside" and take the results away underneath it.
  useEffect(() => {
    if (!open || overlayOpen) return

    const dismiss = (event) => {
      if (!box.current?.contains(event.target)) close()
    }
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, overlayOpen])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Поиск по клиенту"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#999999]/25 text-[#171215] transition-colors outline-none hover:bg-[#F6F8FA] focus-visible:ring-2 focus-visible:ring-[#3248F2]"
      >
        <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={2} />
      </button>
    )
  }

  return (
    <div ref={box} className="relative shrink-0">
      <div className="flex h-9 items-center gap-2 rounded-full border border-[#999999]/25 bg-white pr-1.5 pl-3.5">
        {/* No placeholder and no icon inside: the field only ever appears
            straight after its own magnifier was pressed, so what it is for is
            already established. `aria-label` still carries it for anyone who
            arrives without having seen that. */}
        <input
          ref={field}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && close()}
          aria-label="Поиск по клиенту"
          className="w-48 bg-transparent text-[14px] text-[#171215] outline-none"
        />
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть поиск"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#999999] transition-colors outline-none hover:bg-[#F6F8FA] hover:text-[#171215] focus-visible:ring-2 focus-visible:ring-[#3248F2]"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2.4} />
        </button>
      </div>

      {query.trim() && (
        <SearchResults
          query={query.trim()}
          results={results ?? []}
          loading={loading}
          // The list stays exactly as it was. Opening one result is rarely the
          // end of a search — checking a client's next three visits means
          // coming straight back to the row below.
          onSelect={onSelect}
        />
      )}
    </div>
  )
}
