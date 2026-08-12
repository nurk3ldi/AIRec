import { HugeiconsIcon } from '@hugeicons/react'
import { Store01Icon } from '@hugeicons/core-free-icons'
import Card, { CardAction } from './Card'
import WorkingHoursCalendar from './WorkingHoursCalendar'

// Placeholder content for the layout pass — replaced by the API once the
// Business model exists. Kept as numbers rather than pre-formatted strings so
// the summary above can be derived instead of typed in by hand and drifting.
const BUSINESS = {
  name: 'Barber House',
  industry: 'Барбершоп',
  city: 'Алматы',
  timezone: 'UTC+5',
}

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


const activeServices = SERVICES.filter((service) => service.active)
const openDays = SCHEDULE.filter((day) => day.from !== null)
const weeklyHours = openDays.reduce((total, day) => total + (day.to - day.from), 0)

const average = (values) =>
  Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)

// Everything here is derived from the two lists below it, so the numbers can
// never contradict what the page itself shows.
const SUMMARY = [
  { label: 'Услуг в прайсе', value: String(activeServices.length) },
  {
    label: 'Средний чек',
    value: formatPrice(average(activeServices.map((s) => s.price))),
  },
  {
    label: 'Средняя длительность',
    value: formatDuration(average(activeServices.map((s) => s.minutes))),
  },
  { label: 'Часов в неделю', value: `${weeklyHours} ч` },
]

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

function StatusPill({ active }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-[12px] font-medium ${
        active
          ? 'bg-[#16A34A]/10 text-[#16A34A]'
          : 'bg-[#999999]/15 text-[#999999]'
      }`}
    >
      {active ? 'Активна' : 'Скрыта'}
    </span>
  )
}

export default function BusinessProfile() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#3248F2] text-white">
          <HugeiconsIcon
            icon={Store01Icon}
            size={24}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.9}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[22px] font-semibold tracking-[-0.02em] text-[#171215]">
            {BUSINESS.name}
          </p>
          <p className="mt-0.5 truncate text-[14px] text-[#999999]">
            {BUSINESS.industry} · {BUSINESS.city} · {BUSINESS.timezone}
          </p>
        </div>

        <CardAction>Изменить</CardAction>
      </Card>

      {/* The signature move of this style: related numbers in ONE card split by
          hairlines, not one card each. */}
      <Card className="!p-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {SUMMARY.map((item, index) => (
            <div
              key={item.label}
              className={`border-[#999999]/15 px-6 py-5 ${
                index < 3 ? 'border-b' : ''
              } ${index === 2 ? 'sm:border-b-0' : ''} ${
                index < 2 ? 'xl:border-b-0' : ''
              } ${index === 0 || index === 2 ? 'sm:border-r' : ''} ${
                index === 1 ? 'xl:border-r' : ''
              }`}
            >
              <p className="text-[14px] text-[#999999]">{item.label}</p>
              <p className="mt-1.5 text-[28px] font-bold tracking-[-0.02em] text-[#171215]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Услуги" action={<CardAction>Добавить услугу</CardAction>}>
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-6">
          <ColumnLabel>Услуга</ColumnLabel>
          <ColumnLabel>Длительность</ColumnLabel>
          <ColumnLabel className="text-right">Цена</ColumnLabel>
          <ColumnLabel className="text-right">Статус</ColumnLabel>

          {SERVICES.map((service) => (
            <div key={service.name} className="contents">
              <p className="mt-4 truncate text-[14px] text-[#171215]">
                {service.name}
              </p>
              <p className="mt-4 text-[14px] text-[#999999]">
                {formatDuration(service.minutes)}
              </p>
              <p className="mt-4 text-right text-[14px] font-semibold text-[#171215]">
                {formatPrice(service.price)}
              </p>
              <p className="mt-4 text-right">
                <StatusPill active={service.active} />
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
