import Head from 'next/head'
import styles from '../styles/Settings.module.css'

export default function SettingsPage() {
  return (
    <>
      <Head><title>Баптаулар — AIReca</title></Head>
      <div className={styles.page} aria-label="Баптаулар беті" />
    </>
  )
}
