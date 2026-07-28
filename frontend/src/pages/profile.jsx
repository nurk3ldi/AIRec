import Head from 'next/head'
import styles from '../styles/Profile.module.css'

export default function ProfilePage() {
  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page} aria-label="Страница профиля" />
    </>
  )
}
