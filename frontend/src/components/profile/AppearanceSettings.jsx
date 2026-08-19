import { HugeiconsIcon } from '@hugeicons/react'
import {
  Moon02Icon,
  Sun03Icon,
  ComputerIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { useTheme } from '../../lib/theme'

/**
 * The «Настройки» section. Right now it holds one setting: the theme.
 *
 * Three options rather than a switch, because «Системная» is a real answer and
 * not a fallback — a phone that goes dark at sunset should take the app with
 * it, and someone who set a preference once for their whole device should not
 * have to set it again here. Light and dark mean *pin it*, whatever the system
 * says.
 *
 * A list of rows rather than a segmented control: each option gets a line of
 * explanation, and the one in force gets a tick, which is the same shape every
 * other choice in this dialog uses.
 */
const OPTIONS = [
  {
    id: 'system',
    label: 'Системная',
    detail: 'Как на устройстве — переключится вместе с ним',
    icon: ComputerIcon,
  },
  { id: 'light', label: 'Светлая', detail: 'Всегда светлая', icon: Sun03Icon },
  { id: 'dark', label: 'Тёмная', detail: 'Всегда тёмная', icon: Moon02Icon },
]

export default function AppearanceSettings() {
  const [preference, choose] = useTheme()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">
      <p className="mb-1 text-[13px] font-medium text-muted">Тема</p>
      <p className="mb-4 text-[14px] text-muted">
        Оформление приложения. Выбор сохраняется в этом браузере.
      </p>

      <div className="overflow-hidden rounded-2xl border border-line">
        {OPTIONS.map((option, index) => {
          const isActive = preference === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              aria-pressed={isActive}
              className={`flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-ground focus-visible:bg-ground ${
                index > 0 ? 'border-t border-line' : ''
              }`}
            >
              <HugeiconsIcon
                icon={option.icon}
                size={20}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.9}
                className={`shrink-0 ${isActive ? 'text-accent' : 'text-muted'}`}
              />

              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[13px] text-muted">
                  {option.detail}
                </span>
              </span>

              {/* Only the chosen row is marked. An unchecked circle on the other
                  two would be two more things to read on a list of three. */}
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
        })}
      </div>
    </div>
  )
}
