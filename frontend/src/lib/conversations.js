import { dayOf, fromMinutes, minutesOf } from './appointments'

/**
 * Что значит «сейчас» для разговора.
 *
 * **Окно, а не хранимый флаг.** «Активен» нельзя записать в базу: что-то должно
 * его снимать, а снимать некому — ветка, помеченная активной в два часа дня,
 * останется активной и в полночь. Бэкенд считает так же
 * (`conversation_active_minutes`), и число здесь то же.
 *
 * Живёт в `lib`, потому что на него смотрят две карточки главной сразу, а две
 * копии одного порога — это два порога, которые совпадают ровно до первой
 * правки одного из них.
 */

/** Сколько минут после последнего сообщения разговор считается идущим. */
export const ACTIVE_MINUTES = 15

export const minutesSince = (iso) =>
  (Date.now() - new Date(iso).getTime()) / 60000

/**
 * Идущие сейчас разговоры, самый свежий первым.
 *
 * Остывшие ветки отсекаются сами: у той, где час никто не писал, `minutesSince`
 * больше порога. Ветка без единого сообщения не идёт никуда — ей нечем быть
 * свежей.
 */
export function liveChats(rows) {
  return (rows ?? [])
    .filter((row) => row.last_message_at)
    .filter((row) => minutesSince(row.last_message_at) <= ACTIVE_MINUTES)
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
}

/**
 * Что происходит в одной ветке, одним словом.
 *
 * Три состояния, и они про разное: ассистент отвечает сам, ассистент ждёт
 * клиента, и человек уже вмешался. Четвёртого — «работает» — нет: это не то,
 * чем он занят, а то, что он включён, и такое сообщение не отличает занятого
 * ассистента от простаивающего.
 */
export function chatState(chat) {
  if (!chat) return 'idle'
  if (!chat.assistant_enabled) return 'human'
  return chat.awaiting_reply ? 'replying' : 'waiting'
}

/**
 * Нужен ли здесь человек.
 *
 * **Ровно один случай, и он читается из данных, а не выводится по времени:**
 * ассистент в этой ветке выключен, то есть кто-то уже отвечает руками и
 * разговор держится на нём. «Клиент ждёт слишком долго» сюда не входит — это
 * порог, который пришлось бы выдумать, а выдуманный порог красит строки в
 * тревожный цвет по расписанию, а не по делу.
 */
export const needsHuman = (chat) => Boolean(chat) && !chat.assistant_enabled

/** Только цифры номера — по ним и сходятся запись с перепиской. */
const digits = (value) => (value ?? '').replace(/\D/g, '')

/**
 * История: переписка и то, о чём в ней договорились, одной строкой.
 *
 * **«Все чаты» — это история, а не список записей.** Разговор, пришедший из
 * бота, попадает сюда и остаётся здесь навсегда: договорились о времени или
 * нет, дошло дело до записи или человек просто спросил — переписка была, и
 * найти её потом можно только отсюда. Поэтому строку заводит *чат*, а запись к
 * ней прикладывается, а не наоборот.
 *
 * **Запись без чата — тоже строка.** Владелец записывает людей и руками, с
 * телефона в руке; такая запись переписки не имеет и не должна из-за этого
 * исчезать из истории.
 *
 * **Сходятся по цифрам номера.** Имя пишут по-разному, `@username` есть не у
 * всех, а номер — то немногое, что у обеих сторон одно и то же; `digits`
 * снимает скобки и пробелы, которыми его набирают. У кого номера нет (телеграм
 * отдаёт его, только если клиент сам поделился карточкой) — просто не сойдётся,
 * и это честнее, чем сводить по имени.
 *
 * **Если записей у клиента несколько, берётся последняя.** Строка одна на
 * человека, и вопрос, на который она отвечает, — «когда он был у нас в
 * последний раз»; вся остальная история его посещений живёт в календаре.
 *
 * Сортировка — по свежести: сверху то, что происходило только что, будь то
 * сообщение или час записи.
 */
export function historyRows({
  chats,
  blocks,
  timeZone,
  noName = '',
  // **Запись без переписки — тоже строка, но только в самой истории.** В
  // архиве и корзине лежат разговоры: запись туда никто не убирал, и показать
  // её там значило бы сказать, что убрали. Записи, у которых чат есть,
  // прикладываются к строке в любом случае — убранная переписка не перестаёт
  // быть перепиской с тем, кто приходил.
  loneBookings = true,
} = {}) {
  const byPhone = new Map()
  for (const block of blocks ?? []) {
    const key = digits(block.phone)
    if (!key) continue
    const kept = byPhone.get(key)
    if (!kept || new Date(block.startsAt) > new Date(kept.startsAt)) {
      byPhone.set(key, block)
    }
  }

  const taken = new Set()
  const rows = (chats ?? []).map((chat) => {
    const key = digits(chat.client_phone)
    const block = key ? byPhone.get(key) : undefined
    if (block) taken.add(block.id)

    const name =
      chat.client_name ||
      (chat.client_username ? `@${chat.client_username}` : null) ||
      chat.client_phone ||
      noName

    return {
      // Ключ строки — чат: он и есть то, что здесь хранится, а запись к нему
      // может смениться на следующую.
      id: `chat-${chat.id}`,
      // Чем открывается тред: у строки, заведённой перепиской, он есть всегда,
      // у записи без чата — нет, и открывать там нечего.
      chatId: chat.id,
      // Где сейчас лежит переписка: меню строки предлагает либо убрать, либо
      // вернуть, и решает это по тому, что уже сделано.
      archived: Boolean(chat.archived),
      deleted: Boolean(chat.deleted),
      client: name,
      phone: chat.client_phone ?? block?.phone ?? null,
      range: block?.range ?? null,
      service: block?.service ?? null,
      at: block
        ? maxMoment(chat.last_message_at, block.startsAt)
        : (chat.last_message_at ?? null),
      // **У строки всегда есть день и час — либо записи, либо переписки.**
      // Столбцы «Дата» и «Время» спрашивают «когда это было», и у разговора без
      // записи ответ есть: когда написали. Фильтр над таблицей читает те же два
      // поля, поэтому диапазон дат не выбрасывает чаты только за то, что
      // записи у них нет.
      date: block?.day ?? momentDay(chat.last_message_at, timeZone),
      time: block?.from ?? momentClock(chat.last_message_at, timeZone),
    }
  })

  for (const block of loneBookings ? (blocks ?? []) : []) {
    if (taken.has(block.id)) continue
    rows.push({
      id: `booking-${block.id}`,
      chatId: null,
      archived: false,
      deleted: false,
      client: block.client,
      phone: block.phone ?? null,
      range: block.range,
      service: block.service,
      at: block.startsAt,
      date: block.day,
      time: block.from,
    })
  }

  return rows.sort((a, b) => new Date(b.at ?? 0) - new Date(a.at ?? 0))
}

/** День и час отметки времени в зоне бизнеса; `null`, если отметки нет. */
const momentDay = (iso, timeZone) => (iso ? dayOf(iso, timeZone) : null)
const momentClock = (iso, timeZone) =>
  iso ? fromMinutes(minutesOf(iso, timeZone)) : null

/** Та из двух отметок времени, что позже; `null` не мешает. */
const maxMoment = (left, right) =>
  new Date(left ?? 0) > new Date(right ?? 0) ? (left ?? right) : (right ?? left)
