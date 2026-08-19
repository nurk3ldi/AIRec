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
  document.documentElement.dataset.theme = resolveTheme(preference)
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
