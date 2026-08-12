import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, EyeOffIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { checkUsernameAvailability, register } from '../lib/api'
import { saveTokens, useRedirectIfAuthed } from '../lib/auth'
import styles from '../styles/Signup.module.css'

const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{2,31}$/

export default function SignupPage() {
  useRedirectIfAuthed()

  const router = useRouter()
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
      router.push('/dashboard')
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
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page} aria-label="Страница регистрации">
        <div className="mx-auto flex max-w-[400px] flex-col gap-6 px-4 py-16 sm:px-6">
          <h1 className="text-center font-display text-[26px] font-semibold tracking-[-0.02em] text-[#171215]">
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
                  className={`w-full rounded-lg border bg-white px-3.5 py-2 pr-9 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2] ${fieldErrors.username || usernameHasSpace || usernameStatus === 'taken' ? 'border-[#DC2626]' : 'border-[#999999]/35'}`}
                />
                {usernameStatus === 'available' && !usernameHasSpace && (
                  <span className="absolute right-3 grid place-items-center text-[#16A34A]">
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
                <p className="text-[13px] text-[#DC2626]">{fieldErrors.username}</p>
              ) : usernameHasSpace ? (
                <p className="text-[13px] text-[#DC2626]">Пробелы недопустимы.</p>
              ) : (
                usernameStatus === 'taken' && (
                  <p className="text-[13px] text-[#DC2626]">Этот логин уже занят.</p>
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
                className={`rounded-lg border bg-white px-3.5 py-2 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2] ${fieldErrors.email || emailHasSpace ? 'border-[#DC2626]' : 'border-[#999999]/35'}`}
              />
              {fieldErrors.email ? (
                <p className="text-[13px] text-[#DC2626]">{fieldErrors.email}</p>
              ) : (
                emailHasSpace && (
                  <p className="text-[13px] text-[#DC2626]">Пробелы недопустимы.</p>
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
                  className={`w-full rounded-lg border bg-white px-3.5 py-2 pr-11 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2] ${fieldErrors.password || passwordHasSpace ? 'border-[#DC2626]' : 'border-[#999999]/35'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-3 top-1/2 grid -translate-y-1/2 place-items-center text-[#999999] transition-colors hover:text-[#171215]"
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
                <p className="text-[13px] text-[#DC2626]">{fieldErrors.password}</p>
              ) : (
                passwordHasSpace && (
                  <p className="text-[13px] text-[#DC2626]">Пробелы недопустимы.</p>
                )
              )}
            </div>

            {error && <p className="text-[13px] text-[#DC2626]">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#171215] px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#171215]/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
            </button>

            <hr className="border-t border-[#999999]/25" />

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#999999]/35 bg-white px-3.5 py-2 text-[14px] font-semibold text-[#171215] transition-colors hover:bg-[#F6F8FA]"
            >
              <img src="/google_logo.svg" alt="" className="h-[18px] w-[18px]" aria-hidden="true" />
              Продолжить с Google
            </button>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#999999]/35 bg-white px-3.5 py-2 text-[14px] font-semibold text-[#171215] transition-colors hover:bg-[#F6F8FA]"
            >
              <img src="/apple_logo.svg" alt="" className="h-[18px] w-[18px]" aria-hidden="true" />
              Продолжить с Apple
            </button>
          </form>

          <p className="text-center text-[15px] text-[#999999]">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="font-medium text-[#3248F2] hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
