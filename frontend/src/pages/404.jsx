import { Link } from 'react-router-dom'
import { useT } from '../lib/i18n'

/**
 * Next.js served a built-in page for unmatched URLs; a router has none, so this
 * is the first time the app has actually had one written.
 */
export default function NotFoundPage() {
  const t = useT()

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6">
      <div className="text-center">
        {/* Tracking tightens as the type grows: letters read further apart at
            larger sizes, so the largest thing in the app needs the tightest
            value in it. At `-0.03em` this 64px number was set *looser* than the
            32px headings on the auth pages, which is the rule inverted. */}
        <p className="font-display text-[64px] leading-none font-semibold tracking-[-0.045em] text-accent">
          404
        </p>
        <h1 className="font-display mt-6 text-[24px] font-semibold tracking-[-0.02em] text-ink">
          {t('notFound.title')}
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          {t('notFound.lead')}
        </p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-lg bg-accent px-5 py-2.5 text-[14px] font-medium text-surface transition-colors hover:bg-accent-strong"
        >
          {t('notFound.home')}
        </Link>
      </div>
    </div>
  )
}
