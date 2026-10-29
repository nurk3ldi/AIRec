import { Link } from 'react-router-dom'
import { useT } from '../lib/i18n'
import styles from '../styles/Home.module.css'

/**
 * The landing page, and on a phone the whole of it.
 *
 * Below the `sm` breakpoint the shell drops its header and this becomes a
 * splash: wordmark, one line saying what AIRec is, the way in, and the way in
 * for someone who has not been here before. Four things and nothing else,
 * centred in the viewport — the shape of an app's opening screen rather than of
 * a marketing page, because on a phone that is what someone arriving at a tool
 * they already use is looking for.
 *
 * Above `sm` the header is back and this is still an empty ground: the desktop
 * landing page is being designed separately, and the phone screen is not a
 * draft of it.
 */
export default function LandingPage() {
  const t = useT()

  return (
    <main className={styles.page} aria-label={t('landing.aria')}>
      <div className="m-auto flex w-full max-w-[420px] flex-col items-center px-8 text-center sm:hidden">
        {/* Set in the display face at a size nothing else on the screen comes
            near: on a splash the name is the picture. */}
        <p className="font-display text-[34px] font-semibold tracking-[-0.03em] text-ink">
          AIRec
        </p>

        {/* With a monochrome palette an accent hue cannot pick words out — the
            accent *is* the ink. So the sentence is muted and the four words
            that are the product are at full contrast: the emphasis is the same,
            carried by the two colours the project actually has. */}
        <h1 className="mt-6 text-[21px] leading-[1.35] font-semibold tracking-[-0.01em] text-muted">
          {t('landing.leadStart')}{' '}
          <span className="text-ink">{t('landing.leadEnd')}</span>.
        </h1>

        {/* Full width and fully round: the primary action on a phone should be
            a target you cannot miss, and 52px clears the 44px minimum with
            room to spare. */}
        <Link
          to="/login"
          className="mt-9 w-full rounded-full bg-accent py-[15px] text-[16px] font-semibold text-surface transition-colors hover:bg-accent-strong active:bg-accent-strong"
        >
          {t('landing.open')}
        </Link>

        <p className="mt-6 text-[15px] text-muted">
          <Link
            to="/login"
            className="font-semibold text-accent transition-opacity active:opacity-70"
          >
            {t('landing.login')}
          </Link>{' '}
          {t('landing.or')}{' '}
          <Link
            to="/signup"
            className="font-semibold text-accent transition-opacity active:opacity-70"
          >
            {t('landing.signup')}
          </Link>
        </p>
      </div>
    </main>
  )
}
