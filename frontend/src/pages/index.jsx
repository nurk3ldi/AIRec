import Head from 'next/head'
import Link from 'next/link'
import styles from '../styles/Home.module.css'

export default function LandingPage() {
  return (
    <>
      <Head>
        <title>AIRec</title>
        <meta
          name="description"
          content="AIRec — AI-администратор, который общается с клиентами и записывает их на приём."
        />
      </Head>
      <main className={styles.page}>
        <div className="mx-auto flex max-w-[860px] flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32">
          <h1 className="font-display text-[36px] font-semibold leading-[1.15] tracking-[-0.02em] text-[#171215] sm:text-[48px] lg:text-[56px]">
            Your AI receptionist that answers, chats, and books appointments — 24/7
          </h1>

          <p className="max-w-[560px] text-[16px] text-[#999999] sm:text-[18px]">
            AIRec talks to your clients, answers their questions, and schedules
            appointments automatically — so you never lose a lead.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-[#3248F2] px-6 py-3 text-[15px] font-medium text-white shadow-[0_8px_22px_rgba(50,72,242,0.25)] transition-colors hover:bg-[#2839c9]"
            >
              Get Started
            </Link>
            <Link
              href="#"
              className="rounded-lg border border-[#999999]/40 bg-white px-6 py-3 text-[15px] font-medium text-[#171215] transition-colors hover:bg-[#F6F8FA]"
            >
              Learn More
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
