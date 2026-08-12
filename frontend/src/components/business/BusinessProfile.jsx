import Card, { CardAction } from './Card'

// Placeholder content for the layout pass — replaced by the API once the
// Business model exists.
const PROFILE = [
  { label: 'Название', value: 'Barber House' },
  { label: 'Сфера', value: 'Барбершоп' },
  { label: 'Город', value: 'Алматы' },
  { label: 'Часовой пояс', value: 'UTC+5, Алматы' },
]

const SERVICES = [
  { name: 'Мужская стрижка', duration: '45 мин', price: '6 000 ₸' },
  { name: 'Стрижка бороды', duration: '30 мин', price: '4 000 ₸' },
  { name: 'Стрижка + борода', duration: '1 ч 15 мин', price: '9 000 ₸' },
  { name: 'Детская стрижка', duration: '30 мин', price: '4 500 ₸' },
  { name: 'Бритьё опасной бритвой', duration: '40 мин', price: '5 500 ₸' },
]

const SCHEDULE = [
  { day: 'Понедельник', hours: '10:00 — 21:00' },
  { day: 'Вторник', hours: '10:00 — 21:00' },
  { day: 'Среда', hours: '10:00 — 21:00' },
  { day: 'Четверг', hours: '10:00 — 21:00' },
  { day: 'Пятница', hours: '10:00 — 22:00' },
  { day: 'Суббота', hours: '11:00 — 22:00' },
  { day: 'Воскресенье', hours: null },
]

const STAFF = [
  { name: 'Ерлан Сериков', role: 'Барбер', services: 'Все услуги' },
  { name: 'Данияр Абдуллин', role: 'Барбер', services: 'Стрижки, борода' },
  { name: 'Айгерим Сапарова', role: 'Барбер', services: 'Детские стрижки' },
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

export default function BusinessProfile() {
  return (
    <div className="flex flex-col gap-6">
      {/* The signature move of this style: four related facts in ONE card,
          split by hairlines into a 2×2 — not four separate cards. */}
      <Card title="Профиль бизнеса" action={<CardAction>Изменить</CardAction>}>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {PROFILE.map((item, index) => (
            <div
              key={item.label}
              className={`py-4 sm:py-5 ${
                index % 2 === 1 ? 'sm:pl-6' : 'sm:pr-6'
              } ${index % 2 === 0 ? 'sm:border-r sm:border-[#999999]/15' : ''} ${
                index < 2 ? 'border-b border-[#999999]/15' : ''
              }`}
            >
              <p className="text-[14px] text-[#999999]">{item.label}</p>
              <p className="mt-1 text-[17px] font-semibold text-[#171215]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Услуги"
        action={<CardAction>Добавить услугу</CardAction>}
      >
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6">
          <ColumnLabel>Услуга</ColumnLabel>
          <ColumnLabel>Длительность</ColumnLabel>
          <ColumnLabel className="text-right">Цена</ColumnLabel>

          {SERVICES.map((service) => (
            <div key={service.name} className="contents">
              <p className="mt-4 truncate text-[14px] text-[#171215]">
                {service.name}
              </p>
              <p className="mt-4 text-[14px] text-[#999999]">{service.duration}</p>
              <p className="mt-4 text-right text-[14px] font-semibold text-[#171215]">
                {service.price}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="График работы" action={<CardAction>Изменить</CardAction>}>
          <div className="flex flex-col">
            {SCHEDULE.map((item, index) => (
              <div
                key={item.day}
                className={`flex items-center justify-between py-3 ${
                  index > 0 ? 'border-t border-[#999999]/15' : ''
                }`}
              >
                <span className="text-[14px] text-[#171215]">{item.day}</span>
                {item.hours ? (
                  <span className="text-[14px] text-[#171215]">{item.hours}</span>
                ) : (
                  <span className="text-[14px] text-[#999999]">Выходной</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Сотрудники" action={<CardAction>Добавить</CardAction>}>
          <div className="flex flex-col">
            {STAFF.map((person, index) => (
              <div
                key={person.name}
                className={`flex items-center gap-3 py-3 ${
                  index > 0 ? 'border-t border-[#999999]/15' : ''
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#3248F2]/10 text-[13px] font-semibold text-[#3248F2]">
                  {person.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-[#171215]">{person.name}</p>
                  <p className="truncate text-[13px] text-[#999999]">
                    {person.role} · {person.services}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
