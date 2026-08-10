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
 */
export const PROFILE_SECTIONS = [
  {
    id: 'account',
    label: 'Аккаунт',
    icon: UserCircleIcon,
    description: 'Личные данные и вход в систему',
  },
  {
    id: 'subscription',
    label: 'Подписка',
    icon: CreditCardIcon,
    description: 'Тариф, лимиты и история платежей',
  },
  {
    id: 'ai',
    label: 'ИИ-ассистент',
    icon: AiBrain01Icon,
    description: 'Как ассистент общается и что он знает',
  },
  {
    id: 'business',
    label: 'Бизнес',
    icon: Building03Icon,
    description: 'Данные компании, филиалы и график работы',
  },
  {
    id: 'settings',
    label: 'Настройки',
    icon: Settings02Icon,
    description: 'Параметры приложения, уведомления и интеграции',
  },
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
