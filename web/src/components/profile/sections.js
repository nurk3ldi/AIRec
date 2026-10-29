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
 * `labelKey` is the menu entry; optional `dialogLabelKey` is the dialog's
 * heading when it should read differently — the menu names the place, the
 * heading names the action. Both are translation *keys*: this array is built
 * once at import, so a translated string would freeze in the language that was
 * in force at first load.
 *
 * Scope: this is the *person's* account. What the business offers and how the
 * assistant behaves live on `/management`, a real route — putting them here too
 * would mean the same thing existed in two places.
 */
export const PROFILE_SECTIONS = [
  {
    id: 'account',
    labelKey: 'profile.section.account',
    dialogLabelKey: 'profile.section.accountDialog',
    icon: UserCircleIcon,
  },
  { id: 'security', labelKey: 'profile.section.security', icon: Shield01Icon },
  { id: 'subscription', labelKey: 'profile.section.subscription', icon: CreditCardIcon },
  { id: 'settings', labelKey: 'profile.section.settings', icon: Settings02Icon },
]

/** Placeholder copy for the sections that have no backend behind them yet —
 *  keys, for the same reason the labels are. */
export const SECTION_PLACEHOLDERS = {
  subscription: 'profile.subscriptionSoon',
}
