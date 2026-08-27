import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, EyeOffIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { login, restoreAccount } from '../lib/api'
import { saveTokens, useRedirectIfAuthed } from '../lib/auth'
import { useT } from '../lib/i18n'
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  FIELD,
  FIELD_ERROR,
} from '../components/controls'
import styles from '../styles/Login.module.css'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Sizes, spacing and field behaviour are measured off `vercel.com/login`.
 *
 * The one worth understanding is the field's edge: it is a
 * **`box-shadow: 0 0 0 1px`, not a `border`**. A shadow sits outside the box
 * model, so focus can thicken the ring and add a halo without the input growing
 * a pixel — with a real border every focus would nudge the whole form. Three
 * steps, each a token: resting, hover, focus, plus the 4px halo focus adds.
 *
 * The other measured values: a 320px column, a 32px heading at `-1.28px`
 * tracking, 40px controls, 16px text inside them, 12px of horizontal padding
 * and an 8px radius. 16px is also what keeps iOS Safari from zooming the page
 * when a field takes focus, so it is doing two jobs at once.
 */

// One recipe for every control on this page, so the inputs, the submit and the
// social buttons are the same object at different weights.
export default function LoginPage() {
  const t = useT()
  useRedirectIfAuthed()

  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // Ticked by default, unlike the usual convention, because this is a panel its
  // owner opens every morning — defaulting to off would sign them out every
  // night and read as a bug. The box is here for the other case: a borrowed or
  // shared computer, where someone will deliberately clear it.
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Set when the sign-in failed only because the account is inside its deletion
  // grace period — the credentials were right, so we can offer to undo it.
  const [canRestore, setCanRestore] = useState(false)

  const identifierHasSpace = /\s/.test(identifier)
  const passwordHasSpace = /\s/.test(password)
  const resetSuccess = params.get('reset') === 'success'
  const justDeleted = params.get('deleted') === '1'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setCanRestore(false)
    setIsSubmitting(true)

    try {
      const { tokens } = await login({ identifier, password, remember })
      saveTokens(tokens, { remember })
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
      setCanRestore(err.code === 'account_deleted')
      setIsSubmitting(false)
    }
  }

  const handleRestore = async () => {
    setError('')
    setIsSubmitting(true)
    try {
      const { tokens } = await restoreAccount({ identifier, password, remember })
      saveTokens(tokens, { remember })
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page} aria-label={t('login.aria')}>
      {/* 360px — wider than the reference's 320. Vercel's login is one email field —
          ours carries a login, a password with a toggle inside it, and a row of
          two controls under them, and at 320 that row runs out of room. */}
      <div className="m-auto flex w-full max-w-[360px] flex-col px-4 py-10 sm:py-16">
        <h1 className="text-center font-display text-[32px] leading-10 font-semibold tracking-[-0.04em] text-ink">
          {t('login.title')}
        </h1>

        {resetSuccess && (
          <p className="mt-8 rounded-lg px-3.5 py-2.5 text-center text-[14px] text-ok shadow-[0_0_0_1px_var(--color-ok)]">
            {t('login.resetOk')}
          </p>
        )}

        {justDeleted && (
          <p className="mt-8 rounded-lg px-3.5 py-2.5 text-center text-[14px] text-muted shadow-[0_0_0_1px_var(--color-field)]">
            {t('login.deleted')}
          </p>
        )}

        {/* 8px between the fields, 16px before anything that is not a field —
            opened up from the reference's `gap-2`: our form has more rows in it
            than a single email field, and at 8px they read as one block rather
            than as separate things to fill in. */}
        <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-2.5">
          <div>
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={t('login.identifier')}
              autoComplete="username"
              className={identifierHasSpace ? FIELD_ERROR : FIELD}
            />
            {identifierHasSpace && (
              <p className="mt-1.5 text-[13px] text-danger">{t('form.noSpaces')}</p>
            )}
          </div>

          <div>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('login.password')}
                autoComplete="current-password"
                className={`${passwordHasSpace ? FIELD_ERROR : FIELD} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={t(showPassword ? 'form.hidePassword' : 'form.showPassword')}
                className="absolute right-2.5 grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:text-ink"
              >
                <HugeiconsIcon
                  icon={showPassword ? EyeIcon : EyeOffIcon}
                  size={17}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                />
              </button>
            </div>
            {passwordHasSpace && (
              <p className="mt-1.5 text-[13px] text-danger">{t('form.noSpaces')}</p>
            )}
          </div>

          {/* One row, not two. Both controls carry `py-2 -my-2`: the padding
              grows the tap target, the negative margin takes it back out of the
              layout so the row stays its own height. */}
          <div className="mt-1 flex items-center justify-between gap-4">
            <label className="-my-2 flex cursor-pointer items-center gap-2.5 py-2 select-none">
              <span className="relative flex h-[16px] w-[16px] shrink-0">
                {/* A native checkbox with its paint stripped off rather than a
                    Radix one: space-to-toggle, form semantics and focus are
                    already right, and Radix is for behaviour that is hard. */}
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="peer h-full w-full cursor-pointer appearance-none rounded-[4px] bg-surface shadow-[0_0_0_1px_var(--color-field-hover)] transition-[background-color,box-shadow] duration-150 checked:bg-accent checked:shadow-none focus-visible:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)]"
                />
                <span className="pointer-events-none absolute inset-0 grid place-items-center text-surface opacity-0 transition-opacity peer-checked:opacity-100">
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={11}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3.2}
                  />
                </span>
              </span>
              <span className="text-[14px] text-muted">{t('login.remember')}</span>
            </label>

            <Link
              to="/forgot-password"
              className="-my-2 py-2 text-[14px] text-muted transition-colors hover:text-ink"
            >
              {t('login.forgot')}
            </Link>
          </div>

          {error && (
            <p role="alert" className="mt-1 text-[13px] text-danger">
              {error}
            </p>
          )}

          {/* The password was already accepted — the only thing standing in the
              way is the pending deletion, so undoing it is one click. */}
          {canRestore && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={isSubmitting}
              className={`${BUTTON_SECONDARY} mt-2.5`}
            >
              {t('login.restore')}
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`${BUTTON_PRIMARY} mt-2.5`}
          >
            {t(isSubmitting ? 'login.submitting' : 'login.submit')}
          </button>
        </form>

        {/* A labelled rule rather than a bare one: it says *why* the list below
            is separate instead of just separating it. */}
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[13px] text-muted">{t('form.or')}</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            className={`${BUTTON_SECONDARY} flex items-center justify-center gap-2`}
          >
            <img src="/google_logo.svg" alt="" className="h-4 w-4" aria-hidden="true" />
            {t('form.google')}
          </button>

          <button
            type="button"
            className={`${BUTTON_SECONDARY} flex items-center justify-center gap-2`}
          >
            {/* Apple's mark is solid black, so it disappears on the dark
                theme's black button — the white cut is the same file inverted.
                Google's is multicoloured and needs no counterpart. */}
            <img
              src="/apple_logo.svg"
              alt=""
              aria-hidden="true"
              className="h-4 w-4 dark:hidden"
            />
            <img
              src="/apple_logo_white.svg"
              alt=""
              aria-hidden="true"
              className="hidden h-4 w-4 dark:block"
            />
            {t('form.apple')}
          </button>
        </div>

        <p className="mt-8 text-center text-[14px] text-muted">
          {t('login.noAccount')}{' '}
          <Link to="/signup" className="text-ink underline-offset-2 hover:underline">
            {t('login.signup')}
          </Link>
        </p>
      </div>
    </div>
  )
}
