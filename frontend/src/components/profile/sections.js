import {
  AiBrain01Icon,
  Building03Icon,
  CreditCardIcon,
  Settings02Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons'

/**
 * The profile area's sections, shared by `ProfileMenu` (which picks one) and
 * `ProfileDialog` (which renders it). Add a section here and both pick it up.
 *
 * `label` is the menu entry; optional `dialogLabel` is the dialog's heading
 * when it should read differently — the menu names the place, the heading names
 * the action.
 */
export const PROFILE_SECTIONS = [
  {
    id: 'account',
    label: 'Профиль',
    dialogLabel: 'Редактировать профиль',
    icon: UserCircleIcon,
  },
  { id: 'subscription', label: 'Подписка', icon: CreditCardIcon },
  { id: 'ai', label: 'ИИ-ассистент', icon: AiBrain01Icon },
  { id: 'business', label: 'Бизнес', icon: Building03Icon },
  { id: 'settings', label: 'Настройки', icon: Settings02Icon },
]

/** Placeholder copy for the sections that have no backend behind them yet. */
export const SECTION_PLACEHOLDERS = {
  subscription:
    'Здесь будут ваш тариф, лимиты использования, способ оплаты и история счетов.',
  ai: 'Здесь настраиваются тон и язык ассистента, база ответов и правила передачи диалога человеку.',
  business:
    'Здесь настраиваются название компании, сфера, филиалы, график работы, услуги и сотрудники.',
  settings:
    'Здесь будут язык интерфейса, уведомления, подключённые каналы и общие параметры приложения.',
}
