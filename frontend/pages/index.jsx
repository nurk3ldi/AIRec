import Head from 'next/head'
import styles from '../styles/Home.module.css'

export default function HomePage() {
  return (
    <>
      <Head>
        <title>AIReca</title>
        <meta
          name="description"
          content="AIReca — клиенттермен сөйлесетін және қабылдауға жазатын AI-администратор."
        />
      </Head>
      <div className={styles.page} aria-label="Басты бет" />
    </>
  )
}
