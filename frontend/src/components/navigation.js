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
 *
 * The label is a **key, not a string**: this is a module constant, evaluated
 * once at import, so a translated label here would freeze in whichever language
 * was in force when the bundle first ran and never follow a change. The shells
 * call `t(item.labelKey)` at render instead.
 */
export const NAVIGATION = [
  { labelKey: 'nav.dashboard', href: '/dashboard', icon: Home01Icon },
  { labelKey: 'nav.inbox', href: '/inbox', icon: Chat01Icon },
  { labelKey: 'nav.appointments', href: '/appointments', icon: NoteIcon },
  { labelKey: 'nav.business', href: '/business', icon: Building03Icon },
]
