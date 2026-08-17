import Head from 'next/head'
import styles from '../styles/Appointments.module.css'

/**
 * Записи — blank, on purpose.
 *
 * The first version of this page is in `src/archive/appointments-v1/`, taken
 * out of the app on 2026-08-17 so a second one could be designed without the
 * first one's layout deciding anything. Its README says what it did and how to
 * put it back.
 *
 * White rather than the dashboard's `#F6F8FA`: there are no cards here yet, and
 * the grey ground only means something once something is sitting on it.
 */
export default function AppointmentsPage() {
  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page} aria-label="Страница записей" />
    </>
  )
}
