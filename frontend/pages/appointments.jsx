import Head from 'next/head'
import styles from '../styles/Appointments.module.css'

export default function AppointmentsPage() {
  return (
    <>
      <Head><title>Записи — AIReca</title></Head>
      <div className={styles.page} aria-label="Страница записей" />
    </>
  )
}
