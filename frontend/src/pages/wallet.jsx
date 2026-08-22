import { HugeiconsIcon } from '@hugeicons/react'
import { Wallet01Icon } from '@hugeicons/core-free-icons'
import { useT } from '../lib/i18n'
import styles from '../styles/Wallet.module.css'

/**
 * «Кошелёк» — reachable only from the header, beside the bell.
 *
 * Not in `NAVIGATION`, and deliberately: the bottom bar's five slots are full,
 * and money is not one of the four screens the day is spent moving between. It
 * sits next to notifications for the same reason that one does — both are
 * things you check, not places you work.
 *
 * The empty state is worded in the future tense on purpose. There is no balance
 * to show because there is no payments backend yet: no table, no top-ups, no
 * subscription charges. Printing «0 ₸» would be inventing a number rather than
 * reporting one, so the page says what will be here instead of pretending it
 * already is.
 */
export default function WalletPage() {
  const t = useT()

  return (
    <div className={styles.page} aria-label={t('wallet.aria')}>
      <div className="mx-auto max-w-[440px] px-6 py-24 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface text-muted">
          <HugeiconsIcon
            icon={Wallet01Icon}
            size={24}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.9}
          />
        </div>

        <p className="mt-4 text-[15px] font-medium text-ink">{t('wallet.empty')}</p>
        <p className="mt-1.5 text-[14px] text-muted">{t('wallet.emptyLead')}</p>
      </div>
    </div>
  )
}
