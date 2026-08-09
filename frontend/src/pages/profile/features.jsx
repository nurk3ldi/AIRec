import Head from 'next/head'
import ComingSoon from '../../components/ComingSoon'
import ProfileLayout from '../../components/ProfileLayout'
import styles from '../../styles/Profile.module.css'

export default function FeatureSettingsPage() {
  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page}>
        <ProfileLayout
          title="Features"
          description="Optional modules and channel integrations"
        >
          <ComingSoon>
            Turn integrations like WhatsApp, Telegram, and Instagram on or off,
            along with individual product modules.
          </ComingSoon>
        </ProfileLayout>
      </div>
    </>
  )
}
