import BusinessProfile from '../components/business/BusinessProfile'
import Card from '../components/business/Card'
import styles from '../styles/Business.module.css'

/**
 * Everything the owner configures about how the receptionist works, on one
 * page: what the business is, its state in four numbers, what it sells, and
 * when it is open.
 *
 * It had two tabs, «О бизнесе» and «ИИ-ассистент», and now has none. The second
 * was a placeholder, and a tab strip with one real destination is a control that
 * only ever says where you already are — it cost a row of chrome at the top of
 * every visit to offer a choice that did not exist.
 *
 * It also had a second placeholder, «Настройка бизнеса», which has been dropped:
 * the profile card *is* the business setup, so the empty box was promising a
 * screen that already exists a few hundred pixels above it. One placeholder is
 * left, and it no longer sits alone at the bottom of the page — it fills out the
 * narrow column beside «Состояние», where an empty box reads as somewhere
 * content is going rather than as work abandoned.
 */
export default function BusinessPage() {
  return (
    <div className={styles.page} aria-label="Страница бизнеса">
      {/* Full-bleed: the content stretches to both edges of the shell rather
          than sitting in a centred column, so wide screens aren't mostly
          empty grey. */}
      <div className="px-4 pt-4 pb-6">
        <BusinessProfile
          trailing={
            // `flex-1` so it takes whatever height «Состояние» leaves rather
            // than collapsing to its own heading, which would read as a card
            // that failed to load. The floor is for narrow screens, where the
            // column is not stretched by anything.
            <Card title="Настройка ИИ" className="min-h-[160px] flex-1" />
          }
        />
      </div>
    </div>
  )
}
