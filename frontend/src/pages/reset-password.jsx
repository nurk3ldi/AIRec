import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, EyeOffIcon } from '@hugeicons/core-free-icons'
import { forgotPassword, resetPassword } from '../lib/api'
import { useRedirectIfAuthed } from '../lib/auth'
import OtpInput from '../components/OtpInput'
import styles from '../styles/ResetPassword.module.css'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

const RESEND_COOLDOWN_SECONDS = 30

/**
 * The address the code was sent to comes from `?email=`, and without it this
 * page has nothing to confirm — so it sends you back to ask for one.
 *
 * This used to be `getServerSideProps`, and the reason was specific to Next:
 * for a page with no data fetching it deferred `router.query` until after
 * hydration, so reading the address on the client rendered a blank frame on
 * every hard load. A router that only ever runs in the browser has the search
 * string on the first render, so the guard is simply an early return now — and
 * the page no longer needs a server to render at all.
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const email = params.get('email')

  useRedirectIfAuthed()
  const navigate = useNavigate()

  if (!email) return <Navigate to="/forgot-password" replace />

  return <ResetPasswordForm email={email} navigate={navigate} />
}

function ResetPasswordForm({ email, navigate }) {

  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [justResent, setJustResent] = useState(false)

  useEffect(() => {
    if (resendCooldown <= 0) return undefined
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const newPasswordHasSpace = /\s/.test(newPassword)
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})

    if (code.length !== 6) {
      setError('Введите 6-значный код.')
      return
    }
    if (passwordsMismatch) {
      setError('Пароли не совпадают.')
      return
    }

    setIsSubmitting(true)
    try {
      await resetPassword({ email, code, newPassword })
      navigate('/login?reset=success')
    } catch (err) {
      if (err.fields?.length) {
        setFieldErrors(
          Object.fromEntries(err.fields.map((f) => [f.field, f.message]))
        )
      } else {
        setError(err.message)
        setCode('')
      }
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError('')
    try {
      await forgotPassword(email)
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      setJustResent(true)
      setTimeout(() => setJustResent(false), 4000)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className={styles.page} aria-label="Страница сброса пароля">
        <div className="mx-auto flex max-w-[400px] flex-col gap-6 px-4 py-16 sm:px-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-ink">
              Введите код
            </h1>
            <p className="text-[14px] text-muted">
              Мы отправили 6-значный код на <span className="text-ink">{email}</span>
            </p>
            <Link
              to={`/forgot-password?email=${encodeURIComponent(email)}`}
              className="text-[13px] font-medium text-accent hover:underline"
            >
              Не тот email? Изменить
            </Link>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2">
              <OtpInput
                value={code}
                onChange={setCode}
                hasError={Boolean(error) && !passwordsMismatch}
                autoFocus
              />
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-[13px] font-medium text-accent transition-colors hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
              >
                {resendCooldown > 0
                  ? `Отправить снова (${resendCooldown} с)`
                  : justResent
                    ? 'Код отправлен.'
                    : 'Отправить код снова'}
              </button>
            </div>

            <hr className="border-t border-line" />

            <div className="flex flex-col gap-1.5">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Новый пароль"
                  autoComplete="new-password"
                  className={`w-full rounded-lg border bg-surface px-3.5 py-2 pr-11 text-[14px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent ${fieldErrors.new_password || newPasswordHasSpace ? 'border-danger' : 'border-line-strong'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Скрыть пароли' : 'Показать пароли'}
                  className="absolute right-3 top-1/2 grid -translate-y-1/2 place-items-center text-muted transition-colors hover:text-ink"
                >
                  <HugeiconsIcon
                    icon={showPassword ? EyeIcon : EyeOffIcon}
                    size={18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                  />
                </button>
              </div>
              {fieldErrors.new_password ? (
                <p className="text-[13px] text-danger">{fieldErrors.new_password}</p>
              ) : (
                newPasswordHasSpace && (
                  <p className="text-[13px] text-danger">Пробелы недопустимы.</p>
                )
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Повторите пароль"
                  autoComplete="new-password"
                  className={`w-full rounded-lg border bg-surface px-3.5 py-2 pr-11 text-[14px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent ${passwordsMismatch ? 'border-danger' : 'border-line-strong'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Скрыть пароли' : 'Показать пароли'}
                  className="absolute right-3 top-1/2 grid -translate-y-1/2 place-items-center text-muted transition-colors hover:text-ink"
                >
                  <HugeiconsIcon
                    icon={showPassword ? EyeIcon : EyeOffIcon}
                    size={18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                  />
                </button>
              </div>
              {passwordsMismatch && (
                <p className="text-[13px] text-danger">Пароли не совпадают.</p>
              )}
            </div>

            {error && <p className="text-center text-[13px] text-danger">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-ink px-5 py-2 text-[14px] font-medium text-surface transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Сохраняем…' : 'Сменить пароль'}
            </button>
          </form>

          <p className="text-center text-[15px] text-muted">
            Вспомнили пароль?{' '}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
