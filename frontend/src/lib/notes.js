import { getLocale } from './i18n'

/**
 * Что показать про заметку, у которой нет отдельного заголовка.
 *
 * **Заголовок — первая строка тела.** Так устроена и таблица: отдельная колонка
 * была бы вторым экземпляром того, что и так лежит в тексте, и разошлась бы с
 * ним при первой же правке этой строки. Здесь мы просто читаем текст так же,
 * как его читает человек: сверху вниз, и первое, что видно, — это название.
 */
const lines = (body) =>
  (body ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

/** Первая строка, или ничего — подпись подставляет вызывающий. */
export const noteTitle = (note) => lines(note?.body)[0] ?? ''

/** Всё, кроме первой строки, одной строкой. */
export const notePreview = (note) => lines(note?.body).slice(1).join(' ')

/**
 * Когда её последний раз трогали.
 *
 * Сегодняшняя — время, вчерашняя и старше — дата: в списке, отсортированном по
 * свежести, «23:45» у записи недельной давности говорит меньше, чем «29 авг».
 */
export function noteStamp(note) {
  const at = new Date(note.updated_at)
  const now = new Date()
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate()

  return sameDay
    ? at.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })
    : at.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })
}
