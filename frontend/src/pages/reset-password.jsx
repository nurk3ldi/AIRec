import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, EyeOffIcon } from '@hugeicons/core-free-icons'
import { forgotPassword, resetPassword } from '../lib/api'
import { useRedirectIfAuthed } from '../lib/auth'
import styles from '../styles/ResetPassword.module.css'

const RESEND_COOLDOWN_SECONDS = 30

function OtpInput({ value, onChange, hasError, autoFocus }) {
  const inputRefs = useRef([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')

  const handleChange = (index) => (event) => {
    const raw = event.target.value.replace(/\D/g, '')
    const next = value.split('')
    while (next.length < 6) next.push('')

    if (!raw) {
      next[index] = ''
      onChange(next.join(''))
      return
    }

    next[index] = raw.slice(-1)
    onChange(next.join(''))
    if (index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index) => (event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    event.preventDefault()
    onChange(pasted)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          autoFocus={autoFocus && index === 0}
          value={digit}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          className={`h-14 w-11 rounded-lg border bg-white text-center text-[20px] font-semibold text-[#171215] outline-none transition-colors focus:border-[#3248F2] ${hasError ? 'border-[#DC2626]' : 'border-[#999999]/35'}`}
        />
      ))}
    </div>
  )
}

export async function getServerSideProps(context) {
  const { email } = context.query
  if (typeof email !== 'string' || !email) {
    return { redirect: { destination: '/forgot-password', permanent: false } }
  }
  return { props: { email } }
}

export default function ResetPasswordPage({ email }) {
  useRedirectIfAuthed()

  const router = useRouter()

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
      setError('Enter the 6-digit code.')
      return
    }
    if (passwordsMismatch) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await resetPassword({ email, code, newPassword })
      router.push('/login?reset=success')
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
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page} aria-label="Страница сброса пароля">
        <div className="mx-auto flex max-w-[400px] flex-col gap-6 px-4 py-16 sm:px-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-[#171215]">
              Enter your code
            </h1>
            <p className="text-[14px] text-[#999999]">
              We sent a 6-digit code to <span className="text-[#171215]">{email}</span>
            </p>
            <Link
              href={`/forgot-password?email=${encodeURIComponent(email)}`}
              className="text-[13px] font-medium text-[#3248F2] hover:underline"
            >
              Wrong email? Change it
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
                className="text-[13px] font-medium text-[#3248F2] transition-colors hover:underline disabled:cursor-not-allowed disabled:text-[#999999] disabled:no-underline"
              >
                {resendCooldown > 0
                  ? `Resend code (${resendCooldown}s)`
                  : justResent
                    ? 'Code resent.'
                    : 'Resend code'}
              </button>
            </div>

            <hr className="border-t border-[#999999]/25" />

            <div className="flex flex-col gap-1.5">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  className={`w-full rounded-lg border bg-white px-3.5 py-2 pr-11 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2] ${fieldErrors.new_password || newPasswordHasSpace ? 'border-[#DC2626]' : 'border-[#999999]/35'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                  className="absolute right-3 top-1/2 grid -translate-y-1/2 place-items-center text-[#999999] transition-colors hover:text-[#171215]"
                >
                  <HugeiconsIcon
                    icon={showPassword ? EyeOffIcon : EyeIcon}
                    size={18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                  />
                </button>
              </div>
              {fieldErrors.new_password ? (
                <p className="text-[13px] text-[#DC2626]">{fieldErrors.new_password}</p>
              ) : (
                newPasswordHasSpace && (
                  <p className="text-[13px] text-[#DC2626]">No spaces allowed.</p>
                )
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className={`w-full rounded-lg border bg-white px-3.5 py-2 pr-11 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2] ${passwordsMismatch ? 'border-[#DC2626]' : 'border-[#999999]/35'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                  className="absolute right-3 top-1/2 grid -translate-y-1/2 place-items-center text-[#999999] transition-colors hover:text-[#171215]"
                >
                  <HugeiconsIcon
                    icon={showPassword ? EyeOffIcon : EyeIcon}
                    size={18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                  />
                </button>
              </div>
              {passwordsMismatch && (
                <p className="text-[13px] text-[#DC2626]">Passwords do not match.</p>
              )}
            </div>

            {error && <p className="text-center text-[13px] text-[#DC2626]">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#171215] px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#171215]/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>

          <p className="text-center text-[15px] text-[#999999]">
            Remembered it?{' '}
            <Link href="/login" className="font-medium text-[#3248F2] hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
