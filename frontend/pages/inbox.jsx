import Head from 'next/head'
import styles from '../styles/Inbox.module.css'

export default function InboxPage() {
  return (
    <>
      <Head><title>Диалогтар — AIReca</title></Head>
      <div className={styles.page} aria-label="Диалогтар беті" />
    </>
  )
}
