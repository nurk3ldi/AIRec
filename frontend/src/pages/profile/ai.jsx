import Head from 'next/head'
import ComingSoon from '../../components/ComingSoon'
import ProfileLayout from '../../components/ProfileLayout'
import styles from '../../styles/Profile.module.css'

export default function AiSettingsPage() {
  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page}>
        <ProfileLayout
          title="AI Assistant"
          description="How your assistant speaks, and what it knows"
        >
          <ComingSoon>
            Set the assistant&apos;s tone and language, build its answer base,
            and choose when a conversation hands off to a person.
          </ComingSoon>
        </ProfileLayout>
      </div>
    </>
  )
}
