import Head from 'next/head'
import ComingSoon from '../../components/ComingSoon'
import ProfileSection from '../../components/ProfileSection'
import styles from '../../styles/Profile.module.css'

export default function BusinessSettingsPage() {
  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page}>
        <ProfileSection
          title="Business"
          description="Company details, locations, and opening hours"
        >
          <ComingSoon>
            Company name, industry, locations, opening hours, services, and team
            members will be managed here.
          </ComingSoon>
        </ProfileSection>
      </div>
    </>
  )
}
