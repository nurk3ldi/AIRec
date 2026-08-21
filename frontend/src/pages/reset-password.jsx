import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, EyeOffIcon } from '@hugeicons/core-free-icons'
import { forgotPassword, resetPassword } from '../lib/api'
import { useRedirectIfAuthed } from '../lib/auth'
import OtpInput from '../components/OtpInput'
import { BUTTON_PRIMARY, FIELD, FIELD_ERROR } from '../components/controls'
import styles from '../styles/ResetPassword.module.css'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

const RESEND_COOLDOWN_SECONDS = 30

/**
 * The address the code was sent to comes from `?email=`, and without it this
 * page has nothing to confirm — so it sends you back to ask for one.
 *
 * **The address is captured once, on mount, and that is load-bearing.**
 * `PageTransition` runs `mode="wait"`, so when you leave this page it stays
 * mounted for the length of its fade — and by then the location is already the
 * route you asked for. Re-reading `?email=` at that moment returns null, the
 * guard below fires, and a `<Navigate>` redirects to `/forgot-password` right
 * over the top of the navigation you just made. That is what made "Вспомнили
 * пароль? Войти" land on the wrong page.
 *
 * A `useState` initialiser runs exactly once, so the captured value survives
 * every re-render the exit animation causes.
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const [email] = useState(() => params.get('email'))

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
    <div className={styles.page} aria-label="Страница сброса пароля">
      <div className="m-auto flex w-full max-w-[360px] flex-col px-4 py-10 sm:py-16">
        <h1 className="text-center font-display text-[32px] leading-10 font-semibold tracking-[-0.04em] text-ink">
          Введите код
        </h1>
        <p className="mt-2 text-center text-[14px] text-muted">
          Мы отправили 6-значный код на <span className="text-ink">{email}</span>
        </p>
        <Link
          to={`/forgot-password?email=${encodeURIComponent(email)}`}
          className="mt-1 text-center text-[13px] text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
        >
          Не тот email? Изменить
        </Link>

        <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-2.5">
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
            className="mx-auto text-[13px] text-muted underline-offset-2 transition-colors hover:text-ink hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
          >
            {resendCooldown > 0
              ? `Отправить снова (${resendCooldown} с)`
              : justResent
                ? 'Код отправлен.'
                : 'Отправить код снова'}
          </button>

          {/* A labelled rule: the code proves who you are, the fields below set
              the new password. Two steps in one form, said out loud. */}
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[13px] text-muted">новый пароль</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Новый пароль"
                autoComplete="new-password"
                className={`${
                  fieldErrors.new_password || newPasswordHasSpace ? FIELD_ERROR : FIELD
                } pr-10`}
              />
              <PasswordToggle shown={showPassword} onToggle={setShowPassword} />
            </div>
            {fieldErrors.new_password ? (
              <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.new_password}</p>
            ) : (
              newPasswordHasSpace && (
                <p className="mt-1.5 text-[13px] text-danger">Пробелы недопустимы.</p>
              )
            )}
          </div>

          <div>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Повторите пароль"
                autoComplete="new-password"
                className={`${passwordsMismatch ? FIELD_ERROR : FIELD} pr-10`}
              />
              <PasswordToggle shown={showPassword} onToggle={setShowPassword} />
            </div>
            {passwordsMismatch && (
              <p className="mt-1.5 text-[13px] text-danger">Пароли не совпадают.</p>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-1 text-center text-[13px] text-danger">
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className={`${BUTTON_PRIMARY} mt-2.5`}>
            {isSubmitting ? 'Сохраняем…' : 'Сменить пароль'}
          </button>
        </form>

        <p className="mt-8 text-center text-[14px] text-muted">
          Вспомнили пароль?{' '}
          <Link to="/login" className="text-ink underline-offset-2 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}

/** Both password fields share one visibility switch, so they reveal together —
 *  checking a repeat against a hidden original is not something to ask of
 *  anyone. */
function PasswordToggle({ shown, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle((prev) => !prev)}
      aria-label={shown ? 'Скрыть пароли' : 'Показать пароли'}
      className="absolute right-2.5 grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:text-ink"
    >
      <HugeiconsIcon
        icon={shown ? EyeIcon : EyeOffIcon}
        size={17}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </button>
  )
}
