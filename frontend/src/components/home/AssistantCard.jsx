import { useEffect, useState } from 'react'
import {
  getAssistantModel,
  getTelegram,
  listConversations,
} from '../../lib/api'
import { authed } from '../../lib/auth'
import { liveChats } from '../../lib/conversations'
import { useT } from '../../lib/i18n'
import { CARD_EDGE } from '../card'

/** The panel's own rhythm for things that change while somebody is looking. */
const POLL_MS = 15000

/**
 * The three facts the card answers, each `undefined` until its first read.
 * Read together on mount and every 15 seconds while the tab is visible; a
 * failed read leaves the last answer on screen rather than blanking a line.
 */
function useAssistantState() {
  const [bot, setBot] = useState(undefined)
  const [flows, setFlows] = useState(undefined)
  const [model, setModel] = useState(undefined)

  useEffect(() => {
    let alive = true
    const read = () => {
      authed(getTelegram)
        .then((value) => alive && setBot(value))
        .catch(() => {})
      authed((token) =>
        listConversations(token, { archived: false, deleted: false, limit: 100 }),
      )
        .then((rows) => alive && setFlows(liveChats(rows).length))
        .catch(() => {})
      authed(getAssistantModel)
        .then((value) => alive && setModel(value))
        .catch(() => {})
    }
    read()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') read()
    }, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  return { bot, flows, model }
}

/**
 * The assistant at a glance: the robot, and under it which bot it answers
 * through, how many conversations are going right now, and whether the model
 * behind it can answer at all.
 *
 * **«Потоки» are live conversations** — `liveChats`, the same fifteen-minute
 * window «Диалоги» uses — not every thread ever opened.
 *
 * **«Работает» means a key is set**, which is what the backend can say without
 * spending a request; a wrong key shows up the first time a reply fails.
 */
export default function AssistantCard({ className = '' }) {
  const t = useT()
  const { bot, flows, model } = useAssistantState()

  const botName =
    bot === undefined ? '…' : bot ? `@${bot.bot_username ?? bot.bot_id}` : t('home.botNone')
  const modelOn = Boolean(model?.configured)

  return (
    <section className={`${CARD_EDGE} flex flex-col overflow-hidden p-4 ${className}`}>
      {/* The robot takes what the three lines leave, centred and held to the
          top; `object-contain` so it is never cropped whatever the card's
          shape. */}
      <div className="flex min-h-0 flex-1 justify-center">
        <img
          src="/ai.png"
          alt=""
          draggable="false"
          className="h-full w-3/4 object-contain object-top select-none"
        />
      </div>

      <dl className="mt-3 flex shrink-0 flex-col divide-y divide-card-edge">
        <Row label={t('home.bot')} value={botName} />
        <Row label={t('home.flows')} value={flows === undefined ? '…' : flows} />
        <Row
          label={t('home.model')}
          value={
            model === undefined ? (
              '…'
            ) : (
              <span className="flex items-center justify-end gap-1.5">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${modelOn ? 'bg-ok' : 'bg-danger'}`}
                />
                {modelOn ? t('home.modelOn') : t('home.modelOff')}
              </span>
            )
          }
        />
      </dl>
    </section>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[14px] text-ink tabular-nums">
        {value}
      </dd>
    </div>
  )
}
