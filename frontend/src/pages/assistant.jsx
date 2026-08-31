import { useEffect, useState } from 'react'
import { getBusiness, getServices, getWorkingHours } from '../lib/api'
import { authed } from '../lib/auth'
import { useT } from '../lib/i18n'
import BusinessCard from '../components/assistant/BusinessCard'
import ServicesCard from '../components/assistant/ServicesCard'
import SettingsCard from '../components/assistant/SettingsCard'
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
 * How tall a card that has nothing in it yet should still be — **on a desktop
 * only**.
 *
 * The viewport, less the chrome and the page's own padding, written as a
 * *minimum*: at rest the cards fill the screen, and a card that unfolds can
 * still grow past it and push what is under it down, which a fixed height gave
 * it nowhere to do. The `3rem` is the row's own `sm:p-6`, counted top and
 * bottom.
 *
 * **Below `sm` there is no minimum at all**, and that is the whole of the phone
 * layout's arithmetic. The number exists to make three columns of different
 * content end on one line; stacked into a single column it is not a floor but a
 * quota — four cards each as tall as the screen, three of them mostly empty,
 * and two thousand pixels of scrolling to reach the last one. On a phone a card
 * is as tall as what is in it.
 */
const FULL = 'sm:min-h-[calc(100vh-68px-3rem)]'

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
      {/* **The phone's title, in the flow rather than pinned.** Below `sm` this
          screen draws no header (see `DashboardLayout`), so this is the only
          thing that says where you are — and being part of the page, it scrolls
          away once you are past it instead of holding 68px for the rest of the
          visit. That is Apple's large title, minus the compact one that takes
          over in the bar, because there is no bar here to hand it to.

          The inset is added rather than assumed: 0 in a browser tab, where the
          status bar is the browser's own chrome and outside the viewport
          already; the notch's height once this is installed. */}
      <h1 className="px-4 pt-[calc(1rem+env(safe-area-inset-top))] font-display text-[28px] leading-tight font-bold tracking-[-0.02em] text-ink sm:hidden">
        {t('nav.assistant')}
      </h1>

      <div className="flex w-full flex-wrap content-start gap-4 p-4 pt-3 sm:gap-6 sm:p-6">
        {/* The first column, split in two down the height. `flex-1` on both
            rather than a fixed share, so the gap between them comes out of the
            column once instead of being subtracted from each half by hand. */}
        <div className={`flex w-full flex-col gap-4 sm:max-w-[350px] sm:gap-6 ${FULL}`}>
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
        <BusinessCard
          business={business}
          onSaved={() => setReload((n) => n + 1)}
          className={`w-full sm:max-w-[350px] ${FULL}`}
        />

        {/* Everything that is left. `flex-1` takes the leftover of the row
            rather than a width of its own, so it is whatever the two fixed
            columns did not use; `min-w` is what stops it being squeezed to
            nothing on a narrow window — past that it wraps to its own line. */}
        <SettingsCard
          business={business}
          onSaved={() => setReload((n) => n + 1)}
          className={`w-full sm:min-w-[320px] sm:flex-1 ${FULL}`}
        />
      </div>
    </div>
  )
}
