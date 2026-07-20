import Head from 'next/head'
import styles from '../styles/Clients.module.css'

export default function ClientsPage() {
  return (
    <>
      <Head><title>Клиенты — AIReca</title></Head>
      <div className={styles.page} aria-label="Страница клиентов" />
    </>
  )
}
