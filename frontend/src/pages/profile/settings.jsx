import Head from 'next/head'
import ComingSoon from '../../components/ComingSoon'
import ProfileSection from '../../components/ProfileSection'
import styles from '../../styles/Profile.module.css'

export default function GeneralSettingsPage() {
  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page}>
        <ProfileSection
          title="Settings"
          description="App preferences, notifications, and integrations"
        >
          <ComingSoon>
            Language, notification preferences, connected channels, and other
            app-wide options will live here.
          </ComingSoon>
        </ProfileSection>
      </div>
    </>
  )
}
