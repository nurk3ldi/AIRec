import * as Select from '@radix-ui/react-select'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { THEMES, useTheme } from '../../lib/theme'
import { LANGUAGES, useLanguage, useT } from '../../lib/i18n'

/**
 * The «Настройки» section: two settings, theme and language, as two rows of a
 * plain list under one named group.
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
      {/* Named, because a list of settings with no heading is a list of
          settings for *what*. One group for now — both rows are about how the
          app presents itself — and the heading is what makes a second group
          (notifications, say) an addition rather than a redesign. */}
      <p className="px-6 pb-2 text-[13px] font-medium text-muted">
        {t('settings.interface')}
      </p>

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
 * One row: a label on the left, a dropdown on the right.
 *
 * **The row itself is inert** — no hover state, nothing clickable. The control
 * is the thing on the right, and a whole line lighting up under the cursor said
 * "this is a button" about a line that is mostly a label.
 *
 * The dropdown is Radix's `Select`. A native `<select>` was here first and it
 * behaved perfectly, but the list it opens is drawn by the operating system — a
 * white sheet with a blue bar through it, which is neither of the two colours
 * this project has. Radix is the exception the styling rules already name for
 * exactly this: it ships the behaviour that is hard (roving focus, typeahead,
 * ARIA wiring, dismissal, positioning) and no appearance at all, so the list
 * below is ours down to the last pixel. The objection that removed
 * `@radix-ui/react-select` from `/business` does not apply here — that was a
 * filterable list of eighty-odd cities, this is three fixed options.
 *
 * `Select.Portal` matters: the dialog panel is `overflow-hidden` with rounded
 * corners, and a popup rendered inside it would be clipped by them.
 */
function SettingRow({ label, value, options, onChange, isFirst = true }) {
  const current = options.find((option) => option.id === value)

  return (
    <div
      className={`flex items-center justify-between gap-4 px-6 py-4 ${
        isFirst ? '' : 'border-t border-line'
      }`}
    >
      <span className="truncate text-[14px] text-ink">{label}</span>

      <Select.Root value={value} onValueChange={onChange}>
        {/* `-my-4 py-4` makes the button as tall as the row without making the
            row any taller — a 52px target where the text alone would be 20.
            Focus is a tint and never a ring: an outline around a control that
            sits flush in a list reads as an error state. It is `focus-visible`,
            so a mouse click leaves no mark at all. */}
        <Select.Trigger
          aria-label={label}
          className="-my-4 -mr-2 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-4 text-[14px] text-ink outline-none transition-colors focus-visible:bg-ink/6"
        >
          <Select.Value>{current?.label ?? value}</Select.Value>
          {/* The chevron is the only muted thing in the row: it says the value
              can be changed without competing with the value itself. */}
          <Select.Icon asChild>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={16}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              className="text-muted"
            />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            // Hangs off the right edge, under the value it belongs to, rather
            // than centring over a row that is mostly empty space.
            align="end"
            sideOffset={6}
            // Above the dialog's own `z-[60]`, the tier the avatar cropper uses.
            // The tag is what stops one Escape press closing this list *and* the
            // dialog behind it — `ProfileDialog` checks for it.
            data-nested-overlay
            className="z-[70] min-w-[180px] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-[0_16px_48px_-8px_rgba(23,18,21,0.28)]"
          >
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item
                  key={option.id}
                  value={option.id}
                  // `data-highlighted` is the one state that matters here, and
                  // it covers hover *and* arrow keys as one thing — which is why
                  // the list needs no separate hover rule.
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[14px] text-ink outline-none select-none data-[highlighted]:bg-ink/6"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  {/* Only the chosen row is marked, and the tick is pushed to the
                      end so the labels stay in one column. */}
                  <Select.ItemIndicator className="ml-auto text-ink">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={15}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.6}
                    />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}
