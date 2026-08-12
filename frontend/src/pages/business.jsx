import { useState } from 'react'
import Head from 'next/head'
import ComingSoon from '../components/ComingSoon'
import styles from '../styles/Business.module.css'

/**
 * Everything the owner configures about how the receptionist works, in one
 * place: what the business offers, and how the assistant talks about it.
 *
 * Kept as a real route rather than a profile-dialog section because this is
 * day-to-day work, not account admin — and because a service list, a schedule
 * and a staff roster don't fit in a 520px dialog.
 */
const TABS = [
  {
    id: 'profile',
    label: 'О бизнесе',
    placeholder:
      'Здесь будут услуги и цены, график работы, филиалы и сотрудники — всё, из чего ассистент собирает ответ клиенту.',
  },
  {
    id: 'ai',
    label: 'ИИ-ассистент',
    placeholder:
      'Здесь настраиваются тон и язык ассистента, база ответов и правила передачи диалога человеку.',
  },
]

export default function BusinessPage() {
  const [activeId, setActiveId] = useState(TABS[0].id)
  const active = TABS.find((tab) => tab.id === activeId) ?? TABS[0]

  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page} aria-label="Страница бизнеса">
        <div className="mx-auto max-w-[880px] px-6 py-8">
          <div
            role="tablist"
            aria-label="Разделы бизнеса"
            className="flex items-center gap-1 border-b border-[#999999]/25"
          >
            {TABS.map((tab) => {
              const isActive = tab.id === activeId
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveId(tab.id)}
                  // The underline sits on the button and overlaps the container's
                  // border, so the active tab reads as connected to its panel.
                  className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] font-medium outline-none transition-colors ${
                    isActive
                      ? 'border-[#3248F2] text-[#171215]'
                      : 'border-transparent text-[#999999] hover:text-[#171215]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div role="tabpanel" className="mt-6 rounded-2xl bg-white p-6">
            <ComingSoon>{active.placeholder}</ComingSoon>
          </div>
        </div>
      </div>
    </>
  )
}
