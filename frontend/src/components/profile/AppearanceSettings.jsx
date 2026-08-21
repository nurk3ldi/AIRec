import { HugeiconsIcon } from '@hugeicons/react'
import {
  Moon02Icon,
  Sun03Icon,
  ComputerIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { useTheme } from '../../lib/theme'
import { LANGUAGES, useLanguage, useT } from '../../lib/i18n'

/**
 * The «Настройки» section: two settings, theme and language, as two cards of
 * the same shape.
 *
 * Three theme options rather than a switch, because «Системная» is a real
 * answer and not a fallback — a phone that goes dark at sunset should take the
 * app with it, and someone who set a preference once for their whole device
 * should not have to set it again here. Light and dark mean *pin it*, whatever
 * the system says.
 *
 * A list of rows rather than a segmented control: each option gets a line of
 * explanation, and the one in force gets a tick, which is the same shape every
 * other choice in this dialog uses.
 */
const THEME_OPTIONS = [
  { id: 'system', icon: ComputerIcon },
  { id: 'light', icon: Sun03Icon },
  { id: 'dark', icon: Moon02Icon },
]

/** One row of either card: an icon column, a label, and a tick when chosen. */
function Row({ isActive, isFirst, onClick, children, mark }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-ground focus-visible:bg-ground ${
        isFirst ? '' : 'border-t border-line'
      }`}
    >
      <span className={`shrink-0 ${isActive ? 'text-accent' : 'text-muted'}`}>
        {mark}
      </span>

      <span className="min-w-0 flex-1">{children}</span>

      {/* Only the chosen row is marked. An unchecked circle on the other two
          would be two more things to read on a list of three. */}
      {isActive && (
        <HugeiconsIcon
          icon={Tick02Icon}
          size={17}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.6}
          className="shrink-0 text-accent"
        />
      )}
    </button>
  )
}

export default function AppearanceSettings() {
  const t = useT()
  const [preference, choose] = useTheme()
  const [lang, setLang] = useLanguage()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">
      <p className="mb-1 text-[13px] font-medium text-muted">{t('settings.theme')}</p>
      <p className="mb-4 text-[14px] text-muted">{t('settings.themeLead')}</p>

      <div className="overflow-hidden rounded-2xl border border-line">
        {THEME_OPTIONS.map((option, index) => {
          const isActive = preference === option.id

          return (
            <Row
              key={option.id}
              isActive={isActive}
              isFirst={index === 0}
              onClick={() => choose(option.id)}
              mark={
                <HugeiconsIcon
                  icon={option.icon}
                  size={20}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.9}
                />
              }
            >
              <span className="block text-[14px] font-medium text-ink">
                {t(`settings.theme.${option.id}`)}
              </span>
              <span className="mt-0.5 block text-[13px] text-muted">
                {t(`settings.theme.${option.id}Hint`)}
              </span>
            </Row>
          )
        })}
      </div>

      <p className="mt-8 mb-1 text-[13px] font-medium text-muted">
        {t('settings.language')}
      </p>
      <p className="mb-4 text-[14px] text-muted">{t('settings.languageLead')}</p>

      {/* Each language is named **in itself**, never translated — someone who
          switched to a script they cannot read has to be able to find their way
          back, and «Ағылшынша» is no help to a reader looking for English. The
          icon column carries the code instead of a glyph: there is no picture
          of a language, and a flag would name a country rather than a tongue
          (Russian is not Russia here, and English is nobody's flag). */}
      <div className="overflow-hidden rounded-2xl border border-line">
        {LANGUAGES.map((option, index) => (
          <Row
            key={option.id}
            isActive={lang === option.id}
            isFirst={index === 0}
            onClick={() => setLang(option.id)}
            mark={
              <span className="grid h-5 w-5 place-items-center text-[11px] font-semibold uppercase">
                {option.id}
              </span>
            }
          >
            <span className="block text-[14px] font-medium text-ink">
              {option.endonym}
            </span>
          </Row>
        ))}
      </div>
    </div>
  )
}
