import styles from '../styles/Home.module.css'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <>
      <main className={styles.page}>
        <div className="mx-auto flex max-w-[860px] flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32">
          <h1 className="font-display text-[36px] font-semibold leading-[1.15] tracking-[-0.02em] text-[#171215] sm:text-[48px] lg:text-[56px]">
            ИИ-администратор, который отвечает клиентам и записывает их на
            приём — 24/7
          </h1>

          <p className="max-w-[560px] text-[16px] text-[#999999] sm:text-[18px]">
            AIRec общается с клиентами, отвечает на их вопросы и записывает на
            приём автоматически — вы не потеряете ни одного обращения.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/signup"
              className="rounded-lg bg-[#3248F2] px-6 py-3 text-[15px] font-medium text-white shadow-[0_8px_22px_rgba(50,72,242,0.25)] transition-colors hover:bg-[#2839c9]"
            >
              Начать
            </Link>
            <Link
              to="#"
              className="rounded-lg border border-[#999999]/40 bg-white px-6 py-3 text-[15px] font-medium text-[#171215] transition-colors hover:bg-[#F6F8FA]"
            >
              Подробнее
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
