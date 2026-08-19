import { useEffect, useRef, useState } from 'react'
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
  getServices,
  getWorkingHours,
  mediaUrl,
  saveServices,
  saveWorkingHours,
  updateBusiness,
  uploadBusinessLogo,
} from '../../lib/api'
import { getAccessToken } from '../../lib/auth'
import { dayProblem } from '../../lib/schedule'
import { KAZAKHSTAN_CITIES } from '../../lib/cities'
import {
  PAYMENT_METHODS,
  SERVICE_LANGUAGES,
  timeZoneLabel,
} from '../../lib/businessOptions'
import Card, { CardAction } from './Card'
import InlineText from './InlineText'
import OptionPicker from './OptionPicker'
import WorkingHours from './WorkingHours'

const MAX_LOGO_BYTES = 5 * 1024 * 1024

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

// Index matches `weekday` on the backend, which in turn matches Python's
// `datetime.weekday()` — 0 is Monday. Keeping the same numbering everywhere
// means no translation table, and no chance of an off-by-one that only shows
// up on Sundays.
const WEEKDAYS = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
]

// The API speaks in `duration_minutes` / `is_active` / `weekday`; the UI speaks
// in `minutes` / `active` / `day`. These four functions are the only place the
// two vocabularies meet.
const serviceFromApi = (row) => ({
  id: row.id,
  name: row.name,
  minutes: row.duration_minutes,
  price: row.price,
  active: row.is_active,
})

const serviceToApi = (service) => ({
  // A locally added row has a `new-…` id the server has never seen; sending it
  // would look like an edit to a row that doesn't exist.
  id: String(service.id).startsWith('new-') ? null : service.id,
  name: service.name,
  duration_minutes: service.minutes,
  price: service.price,
  is_active: service.active,
})

const scheduleFromApi = (rows) =>
  WEEKDAYS.map((day, weekday) => {
    const row = rows.find((item) => item.weekday === weekday)
    return {
      day,
      from: row?.opens_at ?? null,
      to: row?.closes_at ?? null,
      breakFrom: row?.break_starts_at ?? null,
      breakTo: row?.break_ends_at ?? null,
      is24h: Boolean(row?.is_24h),
    }
  })

const scheduleToApi = (schedule) =>
  schedule.map((item) => ({
    weekday: WEEKDAYS.indexOf(item.day),
    opens_at: item.from,
    closes_at: item.to,
    break_starts_at: item.breakFrom,
    break_ends_at: item.breakTo,
    is_24h: item.is24h,
  }))

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
const SERVICE_COLUMNS =
  '-mx-6 grid grid-cols-[1fr_140px_130px_120px_44px] gap-x-8 px-6'

/**
 * Status as a tinted pill, and the pill is the control.
 *
 * It was a switch with a label beside it, which read as a form field in a table
 * — a switch is chrome, and eight of them down a column is most of what made
 * this card look like a settings screen. The reference states a status as a
 * tinted pill, so that is what this is; hiding a service is still one click,
 * because the pill itself is the button.
 *
 * Off is muted rather than red. Red means something went wrong, and a service
 * the owner deliberately took down is not a fault.
 */
function ServiceStatusToggle({ active, name, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={`${name}: ${active ? 'скрыть' : 'показать'}`}
      className={`w-fit rounded-md px-2.5 py-1 text-[12px] font-medium outline-none transition-colors ${
        active
          ? 'bg-[#16A34A]/10 text-[#16A34A] hover:bg-[#16A34A]/18 focus-visible:bg-[#16A34A]/18'
          : 'bg-[#999999]/12 text-[#999999] hover:bg-[#999999]/20 focus-visible:bg-[#999999]/20'
      }`}
    >
      {active ? 'Активна' : 'Скрыта'}
    </button>
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
/**
 * A field cell's frame: a hairline above it, and none anywhere else.
 *
 * Nine cells each carrying four borders is a box of boxes — the table treatment
 * the reference never uses and the one CLAUDE.md rules out by name ("never
 * vertical dividers"). Rows are separated, columns are separated by air.
 *
 * The top border is switched off for whichever cells make up the *first* row,
 * and that changes with the breakpoint — one column, then two, then three — so
 * there is a rule per breakpoint rather than a single nth-child that would be
 * right at one width and draw a stray line at the others.
 */
const FIELD_CELL =
  'px-6 py-5 border-t border-[#999999]/15 ' +
  '[&:nth-child(-n+1)]:border-t-0 ' +
  'sm:[&:nth-child(-n+2)]:border-t-0 ' +
  'lg:[&:nth-child(-n+3)]:border-t-0'

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
      <div className={`group ${FIELD_CELL}`}>
        <ColumnLabel className="mb-1.5 block">{label}</ColumnLabel>
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
    <div className={FIELD_CELL}>
      <ColumnLabel className="block">{label}</ColumnLabel>

      {editable ? (
        <span className="mt-1.5 block">
          <InlineText
            value={value}
            ariaLabel={`Изменить: ${label}`}
            className="text-[15px] font-medium text-[#171215]"
            onSave={(next) => onSave(fieldKey, next)}
          />
        </span>
      ) : (
        <p
          className={`mt-1.5 text-[15px] break-words ${
            value ? 'font-medium text-[#171215]' : 'text-[#999999]'
          }`}
        >
          {(value && (format ? format(value) : value)) || 'Не указано'}
        </p>
      )}
    </div>
  )
}

/**
 * `trailing` fills the narrow right-hand cell of the top row.
 *
 * The page owns what goes there — right now the empty «Настройка ИИ» card — but
 * this component owns the grid, because the grid is what its three cards are
 * arranged in. Handing the slot down is what keeps a placeholder from having to
 * live inside a component called BusinessProfile.
 */
export default function BusinessProfile({ trailing }) {
  const fileInputRef = useRef(null)
  const [business, setBusiness] = useState(null)
  const [pickedFile, setPickedFile] = useState(null)
  const [logoError, setLogoError] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)
  // Two copies: `savedServices` is what the server has, `services` is what's on
  // screen. The price list is edited as a whole — rename a service, move a
  // price, hide another — and only then saved, so a half-finished edit never
  // becomes the price the assistant quotes.
  const [savedServices, setSavedServices] = useState([])
  const [services, setServices] = useState([])

  // Structural compare: covers edits, additions, removals and reordering alike
  // without listing the fields, which would go stale the moment one is added.
  const servicesDirty =
    JSON.stringify(services) !== JSON.stringify(savedServices)

  // Same draft-then-save shape as the price list, so the two cards on this page
  // don't behave differently from each other.
  const [savedSchedule, setSavedSchedule] = useState([])
  const [schedule, setSchedule] = useState([])
  const scheduleDirty = JSON.stringify(schedule) !== JSON.stringify(savedSchedule)
  // The same rule the card prints under the offending row, asked here as a
  // yes/no: a week that can't be read as opening hours must not become the one
  // the assistant books against.
  const scheduleBroken = schedule.some((item) => dayProblem(item))

  const [servicesError, setServicesError] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  const [savingServices, setSavingServices] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)

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
        // The `new-` prefix is what `serviceToApi` looks for: this row has no
        // server id yet, and sending this one would address nothing. Time-based
        // rather than length-based so deleting a row can't let the next id
        // collide with one still on screen.
        id: `new-${Date.now()}`,
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

  const cancelServiceEdits = () => {
    setServices(savedServices)
    setConfirmDeleteId(null)
  }

  const handleSaveServices = async () => {
    setSavingServices(true)
    setServicesError('')
    try {
      // The response is the authority: it carries the real ids for rows that
      // were just created, so the next edit updates them instead of creating
      // duplicates.
      const rows = (await saveServices(getAccessToken(), services.map(serviceToApi)))
        .map(serviceFromApi)
      setServices(rows)
      setSavedServices(rows)
      setConfirmDeleteId(null)
    } catch (err) {
      setServicesError(err.fields?.[0]?.message || err.message)
    } finally {
      setSavingServices(false)
    }
  }

  const handleSaveSchedule = async () => {
    setSavingSchedule(true)
    setScheduleError('')
    try {
      const rows = scheduleFromApi(
        await saveWorkingHours(getAccessToken(), scheduleToApi(schedule))
      )
      setSchedule(rows)
      setSavedSchedule(rows)
    } catch (err) {
      setScheduleError(err.fields?.[0]?.message || err.message)
    } finally {
      setSavingSchedule(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const token = getAccessToken()

    getBusiness(token)
      .then((data) => {
        if (!cancelled) setBusiness(data)
      })
      .catch((err) => {
        if (!cancelled) setLogoError(err.message)
      })

    getServices(token)
      .then((rows) => {
        if (cancelled) return
        const mapped = rows.map(serviceFromApi)
        setServices(mapped)
        setSavedServices(mapped)
      })
      .catch((err) => {
        if (!cancelled) setServicesError(err.message)
      })

    getWorkingHours(token)
      .then((rows) => {
        if (cancelled) return
        const mapped = scheduleFromApi(rows)
        setSchedule(mapped)
        setSavedSchedule(mapped)
      })
      .catch((err) => {
        if (!cancelled) setScheduleError(err.message)
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
  const logoUrl = mediaUrl(business?.logo_url)
  const displayName = business?.name || 'Без названия'
  // No time zone here: it's the same for every business in the country, so it
  // would be a constant taking up the one line that identifies this one.
  const meta =
    [business?.industry, business?.city].filter(Boolean).join(' · ') ||
    'Заполните профиль, чтобы ассистент знал, что отвечать'

  return (
    // 7/5 rather than one column of five equal slabs. Every card the same width
    // gives the page no rhythm and the eye no entry point; the reference never
    // stacks more than two full-width blocks in a row. The wide/narrow split
    // rides on top, then two full-bleed rows, because the two tables below
    // genuinely need the width — «Услуги» is five columns and the week is
    // seven, and squeezing either into 58% is what would actually break.
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      {/* One card for the whole profile: the identity strip on top, then the
          facts, split by a hairline. Two cards would imply two subjects — they
          are the same one, seen at two zoom levels. */}
      <Card className="overflow-hidden !p-0 lg:col-span-7">
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

        </div>

        {/* No clipping wrapper and no negative margins any more: with only a
            top border per cell there are no outer lines to hide. */}
        <div className="border-t border-[#999999]/15">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Still a column rather than the card itself, so the page can put more
          than one thing here without this component changing shape. */}
      <div className="flex flex-col gap-6 lg:col-span-5 lg:self-stretch">
        {trailing}
      </div>

      <Card
        className="lg:col-span-12"
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
          {/* Over the amounts it names, which are right-aligned — a heading
              left of a column of right-aligned numbers points at nothing. */}
          <ColumnLabel className="text-right">Цена</ColumnLabel>
          <ColumnLabel>Статус</ColumnLabel>
          <span />
        </div>

        {services.map((service) => (
          <div
            key={service.id}
            className={`${SERVICE_COLUMNS} group items-center border-t border-[#999999]/15 py-3.5 transition-colors hover:bg-[#F6F8FA]/70`}
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
              size="text-[14px]"
              // Lighter than the name and the price: the duration is the least
              // load-bearing number in the row.
              weight="font-normal"
              onChange={(next) =>
                updateService(service.id, { minutes: parseDuration(next) })
              }
            />
            {/* Right-aligned, so the digits line up under each other and two
                prices can be compared without reading them. */}
            <InlineText
              value={service.price}
              format={formatPrice}
              parse={parsePrice}
              inputMode="numeric"
              align="right"
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

        {/* Only while there is something to save: a footer that is always there
            reads as "you have unsaved work" even when you don't. */}
        {(servicesDirty || servicesError) && (
          // Bled to the card edges like the rows above it — a rule that stops
          // short under a stack of full-width rules reads as a missed edit.
          <div className="-mx-6 mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[#999999]/15 px-6 pt-4">
            {servicesError && (
              <p role="alert" className="mr-auto text-[13px] text-[#DC2626]">
                {servicesError}
              </p>
            )}
            <button
              type="button"
              onClick={cancelServiceEdits}
              disabled={savingServices}
              className="rounded-xl border border-[#999999]/30 px-4 py-2 text-[13px] font-medium text-[#171215] outline-none transition-colors hover:bg-[#171215]/5 focus-visible:bg-[#171215]/5 disabled:opacity-60"
            >
              Отменить
            </button>
            <button
              type="button"
              onClick={handleSaveServices}
              disabled={savingServices || !servicesDirty}
              className="rounded-xl bg-[#3248F2] px-4 py-2 text-[13px] font-medium text-white outline-none transition-colors hover:bg-[#2839c9] focus-visible:bg-[#2839c9] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {savingServices ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        )}
      </Card>

      <Card title="График работы" className="lg:col-span-12">
        <WorkingHours schedule={schedule} onChange={setSchedule} />

        {(scheduleDirty || scheduleError) && (
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[#999999]/15 pt-4">
            {/* A disabled Save with nothing next to it looks broken. The rows
                carry the actual reasons, so this only says where to look. */}
            {scheduleError ? (
              <p role="alert" className="mr-auto text-[13px] text-[#DC2626]">
                {scheduleError}
              </p>
            ) : (
              scheduleBroken && (
                <p className="mr-auto text-[13px] text-[#999999]">
                  Исправьте отмеченные дни, чтобы сохранить график.
                </p>
              )
            )}
            <button
              type="button"
              onClick={() => setSchedule(savedSchedule)}
              disabled={savingSchedule}
              className="rounded-xl border border-[#999999]/30 px-4 py-2 text-[13px] font-medium text-[#171215] outline-none transition-colors hover:bg-[#171215]/5 focus-visible:bg-[#171215]/5 disabled:opacity-60"
            >
              Отменить
            </button>
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={savingSchedule || !scheduleDirty || scheduleBroken}
              className="rounded-xl bg-[#3248F2] px-4 py-2 text-[13px] font-medium text-white outline-none transition-colors hover:bg-[#2839c9] focus-visible:bg-[#2839c9] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {savingSchedule ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        )}
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
