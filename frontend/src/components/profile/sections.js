import {
  CreditCardIcon,
  Settings02Icon,
  Shield01Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons'

/**
 * The profile area's sections, shared by `ProfileMenu` (which picks one) and
 * `ProfileDialog` (which renders it). Add a section here and both pick it up.
 *
 * `label` is the menu entry; optional `dialogLabel` is the dialog's heading
 * when it should read differently — the menu names the place, the heading names
 * the action.
 *
 * Scope: this is the *person's* account. What the business offers and how the
 * assistant behaves live on `/management`, a real route — putting them here too
 * would mean the same thing existed in two places.
 */
export const PROFILE_SECTIONS = [
  {
    id: 'account',
    label: 'Профиль',
    dialogLabel: 'Редактировать профиль',
    icon: UserCircleIcon,
  },
  { id: 'security', label: 'Безопасность', icon: Shield01Icon },
  { id: 'subscription', label: 'Подписка', icon: CreditCardIcon },
  { id: 'settings', label: 'Настройки', icon: Settings02Icon },
]

/** Placeholder copy for the sections that have no backend behind them yet. */
export const SECTION_PLACEHOLDERS = {
  subscription:
    'Здесь будут ваш тариф, лимиты использования, способ оплаты и история счетов.',
  settings:
    'Здесь будут язык интерфейса, часовой пояс, уведомления и общие параметры приложения.',
}
