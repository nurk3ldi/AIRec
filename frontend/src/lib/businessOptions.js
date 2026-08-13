/**
 * Closed sets of values the business profile picks from.
 *
 * Cities live in `cities.js`; these are the shorter lists plus the time zones,
 * which come from the platform rather than a hand-written table.
 */

/** What a Kazakhstani business realistically accepts. */
export const PAYMENT_METHODS = [
  'Наличные',
  'Банковская карта',
  'Kaspi QR',
  'Kaspi перевод',
  'Halyk QR',
  'Перевод на счёт',
  'Apple Pay',
  'Google Pay',
  'Рассрочка',
]

/** Deliberately three: the languages the assistant will actually be asked to
 *  hold a conversation in. */
export const SERVICE_LANGUAGES = ['Қазақша', 'Русский', 'English']

/**
 * There is no time-zone picker, and that is the correct amount of choice.
 *
 * Kazakhstan ran on two zones until 1 March 2024, when the whole country moved
 * to UTC+5. Every Kazakh IANA id — Almaty, Aqtau, Aqtobe, Atyrau, Oral,
 * Qostanay, Qyzylorda — now resolves to the same offset, so a list of them
 * would be seven ways to pick the same answer. Offering all 418 world zones was
 * worse still: an owner in Shymkent has no business scrolling past Kathmandu.
 *
 * The column stays a free string on the backend, so a second country is a data
 * change here rather than a migration.
 */
export const DEFAULT_TIME_ZONE = 'Asia/Almaty'

const zoneLabels = new Map()

/**
 * "(UTC+05:00) Almaty" — offset first, then the city.
 *
 * The city is the last segment of the IANA id, which is unique across the whole
 * list (checked), so dropping the region loses nothing but noise. There is no
 * localised city name to be had: `Intl` will give you "Восточное поясное время"
 * for a zone, never "Алматы".
 */
export function timeZoneLabel(zone) {
  if (!zone) return ''
  if (!zoneLabels.has(zone)) {
    const city = zone.split('/').pop().replace(/_/g, ' ')
    let label = city
    try {
      const offset = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        // `longOffset` over `shortOffset` so every row is the same width and
        // the half-hour zones (UTC+05:45) still read correctly.
        timeZoneName: 'longOffset',
      })
        .formatToParts(new Date())
        .find((part) => part.type === 'timeZoneName')?.value
      if (offset) label = `(${offset.replace('GMT', 'UTC')}) ${city}`
    } catch {
      // An unknown zone keeps its bare name rather than breaking the list.
    }
    zoneLabels.set(zone, label)
  }
  return zoneLabels.get(zone)
}

