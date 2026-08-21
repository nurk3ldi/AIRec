import { useEffect, useState } from 'react'
import en from './locales/en'
import kk from './locales/kk'
import ru from './locales/ru'

const STORAGE_KEY = 'airec_lang'

/**
 * Three languages, and Russian is the fallback rather than English.
 *
 * The product is sold in Kazakhstan, where Russian is the language every
 * business owner reads regardless of which one they prefer — so a key missing
 * from `kk` or `en` falls through to something a user can still act on rather
 * than to a raw key or to English they may not read.
 */
export const LANGUAGES = [
  { id: 'ru', label: 'Русский', endonym: 'Русский' },
  { id: 'kk', label: 'Қазақша', endonym: 'Қазақша' },
  { id: 'en', label: 'English', endonym: 'English' },
]

const DICTIONARIES = { ru, kk, en }
const FALLBACK = 'ru'

// BCP 47 tags for `Intl` — dates and times a `toLocaleString` formats have to
// follow the interface, or a Kazakh screen shows Russian month names. `en-GB`
// rather than `en-US`: day-before-month is what the rest of the product uses
// and what a reader here expects.
const LOCALES = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-GB' }

// Module-level rather than a React context: the language is read in a dozen
// places at every depth, and threading a provider through would be a lot of
// plumbing for one string. Components subscribe with `useT()`; the set is what
// re-renders them when the choice changes.
const listeners = new Set()
let current = read()

function read() {
  const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
  if (DICTIONARIES[stored]) return stored
  // No stored choice: take the browser's, but only if we speak it.
  const browser = globalThis.navigator?.language?.slice(0, 2)
  return DICTIONARIES[browser] ? browser : FALLBACK
}

/** The language in force. */
export function getLanguage() {
  return current
}

/**
 * Looks a key up, falling back to Russian and finally to the key itself — a
 * visible `login.title` in the UI is a missing translation you can find, where
 * an empty string is a bug you cannot.
 *
 * `vars` fills `{name}` placeholders, which is what keeps a sentence one
 * translatable string instead of three fragments a translator has to reassemble
 * in an order their language may not use.
 */
export function translate(key, vars, lang = current) {
  const text = DICTIONARIES[lang]?.[key] ?? DICTIONARIES[FALLBACK][key] ?? key
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  )
}

/** Writes the choice and tells every subscriber. `lang` also lands on `<html>`,
 *  which is what a screen reader picks its voice from. */
export function setLanguage(next) {
  if (!DICTIONARIES[next]) return
  current = next
  localStorage.setItem(STORAGE_KEY, next)
  document.documentElement.lang = next
  for (const listen of listeners) listen()
}

/** The BCP 47 tag for the language in force — what `toLocaleDateString` wants. */
export function getLocale(lang = current) {
  return LOCALES[lang] ?? LOCALES[FALLBACK]
}

/** Applies the stored language to `<html>` without changing it. */
export function applyLanguage() {
  document.documentElement.lang = current
}

/**
 * `const t = useT()` — the translator, plus a re-render whenever the language
 * changes.
 */
export function useT() {
  const [, force] = useState(0)

  useEffect(() => {
    const listen = () => force((n) => n + 1)
    listeners.add(listen)
    return () => listeners.delete(listen)
  }, [])

  return translate
}

/** The current language and a setter, for the settings panel. */
export function useLanguage() {
  const [lang, setLang] = useState(current)

  useEffect(() => {
    const listen = () => setLang(current)
    listeners.add(listen)
    return () => listeners.delete(listen)
  }, [])

  return [lang, setLanguage]
}
