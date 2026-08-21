import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, EyeOffIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { checkUsernameAvailability, register } from '../lib/api'
import { saveTokens, useRedirectIfAuthed } from '../lib/auth'
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  FIELD,
  FIELD_ERROR,
} from '../components/controls'
import styles from '../styles/Signup.module.css'

const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{2,31}$/

/**
 * The twin of `/login`, and it has to stay one: same column width, same
 * heading, same controls, same spacing. Everything that decides how a control
 * looks lives in `components/controls.js`, so the two cannot drift apart by
 * somebody restyling only one of them.
 *
 * What this page has that login does not is the live username check — a debounced
 * `GET /auth/username-availability` that puts a tick in the field. It is
 * deliberately quiet: only the *available* case draws anything, because a mark
 * appearing on every keystroke would be noise in a field you are still typing.
 */
export default function SignupPage() {
  useRedirectIfAuthed()

  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState('idle') // idle | checking | available | taken
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!USERNAME_PATTERN.test(username)) {
      setUsernameStatus('idle')
      return
    }

    setUsernameStatus('checking')
    const timer = setTimeout(() => {
      checkUsernameAvailability(username)
        .then(({ available }) => setUsernameStatus(available ? 'available' : 'taken'))
        .catch(() => setUsernameStatus('idle'))
    }, 400)

    return () => clearTimeout(timer)
  }, [username])

  const usernameHasSpace = /\s/.test(username)
  const emailHasSpace = /\s/.test(email)
  const passwordHasSpace = /\s/.test(password)

  const usernameBad =
    Boolean(fieldErrors.username) || usernameHasSpace || usernameStatus === 'taken'
  const emailBad = Boolean(fieldErrors.email) || emailHasSpace
  const passwordBad = Boolean(fieldErrors.password) || passwordHasSpace

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const { tokens } = await register({ username, email, password })
      // No checkbox here: an account is made on its owner's own machine, and the
      // one case where it would matter is answered by signing out.
      saveTokens(tokens, { remember: true })
      navigate('/dashboard')
    } catch (err) {
      if (err.fields?.length) {
        setFieldErrors(
          Object.fromEntries(err.fields.map((f) => [f.field, f.message]))
        )
      } else {
        setError(err.message)
      }
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page} aria-label="Страница регистрации">
      <div className="m-auto flex w-full max-w-[360px] flex-col px-4 py-10 sm:py-16">
        <h1 className="text-center font-display text-[32px] leading-10 font-semibold tracking-[-0.04em] text-ink">
          Создание аккаунта
        </h1>

        <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-2.5">
          <div>
            <div className="relative flex items-center">
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Логин"
                autoComplete="username"
                className={`${usernameBad ? FIELD_ERROR : FIELD} pr-10`}
              />
              {/* Only the good news is drawn. A mark for every state would fire
                  on each keystroke of a name you have not finished typing. */}
              {usernameStatus === 'available' && !usernameHasSpace && (
                <span className="absolute right-3 grid place-items-center text-ok">
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={17}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.4}
                  />
                </span>
              )}
            </div>
            {fieldErrors.username ? (
              <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.username}</p>
            ) : usernameHasSpace ? (
              <p className="mt-1.5 text-[13px] text-danger">Пробелы недопустимы.</p>
            ) : (
              usernameStatus === 'taken' && (
                <p className="mt-1.5 text-[13px] text-danger">Этот логин уже занят.</p>
              )
            )}
          </div>

          <div>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              className={emailBad ? FIELD_ERROR : FIELD}
            />
            {fieldErrors.email ? (
              <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.email}</p>
            ) : (
              emailHasSpace && (
                <p className="mt-1.5 text-[13px] text-danger">Пробелы недопустимы.</p>
              )
            )}
          </div>

          <div>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Пароль"
                autoComplete="new-password"
                className={`${passwordBad ? FIELD_ERROR : FIELD} pr-10`}
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
            {fieldErrors.password ? (
              <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.password}</p>
            ) : (
              passwordHasSpace && (
                <p className="mt-1.5 text-[13px] text-danger">Пробелы недопустимы.</p>
              )
            )}
          </div>

          {error && (
            <p role="alert" className="mt-1 text-[13px] text-danger">
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className={`${BUTTON_PRIMARY} mt-2.5`}>
            {isSubmitting ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
          </button>
        </form>

        {/* A labelled rule rather than a bare one: it says *why* the list below
            is separate instead of just separating it. */}
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[13px] text-muted">или</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            className={`${BUTTON_SECONDARY} flex items-center justify-center gap-2`}
          >
            <img src="/google_logo.svg" alt="" className="h-4 w-4" aria-hidden="true" />
            Продолжить с Google
          </button>

          <button
            type="button"
            className={`${BUTTON_SECONDARY} flex items-center justify-center gap-2`}
          >
            {/* Apple's mark is solid black and disappears on the dark theme's
                black button, so the white cut takes over there. Google's is
                multicoloured and needs no counterpart. */}
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
            Продолжить с Apple
          </button>
        </div>

        <p className="mt-8 text-center text-[14px] text-muted">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-ink underline-offset-2 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
