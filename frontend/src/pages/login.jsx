import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, EyeOffIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { login, restoreAccount } from '../lib/api'
import { saveTokens, useRedirectIfAuthed } from '../lib/auth'
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
const CONTROL = 'h-10 w-full rounded-lg px-3 text-[16px] transition-all duration-150'

const FIELD =
  `${CONTROL} bg-surface text-ink outline-none placeholder:text-muted ` +
  'shadow-[0_0_0_1px_var(--color-field)] hover:shadow-[0_0_0_1px_var(--color-field-hover)] ' +
  'focus:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)]'

const FIELD_ERROR =
  `${CONTROL} bg-surface text-ink outline-none placeholder:text-muted ` +
  'shadow-[0_0_0_1px_var(--color-danger)] focus:shadow-[0_0_0_1px_var(--color-danger),0_0_0_4px_var(--color-field-halo)]'

export default function LoginPage() {
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
    <div className={styles.page} aria-label="Страница входа">
      {/* 320px, centred — the reference's form width. Narrow on purpose: a
          single column of short fields reads as one thing to fill in, where a
          wide one reads as a page. */}
      <div className="m-auto flex w-full max-w-[320px] flex-col px-4 py-10 sm:py-16">
        <h1 className="text-center font-display text-[32px] leading-10 font-semibold tracking-[-0.04em] text-ink">
          Вход в AIRec
        </h1>

        {resetSuccess && (
          <p className="mt-6 rounded-lg px-3.5 py-2.5 text-center text-[14px] text-ok shadow-[0_0_0_1px_var(--color-ok)]">
            Пароль изменён. Войдите с новым паролем.
          </p>
        )}

        {justDeleted && (
          <p className="mt-6 rounded-lg px-3.5 py-2.5 text-center text-[14px] text-muted shadow-[0_0_0_1px_var(--color-field)]">
            Аккаунт удалён. В течение 30 дней его можно восстановить — просто
            войдите снова.
          </p>
        )}

        {/* 8px between the fields, 16px before anything that is not a field —
            the reference's `gap-2` inside a group and `gap-4` between them. */}
        <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-2">
          <div>
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Email или логин"
              autoComplete="username"
              className={identifierHasSpace ? FIELD_ERROR : FIELD}
            />
            {identifierHasSpace && (
              <p className="mt-1.5 text-[13px] text-danger">Пробелы недопустимы.</p>
            )}
          </div>

          <div>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Пароль"
                autoComplete="current-password"
                className={`${passwordHasSpace ? FIELD_ERROR : FIELD} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
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
              <p className="mt-1.5 text-[13px] text-danger">Пробелы недопустимы.</p>
            )}
          </div>

          {/* One row, not two. Both controls carry `py-2 -my-2`: the padding
              grows the tap target, the negative margin takes it back out of the
              layout so the row stays its own height. */}
          <div className="mt-2 flex items-center justify-between gap-4">
            <label className="-my-2 flex cursor-pointer items-center gap-2.5 py-2 select-none">
              <span className="relative flex h-[16px] w-[16px] shrink-0">
                {/* A native checkbox with its paint stripped off rather than a
                    Radix one: space-to-toggle, form semantics and focus are
                    already right, and Radix is for behaviour that is hard. */}
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="peer h-full w-full cursor-pointer appearance-none rounded-[4px] bg-surface shadow-[0_0_0_1px_var(--color-field-hover)] transition-all checked:bg-accent checked:shadow-none focus-visible:shadow-[0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-field-halo)]"
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
              <span className="text-[14px] text-muted">Запомнить меня</span>
            </label>

            <Link
              to="/forgot-password"
              className="-my-2 py-2 text-[14px] text-muted transition-colors hover:text-ink"
            >
              Забыли пароль?
            </Link>
          </div>

          {error && (
            <p role="alert" className="mt-2 text-[13px] text-danger">
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
              className={`${CONTROL} mt-2 bg-surface text-[14px] font-medium text-ink shadow-[0_0_0_1px_var(--color-field-hover)] hover:shadow-[0_0_0_1px_var(--color-field-focus)] disabled:cursor-not-allowed disabled:opacity-60`}
            >
              Восстановить аккаунт и войти
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`${CONTROL} mt-2 bg-accent text-[14px] font-medium text-surface hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {isSubmitting ? 'Входим…' : 'Войти'}
          </button>
        </form>

        {/* A labelled rule rather than a bare one: it says *why* the list below
            is separate instead of just separating it. */}
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[13px] text-muted">или</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={`${CONTROL} flex items-center justify-center gap-2 bg-surface text-[14px] font-medium text-ink shadow-[0_0_0_1px_var(--color-field-hover)] hover:shadow-[0_0_0_1px_var(--color-field-focus)]`}
          >
            <img src="/google_logo.svg" alt="" className="h-4 w-4" aria-hidden="true" />
            Продолжить с Google
          </button>

          <button
            type="button"
            className={`${CONTROL} flex items-center justify-center gap-2 bg-surface text-[14px] font-medium text-ink shadow-[0_0_0_1px_var(--color-field-hover)] hover:shadow-[0_0_0_1px_var(--color-field-focus)]`}
          >
            <img src="/apple_logo.svg" alt="" className="h-4 w-4" aria-hidden="true" />
            Продолжить с Apple
          </button>
        </div>

        <p className="mt-8 text-center text-[14px] text-muted">
          Нет аккаунта?{' '}
          <Link to="/signup" className="text-ink underline-offset-2 hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  )
}
