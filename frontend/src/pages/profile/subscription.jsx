import Head from 'next/head'
import ComingSoon from '../../components/ComingSoon'
import ProfileLayout from '../../components/ProfileLayout'
import styles from '../../styles/Profile.module.css'

export default function SubscriptionSettingsPage() {
  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page}>
        <ProfileLayout
          title="Subscription"
          description="Your plan, usage limits, and billing history"
        >
          <ComingSoon>
            Your current plan, usage limits, payment method, and invoices will
            live here.
          </ComingSoon>
        </ProfileLayout>
      </div>
    </>
  )
}
