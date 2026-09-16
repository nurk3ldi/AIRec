import { useEffect, useState } from 'react'
import {
  getAssistantModel,
  getBusiness,
  getTelegram,
  listConversations,
  updateBusiness,
} from '../../lib/api'
import { authed } from '../../lib/auth'
import { liveChats } from '../../lib/conversations'
import { useT } from '../../lib/i18n'
import { CARD_EDGE } from '../card'
import Switch from '../Switch'
import RobotFace from './RobotFace'

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
  const [enabled, setEnabled] = useState(undefined)

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
      authed(getBusiness)
        .then((value) => alive && setEnabled(value.assistant_enabled))
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

  return { bot, flows, model, enabled, setEnabled }
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
export default function AssistantCard({ limitReached = false, className = '' }) {
  const t = useT()
  const { bot, flows, model, enabled, setEnabled } = useAssistantState()

  // Optimistic: the switch moves under the finger, and a failed save puts it
  // back where the server still has it.
  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    authed((token) => updateBusiness(token, { assistant_enabled: next })).catch(() =>
      setEnabled(!next),
    )
  }

  const botName =
    bot === undefined ? '…' : bot ? `@${bot.bot_username ?? bot.bot_id}` : t('home.botNone')
  const modelOn = Boolean(model?.configured)
  // What «Модель» says: switched off by the owner outranks everything, since a
  // model with a key that has been told not to answer is not working.
  const modelState =
    model === undefined || enabled === undefined
      ? 'loading'
      : enabled === false
        ? 'paused'
        : modelOn
          ? 'on'
          : 'off'
  const MODEL_DOT = { loading: 'bg-muted', paused: 'bg-muted', on: 'bg-ok', off: 'bg-danger' }
  const MODEL_WORD = {
    loading: '…',
    paused: t('home.modelPaused'),
    on: t('home.modelOn'),
    off: t('home.modelOff'),
  }

  return (
    <section className={`${CARD_EDGE} flex flex-col items-center overflow-hidden p-4 ${className}`}>
      {/* Top row: the card's name, set exactly as «Лимит» is on the card beside
          it, and the switch that turns the assistant on or off for every client. */}
      <div className="flex w-full shrink-0 items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{t('home.assistant')}</h2>
        <Switch
          checked={Boolean(enabled)}
          disabled={enabled === undefined}
          onChange={toggle}
          label={t('home.assistantSwitch')}
        />
      </div>

      {/* The robot, alive: it looks about while the assistant works, powers
          down when switched off, and shows a spinner when the limit is used up.
          It takes what is left between the two rows, sized by that height. */}
      <div className="my-2 flex min-h-0 w-full flex-1 items-center justify-center">
        <RobotFace
          state={enabled === false ? 'off' : limitReached ? 'limit' : 'on'}
          className="h-full max-w-full"
        />
      </div>

      {/* Under it, one row of three: the bot, how many conversations are
          live, and whether the model can answer — each named above its value
          and parted from the next by a hairline. Each column is as wide as
          what it says and the leftover is shared, so a short number does not
          take a third of the row from the two words beside it. */}
      <dl className="flex w-full shrink-0 divide-x divide-card-edge text-center">
        <Stat label={t('home.bot')}>{botName}</Stat>
        <Stat label={t('home.flows')}>
          <span className="tabular-nums">{flows === undefined ? '…' : flows}</span>
        </Stat>
        <Stat label={t('home.model')}>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${MODEL_DOT[modelState]}`}
            />
            {MODEL_WORD[modelState]}
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
