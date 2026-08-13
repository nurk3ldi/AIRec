import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Camera01Icon,
  Cancel01Icon,
  PencilEdit02Icon,
} from '@hugeicons/core-free-icons'
import AvatarCropper from '../AvatarCropper'
import {
  deleteBusinessLogo,
  getBusiness,
  mediaUrl,
  uploadBusinessLogo,
} from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import Card, { CardAction } from './Card'
import WorkingHoursCalendar from './WorkingHoursCalendar'

const MAX_LOGO_BYTES = 5 * 1024 * 1024

// Nine, not seven: three columns divide evenly, so the last row isn't a stub
// with two empty cells and half-drawn dividers. Order is reading order, not
// model order — identity first, then location, then how the assistant talks.
const FIELDS = [
  { key: 'name', label: 'Название' },
  { key: 'industry', label: 'Сфера' },
  { key: 'phone', label: 'Телефон' },
  { key: 'city', label: 'Город' },
  { key: 'address', label: 'Адрес' },
  { key: 'landmark', label: 'Ориентир' },
  { key: 'payment_methods', label: 'Способы оплаты' },
  { key: 'languages', label: 'Языки обслуживания' },
  { key: 'timezone', label: 'Часовой пояс' },
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
  const fileInputRef = useRef(null)
  const [business, setBusiness] = useState(null)
  const [pickedFile, setPickedFile] = useState(null)
  const [logoError, setLogoError] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getBusiness(getAccessToken())
      .then((data) => {
        if (!cancelled) setBusiness(data)
      })
      .catch((err) => {
        if (!cancelled) setLogoError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleFilePicked = (event) => {
    const file = event.target.files?.[0]
    // Reset immediately so re-picking the same file still fires onChange.
    event.target.value = ''
    if (!file) return

    setLogoError('')
    if (!file.type.startsWith('image/')) {
      setLogoError('Выберите файл изображения.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Изображение должно быть меньше 5 МБ.')
      return
    }
    setPickedFile(file)
  }

  const handleCropSave = async (blob) => {
    setLogoBusy(true)
    try {
      setBusiness(await uploadBusinessLogo(getAccessToken(), blob))
      setPickedFile(null)
    } catch (err) {
      setLogoError(err.message)
      // Rethrown so the cropper stays open on failure rather than closing over
      // an upload that never happened.
      throw err
    } finally {
      setLogoBusy(false)
    }
  }

  const handleRemoveLogo = async () => {
    setLogoBusy(true)
    setLogoError('')
    try {
      setBusiness(await deleteBusinessLogo(getAccessToken()))
    } catch (err) {
      setLogoError(err.message)
    } finally {
      setLogoBusy(false)
    }
  }

  const fields = FIELDS.map((field) => ({
    ...field,
    value: business?.[field.key] ?? null,
  }))
  const missing = fields.filter((field) => !field.value)
  const percent = Math.round(((fields.length - missing.length) / fields.length) * 100)
  const activeCount = SERVICES.filter((service) => service.active).length
  const logoUrl = mediaUrl(business?.logo_url)
  const displayName = business?.name || 'Без названия'
  const meta =
    [business?.industry, business?.city, business?.timezone]
      .filter(Boolean)
      .join(' · ') || 'Заполните профиль, чтобы ассистент знал, что отвечать'

  return (
    <div className="flex flex-col gap-6">
      {/* Identity and completion in one card, split by a hairline: they answer
          two halves of the same question — who this business is, and how much
          of it the assistant actually knows. */}
      <Card className="!p-0">
        <div className="flex flex-wrap items-center gap-4 px-6 py-5">
          {/* The whole square is the upload target — at 56px a corner badge
              would be a 20px hit area, well under the 44px minimum. */}
          <div className="group relative shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={logoBusy}
              aria-label={logoUrl ? 'Заменить логотип' : 'Загрузить логотип'}
              className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-[#3248F2] font-display text-[18px] font-semibold text-white outline-none disabled:opacity-70"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initialsOf(displayName)
              )}

              <span className="absolute inset-0 grid place-items-center rounded-2xl bg-[#171215]/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <HugeiconsIcon
                  icon={Camera01Icon}
                  size={18}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.9}
                />
              </span>
            </button>

            {logoUrl && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                disabled={logoBusy}
                aria-label="Удалить логотип"
                className="absolute -top-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full border border-[#999999]/25 bg-white text-[#171215] opacity-0 shadow-[0_2px_8px_rgba(23,18,21,0.16)] transition-opacity hover:text-[#DC2626] focus-visible:opacity-100 group-hover:opacity-100"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={13}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.4}
                />
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFilePicked}
              className="hidden"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[20px] font-semibold tracking-[-0.02em] text-[#171215]">
              {displayName}
            </p>
            {logoError ? (
              <p role="alert" className="mt-0.5 truncate text-[14px] text-[#DC2626]">
                {logoError}
              </p>
            ) : (
              <p className="mt-0.5 truncate text-[14px] text-[#999999]">{meta}</p>
            )}
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
            {fields.map((field) => (
              <Field key={field.key} label={field.label} value={field.value} />
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

      {pickedFile && (
        <AvatarCropper
          file={pickedFile}
          // Square mask: the logo is shown in a rounded square, so the crop the
          // user frames should be the crop they get.
          shape="square"
          title="Настройте логотип"
          onCancel={() => setPickedFile(null)}
          onSave={handleCropSave}
        />
      )}
    </div>
  )
}
