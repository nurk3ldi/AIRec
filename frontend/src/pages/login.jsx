import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, EyeOffIcon } from '@hugeicons/core-free-icons'
import { login, restoreAccount } from '../lib/api'
import { saveTokens, useRedirectIfAuthed } from '../lib/auth'
import styles from '../styles/Login.module.css'

export default function LoginPage() {
  useRedirectIfAuthed()

  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Set when the sign-in failed only because the account is inside its deletion
  // grace period — the credentials were right, so we can offer to undo it.
  const [canRestore, setCanRestore] = useState(false)

  const identifierHasSpace = /\s/.test(identifier)
  const passwordHasSpace = /\s/.test(password)
  const resetSuccess = router.query.reset === 'success'
  const justDeleted = router.query.deleted === '1'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setCanRestore(false)
    setIsSubmitting(true)

    try {
      const { tokens } = await login({ identifier, password })
      saveTokens(tokens)
      router.push('/dashboard')
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
      const { tokens } = await restoreAccount({ identifier, password })
      saveTokens(tokens)
      router.push('/dashboard')
    } catch (err) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page} aria-label="Страница входа">
        <div className="mx-auto flex max-w-[400px] flex-col gap-6 px-4 py-16 sm:px-6">
          <h1 className="text-center font-display text-[26px] font-semibold tracking-[-0.02em] text-[#171215]">
            Вход в AIRec
          </h1>

          {resetSuccess && (
            <p className="rounded-lg border border-[#16A34A]/30 bg-[#F0FDF4] px-3.5 py-2.5 text-center text-[13px] text-[#16A34A]">
              Пароль изменён. Войдите с новым паролем.
            </p>
          )}

          {justDeleted && (
            <p className="rounded-lg border border-[#999999]/30 bg-[#F6F8FA] px-3.5 py-2.5 text-center text-[13px] text-[#171215]/70">
              Аккаунт удалён. В течение 30 дней его можно восстановить — просто
              войдите снова.
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Email или логин"
                autoComplete="username"
                className={`rounded-lg border bg-white px-3.5 py-2 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2] ${identifierHasSpace ? 'border-[#DC2626]' : 'border-[#999999]/35'}`}
              />
              {identifierHasSpace && (
                <p className="text-[13px] text-[#DC2626]">Пробелы недопустимы.</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Пароль"
                  autoComplete="current-password"
                  className={`w-full rounded-lg border bg-white px-3.5 py-2 pr-11 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2] ${passwordHasSpace ? 'border-[#DC2626]' : 'border-[#999999]/35'}`}
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
              {passwordHasSpace && (
                <p className="text-[13px] text-[#DC2626]">Пробелы недопустимы.</p>
              )}
              <Link
                href="/forgot-password"
                className="self-end text-[13px] font-medium text-[#3248F2] hover:underline"
              >
                Забыли пароль?
              </Link>
            </div>

            {error && <p className="text-[13px] text-[#DC2626]">{error}</p>}

            {/* The password was already accepted — the only thing standing in
                the way is the pending deletion, so undoing it is one click. */}
            {canRestore && (
              <button
                type="button"
                onClick={handleRestore}
                disabled={isSubmitting}
                className="rounded-lg border border-[#3248F2]/40 px-5 py-2 text-[14px] font-medium text-[#3248F2] transition-colors hover:bg-[#3248F2]/6 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Восстановить аккаунт и войти
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#171215] px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#171215]/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Входим…' : 'Войти'}
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
            Нет аккаунта?{' '}
            <Link href="/signup" className="font-medium text-[#3248F2] hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
