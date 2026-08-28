import { useT } from '../lib/i18n'
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
export default function AssistantPage() {
  const t = useT()

  return (
    // **A definite height, not a minimum**, so a card can be 100% of it — the
    // same chain `/appointments` uses and for the same reason: under a
    // `min-height` the cross size is indefinite, `h-full` inside resolves to
    // the content, and nothing fills anything. The numbers are the module's
    // own, written a second time as a real height; the two move together.
    <div
      className={`${styles.page} h-[calc(100vh-118px-env(safe-area-inset-bottom))] overflow-hidden sm:h-[calc(100vh-68px)]`}
      aria-label={t('nav.assistant')}
    >
      {/* Flush left rather than centred: the rail is already on that edge, so a
          centred column left a gutter between the navigation and the content
          that belonged to neither. */}
      {/* **A wrapping row, not a two-column grid.** A grid gives every card a
          share of the width whether it wants one or not, so two 350px cards in
          a 1100px grid sat half a screen apart with nothing between them. A
          flex row puts each at its own width, side by side, and drops the next
          one to a new line when the room runs out. */}
      <div className="flex h-full w-full flex-wrap content-start gap-6 p-4 sm:p-6">
        {/* **`surface-raised`, and no edge at all.** That token exists for
            exactly this: `surface` is the same black as the page on the dark
            theme, so a borderless card drawn in it is nothing — `surface-raised`
            is white here and a step up from black there, which is a fill that
            separates a block from the ground on its own. The hairline these
            carried was the other way of doing it; a card can have one or the
            other, and two is an outline around a shape that already has an
            edge. */}
        <div className="h-full w-full max-w-[350px] rounded-2xl bg-surface-raised p-6" />

        {/* The second column, split in two down the height. `flex-1` on both
            rather than a fixed share, so the gap between them comes out of the
            column once instead of being subtracted from each half by hand. */}
        <div className="flex h-full w-full max-w-[350px] flex-col gap-6">
          <div className="min-h-0 flex-1 rounded-2xl bg-surface-raised p-6" />
          <div className="min-h-0 flex-1 rounded-2xl bg-surface-raised p-6" />
        </div>

        {/* Everything that is left. `flex-1` takes the leftover of the row
            rather than a width of its own, so it is whatever the two fixed
            columns did not use; `min-w` is what stops it being squeezed to
            nothing on a narrow window — past that it wraps to its own line. */}
        <div className="h-full min-w-[320px] flex-1 rounded-2xl bg-surface-raised p-6" />
      </div>
    </div>
  )
}
