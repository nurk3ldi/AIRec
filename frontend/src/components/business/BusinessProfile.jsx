import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons'
import Card, { CardAction } from './Card'
import WorkingHoursCalendar from './WorkingHoursCalendar'

// Placeholder content for the layout pass — replaced by the API once the
// Business model exists. Kept as numbers rather than pre-formatted strings so
// the counts above can be derived instead of typed in by hand and drifting.
const IDENTITY = {
  name: 'Barber House',
  meta: 'Барбершоп · Алматы · UTC+5',
}

// Nine, not seven: three columns divide evenly, so the last row isn't a stub
// with two empty cells and half-drawn dividers.
const FIELDS = [
  { label: 'Название', value: 'Barber House' },
  { label: 'Сфера', value: 'Барбершоп' },
  { label: 'Телефон', value: '+7 707 123 45 67' },
  { label: 'Город', value: 'Алматы' },
  { label: 'Адрес', value: 'ул. Достык, 132' },
  // Left empty on purpose: shows the unfilled state and gives the completion
  // bar above something real to report.
  { label: 'Ориентир', value: null },
  { label: 'Способы оплаты', value: 'Kaspi, наличные, карта' },
  { label: 'Языки обслуживания', value: 'Қазақша, Русский' },
  { label: 'Часовой пояс', value: 'UTC+5, Алматы' },
]

const SERVICES = [
  { name: 'Мужская стрижка', minutes: 45, price: 6000, active: true },
  { name: 'Стрижка бороды', minutes: 30, price: 4000, active: true },
  { name: 'Стрижка + борода', minutes: 75, price: 9000, active: true },
  { name: 'Детская стрижка', minutes: 30, price: 4500, active: true },
  { name: 'Бритьё опасной бритвой', minutes: 40, price: 5500, active: false },
]

const SCHEDULE = [
  { day: 'Понедельник', from: 10, to: 21 },
  { day: 'Вторник', from: 10, to: 21 },
  { day: 'Среда', from: 10, to: 21 },
  { day: 'Четверг', from: 10, to: 21 },
  { day: 'Пятница', from: 10, to: 22 },
  { day: 'Суббота', from: 11, to: 22 },
  { day: 'Воскресенье', from: null, to: null },
]

const formatPrice = (value) => `${value.toLocaleString('ru-RU')} ₸`

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} мин`
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

const initialsOf = (name) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()

/** Table column header: tiny, uppercase, muted — the row's frame is air. */
function ColumnLabel({ children, className = '' }) {
  return (
    <span
      className={`text-[11px] font-medium uppercase tracking-wide text-[#999999] ${className}`}
    >
      {children}
    </span>
  )
}

/**
 * A dot rather than a tinted pill, deliberately: almost every row in a price
 * list says the same thing, and five identical pills shout. The dot carries the
 * state and lets the exception — a hidden service — be the thing you notice.
 */
function StatusDot({ active }) {
  return (
    <span className="inline-flex items-center gap-2 text-[14px] text-[#999999]">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? 'bg-[#16A34A]' : 'bg-[#999999]'
        }`}
      />
      {active ? 'Активна' : 'Скрыта'}
    </span>
  )
}

/**
 * One fact about the business, editable in place.
 *
 * The pencil is hidden until the cell is hovered — nine permanent icons would
 * be nine competing targets — but it stays a real button, so it also appears on
 * keyboard focus and is reachable by Tab.
 */
function Field({ label, value }) {
  return (
    <div className="group relative border-r border-b border-[#999999]/15 px-6 py-5">
      <p className="text-[13px] text-[#999999]">{label}</p>

      {value ? (
        <p className="mt-1.5 pr-8 text-[16px] font-semibold text-[#171215]">{value}</p>
      ) : (
        <p className="mt-1.5 pr-8 text-[16px] font-medium text-[#999999]">Не указано</p>
      )}

      <button
        type="button"
        aria-label={`Изменить: ${label}`}
        className="absolute top-4 right-4 grid h-7 w-7 place-items-center rounded-lg text-[#999999] opacity-0 transition-all hover:bg-[#3248F2]/8 hover:text-[#3248F2] focus-visible:opacity-100 group-hover:opacity-100"
      >
        <HugeiconsIcon
          icon={PencilEdit02Icon}
          size={15}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </button>
    </div>
  )
}

export default function BusinessProfile() {
  const missing = FIELDS.filter((field) => !field.value)
  const percent = Math.round(((FIELDS.length - missing.length) / FIELDS.length) * 100)
  const activeCount = SERVICES.filter((service) => service.active).length

  return (
    <div className="flex flex-col gap-6">
      {/* Identity and completion in one card, split by a hairline: they answer
          two halves of the same question — who this business is, and how much
          of it the assistant actually knows. */}
      <Card className="!p-0">
        <div className="flex flex-wrap items-center gap-4 px-6 py-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#3248F2] font-display text-[18px] font-semibold text-white">
            {initialsOf(IDENTITY.name)}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[20px] font-semibold tracking-[-0.02em] text-[#171215]">
              {IDENTITY.name}
            </p>
            <p className="mt-0.5 truncate text-[14px] text-[#999999]">
              {IDENTITY.meta}
            </p>
          </div>

          <span className="inline-flex shrink-0 items-center gap-2 text-[13px] text-[#171215]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
            Ассистент активен
          </span>
        </div>

        <div className="border-t border-[#999999]/15 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-[#171215]">
              Профиль заполнен на{' '}
              <span className="font-semibold">{percent}%</span>
            </p>
            {missing.length > 0 && <CardAction>Заполнить</CardAction>}
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#3248F2]/10">
            <div
              className="h-full rounded-full bg-[#3248F2] transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          {missing.length > 0 && (
            <p className="mt-2.5 text-[13px] text-[#999999]">
              Ассистент пока не знает:{' '}
              <span className="text-[#171215]">
                {missing.map((field) => field.label.toLowerCase()).join(', ')}
              </span>
            </p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="px-6 pt-6 pb-5">
          <h2 className="text-[15px] font-semibold text-[#171215]">
            Профиль бизнеса
          </h2>
        </div>

        {/* The cells carry their own borders and the grid is pulled 1px past
            the clipping wrapper, so the outermost lines fall outside and the
            divider pattern comes out right at any column count. */}
        <div className="overflow-hidden border-t border-[#999999]/15">
          <div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((field) => (
              <Field key={field.label} label={field.label} value={field.value} />
            ))}
          </div>
        </div>
      </Card>

      <Card
        title="Услуги"
        action={
          <span className="flex items-center gap-4">
            <span className="text-[13px] text-[#999999]">
              {activeCount} активных
            </span>
            <CardAction>
              <span className="inline-flex items-center gap-1.5">
                <HugeiconsIcon
                  icon={Add01Icon}
                  size={15}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.2}
                />
                Добавить услугу
              </span>
            </CardAction>
          </span>
        }
      >
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-8">
          <ColumnLabel>Услуга</ColumnLabel>
          <ColumnLabel className="text-right">Длительность</ColumnLabel>
          <ColumnLabel className="text-right">Цена</ColumnLabel>
          <ColumnLabel className="text-right">Статус</ColumnLabel>

          {SERVICES.map((service) => (
            <div key={service.name} className="contents">
              <p className="mt-4 truncate text-[14px] text-[#171215]">
                {service.name}
              </p>
              <p className="mt-4 text-right text-[14px] text-[#999999]">
                {formatDuration(service.minutes)}
              </p>
              <p className="mt-4 text-right text-[14px] font-semibold text-[#171215]">
                {formatPrice(service.price)}
              </p>
              <p className="mt-4 text-right">
                <StatusDot active={service.active} />
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="График работы" action={<CardAction>Изменить</CardAction>}>
        <WorkingHoursCalendar schedule={SCHEDULE} />
      </Card>
    </div>
  )
}
