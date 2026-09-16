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
    <section className={`${CARD_EDGE} flex flex-col items-center overflow-hidden p-4 ${className}`}>
      {/* The robot at three quarters of the card, centred and held to the
          top; `object-contain` so it is never cropped whatever the card's
          shape. */}
      <img
        src="/ai.png"
        alt=""
        draggable="false"
        className="h-3/4 w-3/4 object-contain object-top select-none"
      />

      {/* Under it, one row of three: the bot, how many conversations are
          live, and whether the model can answer — each named above its value
          and parted from the next by a hairline. Each column is as wide as
          what it says and the leftover is shared, so a short number does not
          take a third of the row from the two words beside it. */}
      <dl className="mt-3 flex w-full divide-x divide-card-edge text-center">
        <Stat label={t('home.bot')}>{botName}</Stat>
        <Stat label={t('home.flows')}>
          <span className="tabular-nums">{flows === undefined ? '…' : flows}</span>
        </Stat>
        <Stat label={t('home.model')}>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                model === undefined ? 'bg-muted' : modelOn ? 'bg-ok' : 'bg-danger'
              }`}
            />
            {model === undefined ? '…' : modelOn ? t('home.modelOn') : t('home.modelOff')}
          </span>
        </Stat>
      </dl>
    </section>
  )
}

function Stat({ label, children }) {
  return (
    <div className="flex min-w-0 flex-auto flex-col gap-1 px-2">
      <dt className="truncate text-[12px] text-muted">{label}</dt>
      <dd className="truncate text-[14px] font-medium text-ink">{children}</dd>
    </div>
  )
}
