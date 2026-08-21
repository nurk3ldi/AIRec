import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { THEMES, useTheme } from '../../lib/theme'
import { LANGUAGES, useLanguage, useT } from '../../lib/i18n'

/**
 * The «Настройки» section: two settings, theme and language, as two rows of a
 * plain list.
 *
 * Laid out from the system settings pane the design is taken from — label on
 * the left, the value and a chevron on the right, hairlines between rows and
 * nothing around them. Three stacked options with an explanation each was how
 * this looked before, and it spent half a panel saying what one word already
 * says: a setting with a small closed set of answers is a row, not a section.
 *
 * Adding a third setting here costs one `<SettingRow>` and no layout thought,
 * which is the other reason the shape is right.
 */
export default function AppearanceSettings() {
  const t = useT()
  const [preference, choose] = useTheme()
  const [lang, setLang] = useLanguage()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-2 pb-6">
      {/* Full-bleed: the rules run edge to edge of the panel rather than
          stopping at its padding, so they read as the list's structure and not
          as decoration inside a box. Each row puts the padding back. */}
      <div className="border-y border-line">
        <SettingRow
          label={t('settings.theme')}
          value={preference}
          onChange={choose}
          options={THEMES.map((id) => ({ id, label: t(`settings.theme.${id}`) }))}
        />
        <SettingRow
          isFirst={false}
          label={t('settings.language')}
          value={lang}
          onChange={setLang}
          // Named in itself, never translated: someone who switched into a
          // script they cannot read has to be able to find their way back, and
          // «Ағылшынша» is no help to a reader looking for English.
          options={LANGUAGES.map(({ id, endonym }) => ({ id, label: endonym }))}
        />
      </div>
    </div>
  )
}

/**
 * One row: a label, the value in force, and a chevron.
 *
 * The control is a **native `<select>` laid over the whole row at zero
 * opacity** — what you see is drawn by us, what you operate is the browser's
 * own. That is the same call the login page's checkbox makes: for a closed set
 * of three, a select already has the keyboard handling, the typeahead, the form
 * semantics and — the part no custom popup gets for free — the system picker on
 * a phone, which is a wheel at the bottom of the screen rather than a menu
 * floating inside a sheet. Radix is for behaviour that is hard to get right;
 * this is behaviour that is hard to get *wrong* if you leave it alone.
 *
 * The select covers the row rather than just the value, so tapping the label
 * opens it too — a 52px-tall, full-width target, well past the 44px minimum.
 * Because it is invisible its own focus ring would be too, so the state is
 * painted by a sibling overlay through `peer-focus-visible`.
 */
function SettingRow({ label, value, options, onChange, isFirst = true }) {
  const current = options.find((option) => option.id === value)

  return (
    <div
      className={`relative flex items-center justify-between gap-4 px-6 py-4 ${
        isFirst ? '' : 'border-t border-line'
      }`}
    >
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 outline-none"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Sits between the select and the text: it carries the hover and focus
          states the invisible control cannot show, and stays out of the way of
          both — `pointer-events-none` so clicks reach the select underneath. */}
      <span className="pointer-events-none absolute inset-0 transition-colors peer-hover:bg-ink/4 peer-focus-visible:bg-ink/4 peer-focus-visible:shadow-[inset_0_0_0_2px_var(--color-field-focus)]" />

      <span className="pointer-events-none relative truncate text-[14px] text-ink">
        {label}
      </span>

      <span className="pointer-events-none relative flex shrink-0 items-center gap-1.5 text-[14px] text-ink">
        {current?.label ?? value}
        {/* The chevron is the only muted thing in the row: it says the value can
            be changed without competing with the value itself. */}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          className="text-muted"
        />
      </span>
    </div>
  )
}
