import { useEffect, useState } from 'react'
import { getBusiness, getServices, getWorkingHours } from '../lib/api'
import { authed } from '../lib/auth'
import { useT } from '../lib/i18n'
import BusinessCard from '../components/assistant/BusinessCard'
import ServicesCard from '../components/assistant/ServicesCard'
import HoursCard from '../components/assistant/HoursCard'
import styles from '../styles/Assistant.module.css'

/**
 * Ассистент — что он знает и как отвечает.
 *
 * Пока здесь стоит одна пустая карточка, слева сверху: место под профиль
 * бизнеса, чтобы посмотреть на раскладку прежде, чем в неё что-то класть.
 *
 * **Содержимое уже написано и ждёт** в `components/assistant/` —
 * `BusinessCard` (`GET/PATCH /business`), `ServicesCard`
 * (`GET/PUT /business/services`) и `HoursCard`
 * (`GET/PUT /business/working-hours`). Каждая со своей кнопкой «Сохранить»,
 * потому что делятся они по шву в данных: три эндпоинта — три запроса, и одна
 * общая кнопка оставила бы страницу сохранённой наполовину, если бы упал один.
 *
 * **Бэкенд не переименован, и это не упущение.** `Business` — это сам салон:
 * часовой пояс, вместимость, услуги, часы работы. Ассистент их *читает*, но не
 * является ими. Переименовали экран, а не сущность.
 */
/**
 * How tall a card that has nothing in it yet should still be.
 *
 * **The viewport, less the chrome and the page's own padding** — the same sum
 * the definite height used to be, written as a *minimum* instead. That is the
 * whole difference: at rest the cards fill the screen exactly as they did, and
 * a card that unfolds can still grow past it and push what is under it down,
 * which a fixed height gave it nowhere to do.
 *
 * 118px below `sm` is the 68px header plus the 50px bottom bar; from `sm` the
 * bar is gone. The `2rem`/`3rem` are the row's own `p-4` / `sm:p-6`, counted
 * top and bottom.
 */
const FULL =
  'min-h-[calc(100vh-118px-env(safe-area-inset-bottom)-2rem)] sm:min-h-[calc(100vh-68px-3rem)]'

export default function AssistantPage() {
  const t = useT()
  const [business, setBusiness] = useState(null)
  const [services, setServices] = useState(null)
  const [week, setWeek] = useState(null)
  // Bumped after a save. A counter rather than a boolean: two saves in a row
  // have to be two reloads, and `true → true` is no change at all.
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    authed(getBusiness)
      .then((row) => alive && setBusiness(row))
      .catch(() => {})
    authed(getServices)
      .then((rows) => alive && setServices(rows))
      // Swallowed: the card draws its empty state, which is also what a
      // business that has never added a service looks like.
      .catch(() => {})
    authed(getWorkingHours)
      .then((rows) => alive && setWeek(rows))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [reload])

  return (
    // **A minimum height, and the page scrolls.** It carried a definite one so
    // a card could be 100% of it — but a card that unfolds has to be able to
    // push what is under it down, and inside a fixed viewport there is nowhere
    // for it to go. The empty placeholders keep their own `min-h`, so the
    // layout still reads while there is nothing in them.
    <div className={styles.page} aria-label={t('nav.assistant')}>
      {/* Flush left rather than centred: the rail is already on that edge, so a
          centred column left a gutter between the navigation and the content
          that belonged to neither. */}
      {/* **A wrapping row, not a two-column grid.** A grid gives every card a
          share of the width whether it wants one or not, so two 350px cards in
          a 1100px grid sat half a screen apart with nothing between them. A
          flex row puts each at its own width, side by side, and drops the next
          one to a new line when the room runs out. */}
      <div className="flex w-full flex-wrap content-start gap-6 p-4 sm:p-6">
        {/* The first column, split in two down the height. `flex-1` on both
            rather than a fixed share, so the gap between them comes out of the
            column once instead of being subtracted from each half by hand. */}
        <div className={`flex w-full max-w-[350px] flex-col gap-6 ${FULL}`}>
          <ServicesCard
            services={services}
            onSaved={() => setReload((n) => n + 1)}
          />
          <HoursCard week={week} onSaved={() => setReload((n) => n + 1)} />
        </div>

        {/* **`surface-raised`, and no edge at all.** That token exists for
            exactly this: `surface` is the same black as the page on the dark
            theme, so a borderless card drawn in it is nothing — `surface-raised`
            is white here and a step up from black there, which is a fill that
            separates a block from the ground on its own. The hairline these
            carried was the other way of doing it; a card can have one or the
            other, and two is an outline around a shape that already has an
            edge. */}
        <div className={`w-full max-w-[350px] ${FULL}`}>
          <BusinessCard
            business={business}
            onSaved={() => setReload((n) => n + 1)}
          />
        </div>

        {/* Everything that is left. `flex-1` takes the leftover of the row
            rather than a width of its own, so it is whatever the two fixed
            columns did not use; `min-w` is what stops it being squeezed to
            nothing on a narrow window — past that it wraps to its own line. */}
        {/* The assistant's own settings — how it answers, what it is allowed
            to do — go here. Only the heading for now, so the card says what it
            is for while the controls are still being decided. */}
        <div
          className={`min-w-[320px] flex-1 rounded-2xl bg-surface-raised p-6 ${FULL}`}
        >
          <h2 className="font-display text-[15px] font-semibold text-ink">
            {t('assistant.settings')}
          </h2>
        </div>
      </div>
    </div>
  )
}
