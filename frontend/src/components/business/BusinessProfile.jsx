import { useEffect, useRef, useState } from 'react'
import * as Switch from '@radix-ui/react-switch'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Camera01Icon,
  Cancel01Icon,
  MinusSignIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import AvatarCropper from '../AvatarCropper'
import {
  deleteBusinessLogo,
  getBusiness,
  mediaUrl,
  updateBusiness,
  uploadBusinessLogo,
} from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import { KAZAKHSTAN_CITIES } from '../../lib/cities'
import {
  PAYMENT_METHODS,
  SERVICE_LANGUAGES,
  timeZoneLabel,
} from '../../lib/businessOptions'
import Card, { CardAction } from './Card'
import InlineText from './InlineText'
import OptionPicker from './OptionPicker'
import WorkingHoursCalendar from './WorkingHoursCalendar'

const MAX_LOGO_BYTES = 5 * 1024 * 1024

// Parked, not deleted: the completion bar works and reads from the same fields
// below it. Flip to `true` to bring it back.
const SHOW_COMPLETION = false

// Nine, not seven: three columns divide evenly, so the last row isn't a stub
// with two empty cells and half-drawn dividers. Order is reading order, not
// model order — identity first, then location, then how the assistant talks.
const FIELDS = [
  { key: 'name', label: 'Название', editable: true },
  { key: 'industry', label: 'Сфера', editable: true },
  { key: 'phone', label: 'Телефон', editable: true },
  { key: 'city', label: 'Город', options: KAZAKHSTAN_CITIES, searchable: true },
  { key: 'address', label: 'Адрес', editable: true },
  { key: 'landmark', label: 'Ориентир', editable: true },
  {
    key: 'payment_methods',
    label: 'Способы оплаты',
    options: PAYMENT_METHODS,
    multiple: true,
  },
  {
    key: 'languages',
    label: 'Языки обслуживания',
    options: SERVICE_LANGUAGES,
    multiple: true,
  },
  // Read-only: all of Kazakhstan has been UTC+5 since March 2024, so there is
  // exactly one right answer and nothing to choose between.
  { key: 'timezone', label: 'Часовой пояс', format: timeZoneLabel },
]

// Ids rather than names as the key: the name is editable, and a list keyed by
// something the user can change loses its place the moment they change it.
const SERVICES = [
  { id: 's1', name: 'Мужская стрижка', minutes: 45, price: 6000, active: true },
  { id: 's2', name: 'Стрижка бороды', minutes: 30, price: 4000, active: true },
  { id: 's3', name: 'Стрижка + борода', minutes: 75, price: 9000, active: true },
  { id: 's4', name: 'Детская стрижка', minutes: 30, price: 4500, active: true },
  {
    id: 's5',
    name: 'Бритьё опасной бритвой',
    minutes: 40,
    price: 5500,
    active: false,
  },
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

/**
 * Everything that isn't a digit is dropped, so "6 000 ₸" pasted back in, or a
 * price typed with spaces, both come out as 6000 instead of being rejected for
 * looking like the value we just showed them.
 */
const parsePrice = (raw) => {
  const digits = raw.replace(/\D/g, '')
  if (!digits) throw new Error('Укажите цену.')
  const price = Number(digits)
  if (price > 100_000_000) throw new Error('Слишком большая цена.')
  return price
}

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} мин`
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

const MAX_SERVICE_MINUTES = 24 * 60

/**
 * Durations offered in the picker: 15 minutes to 4 hours, in 15-minute steps.
 *
 * A closed list rather than a free number, because the calendar will slot
 * appointments on a fixed step — a 37-minute service would leave a gap that no
 * other booking can ever fill. The labels are what `formatDuration` produces,
 * so `parseDuration` reads them straight back and the two never disagree.
 */
const DURATION_OPTIONS = Array.from({ length: 16 }, (_, index) =>
  formatDuration((index + 1) * 15)
)

/**
 * Reads the shapes a person actually types: "45", "45 мин", "1 ч 15 мин",
 * "1ч", "1:15". Crucially it also reads back exactly what `formatDuration`
 * writes — a field that rejects the value it just displayed is the fastest way
 * to make an edit feel broken.
 */
const parseDuration = (raw) => {
  const text = raw.toLowerCase().trim()

  const clock = text.match(/^(\d+)\s*:\s*(\d+)$/)
  const hours = text.match(/(\d+)\s*(?:ч|h)/)
  // "мин" before the bare "м", or the alternation would match the м in мин and
  // leave "ин" behind.
  const mins = text.match(/(\d+)\s*(?:мин|мин\.|m|м)/)

  let minutes
  if (clock) {
    minutes = Number(clock[1]) * 60 + Number(clock[2])
  } else if (hours || mins) {
    minutes = (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0)
  } else {
    const digits = text.replace(/\D/g, '')
    minutes = digits ? Number(digits) : NaN
  }

  if (!minutes || Number.isNaN(minutes)) throw new Error('Укажите длительность.')
  if (minutes > MAX_SERVICE_MINUTES) throw new Error('Не больше 24 часов.')
  return minutes
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

// One template, used by the header row and every service row, so the columns
// line up without either side knowing the widths. The last, narrow column is
// the row's delete control.
const SERVICE_COLUMNS = 'grid grid-cols-[1fr_140px_130px_150px_44px] gap-x-8'

/**
 * Status as a switch rather than a label: hiding a service from the assistant
 * is a thing the owner *does*, several times a week — a seasonal service, a
 * master on holiday — so it belongs under one click, in the row itself.
 */
function ServiceStatusToggle({ active, name, onToggle }) {
  return (
    <div className="flex items-center gap-2.5">
      <Switch.Root
        checked={active}
        onCheckedChange={onToggle}
        aria-label={`${name}: ${active ? 'скрыть' : 'показать'}`}
        className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full bg-[#999999]/35 outline-none transition-colors data-[state=checked]:bg-[#3248F2]"
      >
        <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgba(23,18,21,0.25)] transition-transform will-change-transform data-[state=checked]:translate-x-[18px]" />
      </Switch.Root>

      <span
        className={`text-[14px] ${active ? 'text-[#171215]' : 'text-[#999999]'}`}
      >
        {active ? 'Активна' : 'Скрыта'}
      </span>
    </div>
  )
}

/**
 * One fact about the business, edited in place.
 *
 * The pencil is hidden until the cell is hovered — nine permanent icons would
 * be nine competing targets — but it stays a real button, so it also appears on
 * keyboard focus and is reachable by Tab. Cells without a backing edit yet show
 * no pencil at all: a control that does nothing is worse than no control.
 *
 * Editing swaps the value for an input inside the same cell rather than opening
 * a dialog. The change is one short string; a modal would be more ceremony than
 * the edit deserves, and it would hide the neighbouring values you're often
 * copying the format from.
 */
function Field({
  fieldKey,
  label,
  value,
  editable,
  options,
  multiple,
  searchable,
  format,
  onSave,
}) {
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // A closed set of values needs no text box and no Save button: the pick is
  // the confirmation, so it commits straight away.
  if (options) {
    return (
      <div className="group border-r border-b border-[#999999]/15 px-6 py-5">
        <p className="mb-1.5 text-[13px] text-[#999999]">{label}</p>
        <OptionPicker
          value={value}
          options={options}
          label={label}
          multiple={multiple}
          searchable={searchable}
          disabled={isSaving}
          onChange={async (next) => {
            setIsSaving(true)
            setError('')
            try {
              await onSave(fieldKey, next)
            } catch (err) {
              setError(err.fields?.[0]?.message || err.message)
            } finally {
              setIsSaving(false)
            }
          }}
        />
        {error && (
          <p role="alert" className="mt-1.5 text-[13px] text-[#DC2626]">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="border-r border-b border-[#999999]/15 px-6 py-5">
      <p className="text-[13px] text-[#999999]">{label}</p>

      {editable ? (
        <span className="mt-1.5 block">
          <InlineText
            value={value}
            ariaLabel={`Изменить: ${label}`}
            className="text-[16px] font-semibold text-[#171215]"
            onSave={(next) => onSave(fieldKey, next)}
          />
        </span>
      ) : (
        <p
          className={`mt-1.5 text-[16px] break-words ${
            value ? 'font-semibold text-[#171215]' : 'font-medium text-[#999999]'
          }`}
        >
          {(value && (format ? format(value) : value)) || 'Не указано'}
        </p>
      )}
    </div>
  )
}

export default function BusinessProfile() {
  const fileInputRef = useRef(null)
  const [business, setBusiness] = useState(null)
  const [pickedFile, setPickedFile] = useState(null)
  const [logoError, setLogoError] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)
  // Local for now — the price list has no API behind it yet, so the switch
  // moves but nothing is persisted.
  const [services, setServices] = useState(SERVICES)

  // Deleting takes two clicks: the row has no undo, and a trash icon that fires
  // on the first press is how a price list loses a service by accident.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const updateService = (id, changes) =>
    setServices((current) =>
      current.map((service) =>
        service.id === id ? { ...service, ...changes } : service
      )
    )

  const addService = () =>
    setServices((current) => [
      ...current,
      {
        // Time-based rather than length-based: deleting a row must not let the
        // next id collide with one that's still on screen.
        id: `s${Date.now()}`,
        name: 'Новая услуга',
        minutes: 30,
        price: 0,
        active: true,
      },
    ])

  const removeService = (id) => {
    setServices((current) => current.filter((service) => service.id !== id))
    setConfirmDeleteId(null)
  }

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

  // One field per request: the change is already saved by the time the input
  // closes, so there's no page-level dirty state to reconcile.
  const handleFieldSave = async (key, value) => {
    setBusiness(await updateBusiness(getAccessToken(), { [key]: value }))
  }

  const fields = FIELDS.map((field) => ({
    ...field,
    value: business?.[field.key] ?? null,
  }))
  const missing = fields.filter((field) => !field.value)
  const percent = Math.round(((fields.length - missing.length) / fields.length) * 100)
  const logoUrl = mediaUrl(business?.logo_url)
  const displayName = business?.name || 'Без названия'
  // No time zone here: it's the same for every business in the country, so it
  // would be a constant taking up the one line that identifies this one.
  const meta =
    [business?.industry, business?.city].filter(Boolean).join(' · ') ||
    'Заполните профиль, чтобы ассистент знал, что отвечать'

  return (
    <div className="flex flex-col gap-6">
      {/* One card for the whole profile: the identity strip on top, then the
          facts, split by a hairline. Two cards would imply two subjects — they
          are the same one, seen at two zoom levels. */}
      <Card className="overflow-hidden !p-0">
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

        {SHOW_COMPLETION && (
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
        )}

        {/* The cells carry their own borders and the grid is pulled 1px past
            the clipping wrapper, so the outermost lines fall outside and the
            divider pattern comes out right at any column count. */}
        <div className="overflow-hidden border-t border-[#999999]/15">
          <div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <Field
                key={field.key}
                fieldKey={field.key}
                label={field.label}
                value={field.value}
                editable={field.editable}
                options={field.options}
                multiple={field.multiple}
                searchable={field.searchable}
                format={field.format}
                onSave={handleFieldSave}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card
        title="Услуги"
        action={
          <CardAction onClick={addService}>
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
        }
      >
        {/* Fixed columns rather than `auto`, so duration and price start on the
            left of their own space instead of being pushed against the next
            column — the row reads left to right with air between the parts. */}
        <div className={`${SERVICE_COLUMNS} pb-3`}>
          <ColumnLabel>Услуга</ColumnLabel>
          <ColumnLabel>Длительность</ColumnLabel>
          <ColumnLabel>Цена</ColumnLabel>
          <ColumnLabel>Статус</ColumnLabel>
          <span />
        </div>

        {services.map((service) => (
          <div
            key={service.id}
            className={`${SERVICE_COLUMNS} group items-center border-t border-[#999999]/15 py-3.5`}
          >
            <InlineText
              value={service.name}
              // A service without a name is not a service, so an empty box
              // holds the edit open instead of clearing the row.
              required
              ariaLabel={`Изменить название: ${service.name}`}
              className="text-[14px] text-[#171215]"
              onSave={(next) => updateService(service.id, { name: next })}
            />
            {/* The picker speaks in the formatted labels; `parseDuration` turns
                the chosen one back into minutes for storage. */}
            <OptionPicker
              value={formatDuration(service.minutes)}
              options={DURATION_OPTIONS}
              label="Длительность"
              valueClassName="text-[14px]"
              onChange={(next) =>
                updateService(service.id, { minutes: parseDuration(next) })
              }
            />
            <InlineText
              value={service.price}
              format={formatPrice}
              parse={parsePrice}
              inputMode="numeric"
              ariaLabel={`Изменить цену: ${service.name}`}
              className="text-[14px] font-semibold text-[#171215]"
              onSave={(next) => updateService(service.id, { price: next })}
            />
            <ServiceStatusToggle
              active={service.active}
              name={service.name}
              onToggle={() => updateService(service.id, { active: !service.active })}
            />

            {confirmDeleteId === service.id ? (
              // The minus becomes a red tick — same size, so the row doesn't
              // shift, and the tick already means "yes" everywhere else on this
              // page. The label is what carries the full meaning to a reader.
              <button
                type="button"
                autoFocus
                onClick={() => removeService(service.id)}
                aria-label={`Подтвердить удаление: ${service.name}`}
                // Leaving the button is a cancel, so the confirmation can't be
                // left armed on a row you've walked away from.
                onBlur={() => setConfirmDeleteId(null)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-[#DC2626]/8 text-[#DC2626] outline-none transition-colors hover:bg-[#DC2626]/15"
              >
                <HugeiconsIcon
                  icon={Tick02Icon}
                  size={16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.6}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(service.id)}
                aria-label={`Удалить услугу: ${service.name}`}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#999999] opacity-0 transition-all hover:bg-[#DC2626]/8 hover:text-[#DC2626] focus-visible:opacity-100 group-hover:opacity-100"
              >
                <HugeiconsIcon
                  icon={MinusSignIcon}
                  size={16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.4}
                />
              </button>
            )}
          </div>
        ))}
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
