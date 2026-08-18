import { useEffect, useState } from 'react'
import { forgotPassword } from '../lib/api'
import { useRedirectIfAuthed } from '../lib/auth'
import styles from '../styles/ForgotPassword.module.css'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

export default function ForgotPasswordPage() {
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
    <>
      <div className={styles.page} aria-label="Страница восстановления пароля">
        <div className="mx-auto flex max-w-[400px] flex-col gap-6 px-4 py-16 sm:px-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-[#171215]">
              Восстановление пароля
            </h1>
            <p className="text-[14px] text-[#999999]">
              Введите email — мы отправим 6-значный код.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                autoComplete="email"
                autoFocus
                className={`rounded-lg border bg-white px-3.5 py-2 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2] ${emailHasSpace ? 'border-[#DC2626]' : 'border-[#999999]/35'}`}
              />
              {emailHasSpace && (
                <p className="text-[13px] text-[#DC2626]">Пробелы недопустимы.</p>
              )}
            </div>

            {error && <p className="text-[13px] text-[#DC2626]">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#171215] px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#171215]/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Отправляем…' : 'Отправить код'}
            </button>
          </form>

          <p className="text-center text-[15px] text-[#999999]">
            Вспомнили пароль?{' '}
            <Link to="/login" className="font-medium text-[#3248F2] hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
