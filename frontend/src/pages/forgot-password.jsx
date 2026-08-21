import { useEffect, useState } from 'react'
import { forgotPassword } from '../lib/api'
import { useRedirectIfAuthed } from '../lib/auth'
import { useT } from '../lib/i18n'
import { BUTTON_PRIMARY, FIELD, FIELD_ERROR } from '../components/controls'
import styles from '../styles/ForgotPassword.module.css'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

export default function ForgotPasswordPage() {
  const t = useT()
  useRedirectIfAuthed()

  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const emailHasSpace = /\s/.test(email)

  useEffect(() => {
    // Prefills when arriving via reset-password.jsx's "Wrong email?" link.
    // No `isReady` guard any more: Next deferred the query until client-side
    // routing settled, but a router that lives entirely in the browser has the
    // search string on the very first render.
    const email = params.get('email')
    if (email) setEmail(email)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await forgotPassword(email)
      navigate(
        `/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`
      )
    } catch (err) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page} aria-label={t('forgot.aria')}>
      <div className="m-auto flex w-full max-w-[360px] flex-col px-4 py-10 sm:py-16">
        <h1 className="text-center font-display text-[32px] leading-10 font-semibold tracking-[-0.04em] text-ink">
          {t('forgot.title')}
        </h1>
        {/* The one line of explanation this flow needs, under the heading rather
            than beside the field: it describes what pressing the button does,
            not what to type. */}
        <p className="mt-2 text-center text-[14px] text-muted">
          {t('forgot.lead')}
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-2.5">
          <div>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('forgot.email')}
              autoComplete="email"
              autoFocus
              className={emailHasSpace ? FIELD_ERROR : FIELD}
            />
            {emailHasSpace && (
              <p className="mt-1.5 text-[13px] text-danger">{t('form.noSpaces')}</p>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-1 text-[13px] text-danger">
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className={`${BUTTON_PRIMARY} mt-2.5`}>
            {t(isSubmitting ? 'forgot.submitting' : 'forgot.submit')}
          </button>
        </form>

        <p className="mt-8 text-center text-[14px] text-muted">
          {t('forgot.remembered')}{' '}
          <Link to="/login" className="text-ink underline-offset-2 hover:underline">
            {t('forgot.login')}
          </Link>
        </p>
      </div>
    </div>
  )
}
