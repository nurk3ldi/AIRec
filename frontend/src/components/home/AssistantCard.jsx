import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
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
import { ASSISTANT_ICON } from '../navigation'

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
export default function AssistantCard({ className = '' }) {
  const t = useT()
  const navigate = useNavigate()
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

  return (
    <section className={`${CARD_EDGE} flex flex-col items-center overflow-hidden p-4 ${className}`}>
      {/* Top row: the way to the assistant's own screen on the left, and the
          switch that turns it on or off for every client on the right. */}
      <div className="flex w-full shrink-0 items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate('/assistant')}
          className="flex h-8 items-center gap-1.5 rounded-full bg-ink/8 pr-3 pl-2.5 text-[13px] font-medium text-ink outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-ink/12 focus-visible:bg-ink/12 active:scale-[0.97]"
        >
          <HugeiconsIcon icon={ASSISTANT_ICON} size={15} strokeWidth={2} />
          {t('home.assistant')}
        </button>
        <Switch
          checked={Boolean(enabled)}
          disabled={enabled === undefined}
          onChange={toggle}
          label={t('home.assistantSwitch')}
        />
      </div>

      {/* The robot, smaller now that the row above shares the card: it takes
          what is left between the two rows, centred, never cropped. */}
      <img
        src="/ai.png"
        alt=""
        draggable="false"
        className={`my-2 min-h-0 w-3/5 flex-1 object-contain transition-opacity duration-200 select-none ${
          enabled === false ? 'opacity-40' : ''
        }`}
      />

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

/**
 * An on/off switch that slides, the way iOS draws one: a pill track with a
 * round thumb that travels to the side it means. `role="switch"` with
 * `aria-checked`, so it is announced as the control it looks like. On is the
 * solid ink track with a surface thumb (white on black, black on white), off
 * is the quiet `ink/15` track.
 */
function Switch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`touch-target relative h-[26px] w-[44px] shrink-0 rounded-full outline-none transition-[background-color,scale] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ink/30 active:scale-95 disabled:opacity-50 ${
        checked ? 'bg-ink' : 'bg-ink/15'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[3px] left-[3px] h-5 w-5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[translate,background-color] duration-200 ease-out motion-reduce:transition-none ${
          checked ? 'translate-x-[18px] bg-surface' : 'translate-x-0 bg-white'
        }`}
      />
    </button>
  )
}
