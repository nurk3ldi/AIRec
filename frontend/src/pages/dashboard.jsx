import Head from 'next/head'
import styles from '../styles/Dashboard.module.css'

export default function DashboardHomePage() {
  return (
    <>
      <Head>
        <title>AIRec</title>
        <meta
          name="description"
          content="AIRec — AI-администратор, который общается с клиентами и записывает их на приём."
        />
      </Head>
      <div className={styles.page} aria-label="Главная страница" />
    </>
  )
}
