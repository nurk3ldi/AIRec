import { useT } from '../lib/i18n'

/** Placeholder body for settings sections whose backend doesn't exist yet. */
export default function ComingSoon({ children }) {
  const t = useT()

  return (
    <div className="py-16 text-center">
      <p className="text-[15px] font-medium text-ink">{t('comingSoon.title')}</p>
      <p className="mx-auto mt-1.5 max-w-[420px] text-[14px] text-muted">
        {children}
      </p>
    </div>
  )
}
