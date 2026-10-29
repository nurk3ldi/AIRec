import { useEffect, useState } from 'react'

/**
 * What a screen was showing when you left it, kept for the length of the tab.
 *
 * **Every route change unmounts its page.** `PageTransition` swaps the outlet
 * for the arriving route, so a screen's state is built fresh each time it is
 * opened — which is right for a form and wrong for a view. Going to «Диалоги»
 * and back put `/appointments` on today, in the week view, with the grid
 * lowered and any open day closed, however carefully somebody had just set all
 * four.
 *
 * **A module-level `Map`, not `sessionStorage`.** This is view state, not a
 * preference: which day is on screen is worth keeping across a click on the
 * navigation and worth *losing* when the tab is closed or reloaded, because a
 * fresh page should open on today. A `Map` is exactly that lifetime, and it
 * also stores a `Date` or a `Set` as itself — the two things this holds most —
 * where storage would need a serialiser and a parser for each.
 *
 * The keys are `screen.thing` like the translation keys are, and for the same
 * reason: they are read in files that know nothing about each other, so the
 * screen has to be part of the name.
 */
const memory = new Map()

/**
 * A `useState` that survives leaving the screen.
 *
 * `initial` is used only the first time the tab ever renders this key, so it
 * may be a value or a lazy function exactly as `useState`'s is. Everything
 * after that comes back from the map.
 *
 * The write is an effect rather than part of the setter, so a value changed by
 * anything — a parent, a reducer, a second component sharing the key — is
 * remembered without every one of those having to know that it should be.
 */
export function useRemembered(key, initial) {
  const [value, setValue] = useState(() =>
    memory.has(key)
      ? memory.get(key)
      : typeof initial === 'function'
        ? initial()
        : initial,
  )

  useEffect(() => {
    memory.set(key, value)
  }, [key, value])

  return [value, setValue]
}

/**
 * Throw away what a screen remembered.
 *
 * `clearTokens` calls it, which is the one place every way a session can end
 * passes through: the sign-out button, a dead refresh token, a deleted account.
 * The app redirects to `/login` rather than reloading, so without this the next
 * person to sign in on a shared machine opens `/appointments` on somebody
 * else's Thursday.
 *
 * A function rather than an exported map, so the only way to forget is to say
 * what is being forgotten — a map anyone may write to is a map nobody can
 * reason about.
 */
export function forgetView(prefix = '') {
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key)
  }
}
