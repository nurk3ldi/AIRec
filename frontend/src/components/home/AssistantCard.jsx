import { useEffect, useState } from 'react'
import { getTelegram, listAppointments, listConversations } from '../../lib/api'
import { authed } from '../../lib/auth'
import { liveChats, needsHuman } from '../../lib/conversations'
import { dayKey } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import { useSkeleton } from '../../lib/skeleton'
import { CARD_EDGE } from '../card'
import Skeleton, { SkeletonRegion } from '../Skeleton'

/** Как часто карточка перечитывает себя — тот же ритм, что у «Диалогов». */
const POLL_MS = 15000

/**
 * Разговоров за одно чтение. Сервер отдаёт по 50, если не попросить больше, и
 * тогда счётчики на загруженном дне упирались бы в пятьдесят молча.
 */
const CHAT_LIMIT = 200

/**
 * «Ассистент» на главной: робот, его состояние и четыре числа о том, что
 * происходит сейчас.
 *
 * **Каждое число — из настоящих данных.** Аналитику на выдуманных цифрах уже
 * снимали с этого экрана целиком; здесь нет ни одного значения, которого нет в
 * базе, и ни одного «роста за неделю», для которого нет агрегирующего
 * эндпоинта.
 *
 * - **Состояние** — из подключения Telegram: не подключён; подключён, но
 *   сообщения не доходят (ни вебхука, ни опроса); работает. Второе — не
 *   «работает»: карточка, показывающая живой канал, который ничего не получает,
 *   врала бы.
 * - **Активные чаты** — `liveChats`, окно в 15 минут, как в «Потоках».
 * - **Отвечаете вы** — ветки, где ассистент выключен (`needsHuman`): разговор
 *   держится на человеке, и это единственное число здесь, ради которого стоит
 *   встать.
 * - **Непрочитанные** — ветки, а не сообщения, как считает и сервер.
 * - **Записи сегодня** — без отменённых: отмена вернула свой час.
 *
 * Архив и корзина в счёт не идут — это разобранное и убранное.
 */
export default function AssistantCard({ className = '' }) {
  const t = useT()
  // `undefined` — ещё не спросили, `null` — бот не подключён.
  const [telegram, setTelegram] = useState(undefined)
  const [chats, setChats] = useState(null)
  const [today, setToday] = useState(null)

  useEffect(() => {
    let alive = true

    const read = () => {
      authed(getTelegram)
        .then((row) => alive && setTelegram(row ?? null))
        .catch(() => alive && setTelegram(null))
      authed((token) =>
        listConversations(token, {
          archived: false,
          deleted: false,
          limit: CHAT_LIMIT,
        }),
      )
        .then((rows) => alive && setChats(rows))
        .catch(() => alive && setChats([]))
      const key = dayKey(new Date())
      authed((token) => listAppointments(token, { from: key, to: key }))
        .then((rows) => alive && setToday(rows))
        .catch(() => alive && setToday([]))
    }

    read()
    const timer = setInterval(read, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const loading = telegram === undefined || chats === null || today === null
  const { pending, bars, reveal } = useSkeleton(loading)

  const state = !telegram
    ? 'off'
    : telegram.webhook_active || telegram.polling
      ? 'on'
      : 'deaf'

  const metrics = pending
    ? []
    : [
        { key: 'live', value: liveChats(chats).length },
        { key: 'human', value: chats.filter(needsHuman).length },
        { key: 'unread', value: chats.filter((chat) => chat.unread_count > 0).length },
        {
          key: 'today',
          value: today.filter((row) => row.status !== 'cancelled').length,
        },
      ]

  return (
    <section
      aria-label={t('home.card.title')}
      className={`${CARD_EDGE} flex flex-col p-6 ${className}`}
    >
      {/* **Робот занимает всё, что осталось над числами**, а не долю высоты:
          карточка — половина экрана, и на высоком мониторе фиксированные 34%
          оставляли его маленьким посреди пустоты. Потолок в 200px — чтобы на
          очень высоком экране он не стал плакатом.
          `alt=""`: картинка декоративная, чья это карточка — сказано словом
          рядом. Знак белый на прозрачном — на светлой теме корпус пропадёт,
          тёмного варианта пока нет. */}
      <div className="flex min-h-0 flex-1 items-center gap-5">
        <img
          src="/ai.png"
          alt=""
          className="h-full max-h-[200px] w-auto min-w-0 object-contain"
        />
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-semibold text-ink">
            {t('home.card.title')}
          </h2>
          {pending ? (
            <SkeletonRegion visible={bars} label={t('home.card.title')}>
              <Skeleton className="mt-2 h-4 w-24 rounded-full" />
            </SkeletonRegion>
          ) : (
            <div className={reveal ? 'animate-content-reveal' : ''}>
              <p className="mt-1.5 flex items-center gap-2 text-[13px] text-ink">
                {/* Точка — сигнал, а не украшение: зелёный «работает», красный
                    «сообщения не доходят», серый «ещё не подключали». */}
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    state === 'on' ? 'bg-ok' : state === 'deaf' ? 'bg-danger' : 'bg-muted'
                  }`}
                />
                {t(`home.card.${state}`)}
              </p>
              {telegram?.bot_username && (
                <p className="mt-1 truncate text-[13px] text-muted">
                  @{telegram.bot_username}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* **Одна карточка, разделённая хайрлайнами на 2×2**, а не четыре
          карточки: четыре связанных числа — один предмет. */}
      <dl className="mt-5 grid shrink-0 grid-cols-2 border-t border-line">
        {['live', 'human', 'unread', 'today'].map((key, index) => {
          const metric = metrics.find((item) => item.key === key)
          return (
            <div
              key={key}
              className={`pt-4 ${index % 2 === 0 ? 'border-r border-line pr-4' : 'pl-4'} ${
                index >= 2 ? 'border-t border-line' : 'pb-4'
              }`}
            >
              <dt className="truncate text-[13px] text-muted">
                {t(`home.card.${key}`)}
              </dt>
              <dd className="mt-1">
                {metric ? (
                  <span
                    className={`block font-display text-[24px] leading-8 font-bold tracking-[-0.02em] text-ink ${
                      reveal ? 'animate-content-reveal' : ''
                    }`}
                  >
                    {metric.value}
                  </span>
                ) : (
                  <SkeletonRegion visible={bars} label={t(`home.card.${key}`)}>
                    <span className="flex h-8 items-center">
                      <Skeleton className="h-6 w-10" />
                    </span>
                  </SkeletonRegion>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
