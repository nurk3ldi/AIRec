import Head from 'next/head'
import styles from '../styles/Analytics.module.css'

export default function AnalyticsPage() {
  return (
    <>
      <Head><title>AIRec</title></Head>
      <div className={styles.page} aria-label="Страница настроек" />
    </>
  )
}
