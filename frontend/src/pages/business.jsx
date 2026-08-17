import Head from 'next/head'
import BusinessProfile from '../components/business/BusinessProfile'
import styles from '../styles/Business.module.css'

/**
 * Everything the owner configures about how the receptionist works, on one
 * page: what the business is, what it sells, and when it is open.
 *
 * Kept as a real route rather than a profile-dialog section because this is
 * day-to-day work, not account admin — and because a service list, a schedule
 * and a staff roster don't fit in a 520px dialog.
 *
 * It had two tabs, «О бизнесе» and «ИИ-ассистент», and now has none. The second
 * was a placeholder, and a tab strip with one real destination is a control that
 * only ever says where you already are — it cost a row of chrome at the top of
 * every visit to offer a choice that did not exist. Whatever the assistant ends
 * up needing configured goes on this page as another card; if it grows enough to
 * need its own route, it can have one, which is a better answer than a tab.
 */
export default function BusinessPage() {
  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page} aria-label="Страница бизнеса">
        {/* Full-bleed: the content stretches to both edges of the shell rather
            than sitting in a centred column, so wide screens aren't mostly
            empty grey. */}
        <div className="px-6 py-6 sm:px-8">
          <BusinessProfile />
        </div>
      </div>
    </>
  )
}
