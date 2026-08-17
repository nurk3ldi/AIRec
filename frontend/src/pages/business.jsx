import Head from 'next/head'
import BusinessProfile from '../components/business/BusinessProfile'
import Card from '../components/business/Card'
import styles from '../styles/Business.module.css'

/**
 * Everything the owner configures about how the receptionist works, on one
 * page: what the business is, what it sells, when it is open — and, below that,
 * the two settings groups still to be built.
 *
 * It had two tabs, «О бизнесе» and «ИИ-ассистент», and now has none. The second
 * was a placeholder, and a tab strip with one real destination is a control that
 * only ever says where you already are — it cost a row of chrome at the top of
 * every visit to offer a choice that did not exist. As cards the same two
 * subjects sit in the page in the order they are read, and the empty one is
 * visibly empty rather than hidden behind a tab that has to be opened to find
 * that out.
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
            empty grey. The 16px inset matches `/appointments` — the frame a
            card sits in is the same on every page, so it cannot be one size
            here and another there. */}
        <div className="flex flex-col gap-6 px-4 pt-4 pb-6">
          <BusinessProfile />

          {/* Titles only for now. A floor height rather than no height at all:
              a card collapsed to its own heading reads as something that failed
              to load, where an empty box reads as somewhere content is going. */}
          <Card title="Настройка бизнеса" className="min-h-[160px]" />
          <Card title="Настройка ИИ" className="min-h-[160px]" />
        </div>
      </div>
    </>
  )
}
