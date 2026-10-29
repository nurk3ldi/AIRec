import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'airec_theme'

/**
 * Three choices, not two.
 *
 * «Системная» is the default and it is a real answer rather than a fallback: a
 * phone that turns dark at sunset should take the app with it, and someone who
 * has never opened this screen still gets the theme they set once for
 * everything. Picking light or dark here means *pin it*, whatever the system
 * says.
 */
export const THEMES = ['system', 'light', 'dark']

const prefersDark = () =>
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

const prefersReducedMotion = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * How long the two themes cross over.
 *
 * Every colour in the app is a token, so switching one flips the entire screen
 * between white and pure black on a single frame — the abrupt brightness jump
 * that accessibility guidance names outright, and the one moving thing in this
 * product big enough to be uncomfortable rather than merely abrupt.
 *
 * 200ms, which is long enough to read as a dissolve and short enough that a
 * setting still feels like it took effect when you pressed it. It is a fade of
 * colour only — nothing moves, nothing resizes — so it is the gentlest kind of
 * transition there is, and it is dropped entirely under reduced motion anyway.
 */
const THEME_FADE_MS = 200
let fade

/** What is stored, which is a preference and may be `system`. */
export function getThemePreference() {
  const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
  return THEMES.includes(stored) ? stored : 'system'
}

/** What is actually on screen — `system` resolved against the OS. */
export function resolveTheme(preference = getThemePreference()) {
  return preference === 'system' ? (prefersDark() ? 'dark' : 'light') : preference
}

/**
 * Writes the resolved theme onto `<html>`, which is what every token in
 * `globals.css` is keyed on. The same one line runs in an inline script in
 * `index.html` before first paint — without it the page renders light, then
 * corrects itself, and that flash is worse than no dark mode at all.
 */
export function applyTheme(preference = getThemePreference()) {
  const root = document.documentElement
  const next = resolveTheme(preference)
  const current = root.dataset.theme

  // **The cross-over is armed here, and only for a real change.**
  // `data-theme-switching` is what turns on the colour transition in
  // `globals.css`; it goes on for `THEME_FADE_MS` and then comes off again,
  // because permanently transitioning every colour in the app would make every
  // hover and every focus ring sluggish for the sake of a setting somebody
  // touches twice a year.
  //
  // Three conditions and each one matters. There must be a **previous** theme:
  // the first call of the session is the page arriving at its colours rather
  // than changing them, and fading in from nothing is the very flash the inline
  // script above exists to prevent. It must be a **different** theme, or a
  // no-op would arm a transition over nothing. And the reader must not have
  // asked for **less motion** — there the cut is the correct answer rather than
  // a compromise.
  if (current && current !== next && !prefersReducedMotion()) {
    root.dataset.themeSwitching = ''
    clearTimeout(fade)
    fade = setTimeout(() => {
      delete root.dataset.themeSwitching
    }, THEME_FADE_MS)
  }

  root.dataset.theme = next
}

/**
 * The current preference and a setter, for the settings panel.
 *
 * It listens to the OS setting too: on `system` a sunset should move the app
 * without anyone reopening this screen.
 */
export function useTheme() {
  const [preference, setPreference] = useState(getThemePreference)

  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system') return

    const media = globalThis.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const choose = useCallback((next) => {
    // `system` is the default, so it is stored as the *absence* of a choice —
    // that way a browser that has never seen this app and one where the user
    // went back to automatic end up in the same state.
    if (next === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
    setPreference(next)
  }, [])

  return [preference, choose]
}
