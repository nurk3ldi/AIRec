const SHORT_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const GRID_HEIGHT = 300
const formatHour = (hour) => `${String(hour).padStart(2, '0')}:00`

/**
 * The week as a calendar rather than a list of rows: opening hours are a shape
 * — you see at a glance that Sunday is missing and that the weekend starts an
 * hour later — which a column of "10:00 — 21:00" strings never shows.
 *
 * The visible range is derived from the schedule itself with an hour of padding,
 * so a business that opens at 07:00 doesn't get a band of empty night at the top.
 */
export default function WorkingHoursCalendar({ schedule }) {
  const openDays = schedule.filter((day) => day.from !== null)
  const start = Math.max(0, Math.min(...openDays.map((day) => day.from)) - 1)
  const end = Math.min(24, Math.max(...openDays.map((day) => day.to)) + 1)
  const span = end - start
  const longest = Math.max(...openDays.map((day) => day.to - day.from))

  // Every other hour, so the labels never collide at this height.
  const ticks = []
  for (let hour = start; hour <= end; hour += 2) ticks.push(hour)

  const offsetOf = (hour) => ((hour - start) / span) * 100

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[620px]">
        <div className="flex gap-3">
          <div className="w-11 shrink-0" />
          <div className="grid flex-1 grid-cols-7 gap-2">
            {SHORT_DAYS.map((day) => (
              <span
                key={day}
                className="text-center text-[11px] font-medium uppercase tracking-wide text-[#999999]"
              >
                {day}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex gap-3">
          <div className="relative w-11 shrink-0" style={{ height: GRID_HEIGHT }}>
            {ticks.map((hour) => (
              <span
                key={hour}
                className="absolute right-0 -translate-y-1/2 text-[11px] text-[#999999]"
                style={{ top: `${offsetOf(hour)}%` }}
              >
                {formatHour(hour)}
              </span>
            ))}
          </div>

          <div className="relative flex-1" style={{ height: GRID_HEIGHT }}>
            {/* Hairlines only, no box around the grid — the chart carries no
                chrome beyond what it takes to read a time off it. */}
            {ticks.map((hour) => (
              <span
                key={hour}
                className="absolute inset-x-0 border-t border-[#999999]/15"
                style={{ top: `${offsetOf(hour)}%` }}
              />
            ))}

            <div className="grid h-full grid-cols-7 gap-2">
              {schedule.map((day) => {
                if (day.from === null) {
                  return (
                    <div key={day.day} className="grid place-items-center">
                      <span className="text-[12px] text-[#999999]">Выходной</span>
                    </div>
                  )
                }

                const isLongest = day.to - day.from === longest

                return (
                  <div key={day.day} className="relative">
                    <div
                      className={`absolute inset-x-0 flex flex-col justify-between rounded-lg px-2 py-1.5 ${
                        isLongest
                          ? 'bg-[#3248F2] text-white'
                          : 'bg-[#3248F2]/12 text-[#3248F2]'
                      }`}
                      style={{
                        top: `${offsetOf(day.from)}%`,
                        height: `${((day.to - day.from) / span) * 100}%`,
                      }}
                    >
                      <span className="text-[11px] font-medium">
                        {formatHour(day.from)}
                      </span>
                      <span className="text-[11px] font-medium">
                        {formatHour(day.to)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
