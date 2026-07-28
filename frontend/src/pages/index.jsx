import Head from 'next/head'
import styles from '../styles/Home.module.css'

export default function HomePage() {
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
