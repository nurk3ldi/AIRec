import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, EyeOffIcon } from '@hugeicons/core-free-icons'
import styles from '../styles/Signup.module.css'

export default function SignupPage() {
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()
  }

  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page} aria-label="Страница регистрации">
        <div className="mx-auto flex max-w-[400px] flex-col gap-6 px-4 py-16 sm:px-6">
          <h1 className="text-center font-display text-[26px] font-semibold tracking-[-0.02em] text-[#171215]">
            Create your account
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Nickname"
              autoComplete="username"
              className="rounded-lg border border-[#999999]/35 bg-white px-3.5 py-2 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2]"
            />

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="rounded-lg border border-[#999999]/35 bg-white px-3.5 py-2 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2]"
            />

            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="new-password"
                className="w-full rounded-lg border border-[#999999]/35 bg-white px-3.5 py-2 pr-11 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
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

            <hr className="border-t border-[#999999]/25" />

            <button
              type="submit"
              className="rounded-lg bg-[#171215] px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#171215]/85"
            >
              Sign Up
            </button>
          </form>

          <p className="text-center text-[15px] text-[#999999]">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-[#3248F2] hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
