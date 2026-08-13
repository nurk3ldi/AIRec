import { useEffect, useRef, useState } from 'react'
import * as Switch from '@radix-ui/react-switch'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Camera01Icon,
  Cancel01Icon,
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

// One template, used by the header row and every service row, so the columns
// line up without either side knowing the widths.
const SERVICE_COLUMNS = 'grid grid-cols-[1fr_140px_130px_150px] gap-x-8'

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
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // Escape has to tell the blur that follows it not to save. Declared with the
  // other hooks, above the early return the pickers take.
  const skipSave = useRef(false)

  // A closed set of values needs no text box and no Save button: the pick is
  // the confirmation, so it commits straight away.
  if (options) {
    return (
      <div className="group border-r border-b border-[#999999]/15 px-6 py-5">
        <p className="text-[13px] text-[#999999]">{label}</p>
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

  const startEditing = () => {
    setDraft(value ?? '')
    setError('')
    setIsEditing(true)
  }

  const commit = async () => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }

    // Empty clears the field rather than storing "" — `null` is what the
    // backend reads as "this is not set".
    const next = draft.trim() || null
    if (next === (value ?? null)) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await onSave(fieldKey, next)
      setIsEditing(false)
    } catch (err) {
      // Stays open on failure: closing would throw away what was typed.
      setError(err.fields?.[0]?.message || err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return (
      <div className="border-r border-b border-[#999999]/15 px-6 py-5">
        <label
          htmlFor={`business-${fieldKey}`}
          className="text-[13px] text-[#999999]"
        >
          {label}
        </label>

        <input
          id={`business-${fieldKey}`}
          type="text"
          value={draft}
          disabled={isSaving}
          onChange={(event) => {
            setDraft(event.target.value)
            setError('')
          }}
          // Leaving the field is the save. Enter just leaves it early, which
          // is why it only has to blur.
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              // Set before the input goes away, so the blur that follows knows
              // this was a cancel and not a save.
              skipSave.current = true
              setIsEditing(false)
            }
          }}
          autoFocus
          className={`mt-1.5 -mx-2 w-[calc(100%+1rem)] rounded-lg border bg-white px-2 py-1 text-[16px] font-semibold text-[#171215] outline-none transition-colors focus:border-[#3248F2] disabled:opacity-60 ${
            error ? 'border-[#DC2626]' : 'border-[#999999]/35'
          }`}
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
        // The value itself is the control. No pencil: an icon that appears on
        // hover is a second target for the same job, and the tinted hover on
        // the text already says it can be clicked.
        // Wraps rather than truncates: this is the page where you come to read
        // what the assistant knows, so a value that doesn't fit on one line
        // should take two. The grid stretches every cell in a row to match, so
        // the dividers stay aligned.
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Изменить: ${label}`}
          className={`mt-1.5 -mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left text-[16px] break-words hyphens-auto outline-none transition-colors hover:bg-[#F6F8FA] focus-visible:bg-[#F6F8FA] ${
            value ? 'font-semibold text-[#171215]' : 'font-medium text-[#999999]'
          }`}
        >
          {value || 'Не указано'}
        </button>
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

  const toggleService = (name) =>
    setServices((current) =>
      current.map((service) =>
        service.name === name ? { ...service, active: !service.active } : service
      )
    )

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
        </div>

        {services.map((service) => (
          <div
            key={service.name}
            className={`${SERVICE_COLUMNS} items-center border-t border-[#999999]/15 py-3.5`}
          >
            <p className="text-[14px] break-words text-[#171215]">{service.name}</p>
            <p className="text-[14px] text-[#999999]">
              {formatDuration(service.minutes)}
            </p>
            <p className="text-[14px] font-semibold text-[#171215]">
              {formatPrice(service.price)}
            </p>
            <ServiceStatusToggle
              active={service.active}
              name={service.name}
              onToggle={() => toggleService(service.name)}
            />
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
