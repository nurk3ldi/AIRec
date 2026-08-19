import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, EyeOffIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { checkUsernameAvailability, register } from '../lib/api'
import { saveTokens, useRedirectIfAuthed } from '../lib/auth'
import styles from '../styles/Signup.module.css'
import { Link } from 'react-router-dom'

const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{2,31}$/

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

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const { tokens } = await register({ username, email, password })
      saveTokens(tokens)
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
    <>
      <div className={styles.page} aria-label="Страница регистрации">
        <div className="m-auto flex w-full max-w-[400px] flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
          <h1 className="text-center font-display text-[26px] font-semibold tracking-[-0.02em] text-ink">
            Создание аккаунта
          </h1>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Логин"
                  autoComplete="username"
                  className={`w-full rounded-lg border bg-surface px-3.5 py-2.5 pr-9 text-[16px] text-ink outline-none sm:py-2 sm:text-[14px] transition-colors placeholder:text-muted focus:border-accent ${fieldErrors.username || usernameHasSpace || usernameStatus === 'taken' ? 'border-danger' : 'border-line-strong'}`}
                />
                {usernameStatus === 'available' && !usernameHasSpace && (
                  <span className="absolute right-3 grid place-items-center text-ok">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={18}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.2}
                    />
                  </span>
                )}
              </div>
              {fieldErrors.username ? (
                <p className="text-[13px] text-danger">{fieldErrors.username}</p>
              ) : usernameHasSpace ? (
                <p className="text-[13px] text-danger">Пробелы недопустимы.</p>
              ) : (
                usernameStatus === 'taken' && (
                  <p className="text-[13px] text-danger">Этот логин уже занят.</p>
                )
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                autoComplete="email"
                className={`rounded-lg border bg-surface px-3.5 py-2.5 text-[16px] text-ink outline-none sm:py-2 sm:text-[14px] transition-colors placeholder:text-muted focus:border-accent ${fieldErrors.email || emailHasSpace ? 'border-danger' : 'border-line-strong'}`}
              />
              {fieldErrors.email ? (
                <p className="text-[13px] text-danger">{fieldErrors.email}</p>
              ) : (
                emailHasSpace && (
                  <p className="text-[13px] text-danger">Пробелы недопустимы.</p>
                )
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Пароль"
                  autoComplete="new-password"
                  className={`w-full rounded-lg border bg-surface px-3.5 py-2.5 pr-11 text-[16px] text-ink outline-none sm:py-2 sm:text-[14px] transition-colors placeholder:text-muted focus:border-accent ${fieldErrors.password || passwordHasSpace ? 'border-danger' : 'border-line-strong'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
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
              {fieldErrors.password ? (
                <p className="text-[13px] text-danger">{fieldErrors.password}</p>
              ) : (
                passwordHasSpace && (
                  <p className="text-[13px] text-danger">Пробелы недопустимы.</p>
                )
              )}
            </div>

            {error && <p className="text-[13px] text-danger">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-ink px-5 py-3 text-[15px] font-medium sm:py-2 sm:text-[14px] text-surface transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
            </button>

            <hr className="border-t border-line" />

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 py-3 text-[15px] font-semibold sm:py-2 sm:text-[14px] text-ink transition-colors hover:bg-ground"
            >
              <img src="/google_logo.svg" alt="" className="h-[18px] w-[18px]" aria-hidden="true" />
              Продолжить с Google
            </button>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 py-3 text-[15px] font-semibold sm:py-2 sm:text-[14px] text-ink transition-colors hover:bg-ground"
            >
              <img src="/apple_logo.svg" alt="" className="h-[18px] w-[18px]" aria-hidden="true" />
              Продолжить с Apple
            </button>
          </form>

          <p className="text-center text-[15px] text-muted">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
