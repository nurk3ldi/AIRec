import { useState } from 'react'
import Head from 'next/head'
import BusinessProfile from '../components/business/BusinessProfile'
import Card from '../components/business/Card'
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
  { id: 'profile', label: 'О бизнесе' },
  { id: 'ai', label: 'ИИ-ассистент' },
]

export default function BusinessPage() {
  const [activeId, setActiveId] = useState(TABS[0].id)

  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page} aria-label="Страница бизнеса">
        <div className="mx-auto max-w-[980px] px-6 py-6 sm:px-8">
          <div role="tablist" aria-label="Разделы бизнеса" className="flex items-center gap-1">
            {TABS.map((tab) => {
              const isActive = tab.id === activeId
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveId(tab.id)}
                  // A filled pill rather than an underline: there's no card
                  // border for an underline to sit against on this ground.
                  className={`rounded-lg px-3.5 py-2 text-[14px] font-medium outline-none transition-colors ${
                    isActive
                      ? 'bg-white text-[#171215]'
                      : 'text-[#999999] hover:text-[#171215]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div role="tabpanel" className="mt-6">
            {activeId === 'profile' ? (
              <BusinessProfile />
            ) : (
              <Card>
                <ComingSoon>
                  Здесь настраиваются тон и язык ассистента, база ответов и
                  правила передачи диалога человеку.
                </ComingSoon>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
