import {
  Home01Icon,
  Chat01Icon,
  NoteIcon,
  Building03Icon,
} from '@hugeicons/core-free-icons'

/**
 * The dashboard's destinations, in one list.
 *
 * Two shells read it — the desktop rail and the phone's bottom bar — and they
 * must never disagree about what the app contains. Adding a screen here puts it
 * in both; adding it to one of them only is how a route ends up reachable on a
 * laptop and invisible on a phone.
 *
 * Profile is deliberately not in this array. It is not a destination: it opens
 * an overlay, and both shells give it their own slot at the end.
 */
export const NAVIGATION = [
  { label: 'Главная', href: '/dashboard', icon: Home01Icon },
  { label: 'Диалоги', href: '/inbox', icon: Chat01Icon },
  { label: 'Записи', href: '/appointments', icon: NoteIcon },
  { label: 'Бизнес', href: '/business', icon: Building03Icon },
]
