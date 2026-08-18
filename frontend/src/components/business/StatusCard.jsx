import { weekMinutes } from '../../lib/schedule'
import Card from './Card'

/**
 * The state of the business as four numbers.
 *
 * This card exists because the page had none. Every other card on «Бизнес» is
 * a form, and a screen whose largest text is a 20px heading has nothing for the
 * eye to land on — which is most of what made it read as a settings panel
 * rather than as part of the product. The reference dashboard's most
 * characteristic move is four related figures in *one* card split by hairlines,
 * and these four are genuinely one subject: whether the assistant has enough to
 * work with.
 *
 * Nothing here is fetched. Each figure is derived from data the page already
 * holds, so the card cannot disagree with the cards below it, and adding it
 * cost no requests.
 *
 * There are no coloured `+12%` deltas, unlike the reference. Nothing on this
 * page has history to compare against yet, and a percentage invented to fill
 * the slot would be the one number on the screen that lies. The third line is
 * plain context instead — the same shape, without the claim.
 */
export default function StatusCard({ business, services, schedule, className = '' }) {
  const active = services.filter((service) => service.active)
  // Averaged over the active ones only: a hidden service is not something the
  // assistant can quote, so including it would describe a price list nobody is
  // being offered.
  const averagePrice = active.length
    ? Math.round(active.reduce((sum, item) => sum + item.price, 0) / active.length)
    : 0

  const openDays = schedule.filter(
    (item) => item.is24h || Boolean(item.from)
  ).length
  const minutes = weekMinutes(schedule)

  const filled = FILLABLE.filter((key) => {
    const value = business?.[key]
    return Array.isArray(value) ? value.length > 0 : Boolean(value)
  }).length
  const completeness = Math.round((filled / FILLABLE.length) * 100)
  const missing = FILLABLE.length - filled

  return (
    <Card title="Состояние" className={className}>
      {/* One card, two hairlines — not four cards. Four boxes would say these
          are four subjects; they are four readings of one. */}
      <div className="grid grid-cols-2">
        <Metric
          label="Услуг активно"
          value={active.length}
          hint={
            services.length
              ? `из ${services.length} в прайсе`
              : 'прайс ещё пуст'
          }
          className="border-r border-b border-[#999999]/15 pr-5 pb-5"
        />
        <Metric
          label="Средний чек"
          value={averagePrice ? averagePrice.toLocaleString('ru-RU') : '—'}
          unit={averagePrice ? '₸' : null}
          hint={averagePrice ? 'по активным услугам' : 'нет активных услуг'}
          className="border-b border-[#999999]/15 pb-5 pl-5"
        />
        <Metric
          label="Часов в неделю"
          value={minutes ? Math.round(minutes / 60) : '—'}
          hint={openDays ? `${openDays} ${dayWord(openDays)}` : 'график не задан'}
          className="border-r border-[#999999]/15 pt-5 pr-5"
        />
        <Metric
          label="Профиль заполнен"
          value={`${completeness}%`}
          // The only figure allowed a colour, and only when it is finished:
          // green here means "nothing left to do", which is a fact, not a mood.
          tone={completeness === 100 ? '#16A34A' : null}
          hint={
            missing ? `${missing} ${fieldWord(missing)} пусто` : 'всё заполнено'
          }
          className="pt-5 pl-5"
        />
      </div>
    </Card>
  )
}

/**
 * The eight profile fields completeness is measured against.
 *
 * `timezone` is deliberately not one of them: it is never empty — the backend
 * defaults it to Asia/Almaty — so counting it would mean the meter could never
 * read below 12%, and it would move for a field the owner cannot influence.
 */
const FILLABLE = [
  'name',
  'industry',
  'phone',
  'city',
  'address',
  'landmark',
  'payment_methods',
  'languages',
]

const dayWord = (count) => {
  const last = count % 10
  if (count > 4 && count < 21) return 'рабочих дней'
  if (last === 1) return 'рабочий день'
  if (last > 1 && last < 5) return 'рабочих дня'
  return 'рабочих дней'
}

const fieldWord = (count) => {
  const last = count % 10
  if (count > 4 && count < 21) return 'полей'
  if (last === 1) return 'поле'
  if (last > 1 && last < 5) return 'поля'
  return 'полей'
}

/**
 * Three stacked lines and nothing between them: label, the number, the context.
 *
 * The value carries the page's only 32px, which is the point — it is the step
 * that says "this is what you came to see", and the reference spends it exactly
 * here. Poppins rather than the body face, because the reference sets every
 * number in the display family and that is most of what gives it its look.
 */
function Metric({ label, value, unit, hint, tone, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[14px] text-[#999999]">{label}</p>
      <p
        className="mt-1 font-display text-[32px] leading-none font-bold tracking-[-0.02em]"
        style={{ color: tone || '#171215' }}
      >
        {value}
        {unit && (
          // A size below the figure, so the unit reads as attached to it rather
          // than as a second number.
          <span className="ml-1 text-[20px] font-semibold text-[#999999]">
            {unit}
          </span>
        )}
      </p>
      <p className="mt-1.5 text-[13px] text-[#999999]">{hint}</p>
    </div>
  )
}
