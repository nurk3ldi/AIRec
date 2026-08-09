import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Edit02Icon } from '@hugeicons/core-free-icons'
import ProfileAvatar from '../components/ProfileAvatar'
import { logout as logoutRequest } from '../lib/api'
import { clearTokens, getRefreshToken } from '../lib/auth'
import styles from '../styles/Profile.module.css'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState({
    name: 'Аружан Ахметова',
    email: 'aruzhan@example.com',
    phone: '+7 (700) 123-45-67',
  })
  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    repeat: '',
  })

  const handleProfileChange = (field) => (event) => {
    setProfile((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handlePasswordChange = (field) => (event) => {
    setPasswords((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleProfileSubmit = (event) => {
    event.preventDefault()
  }

  const handlePasswordSubmit = (event) => {
    event.preventDefault()
    setPasswords({ current: '', next: '', repeat: '' })
  }

  const handleLogout = async () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      // Best-effort: revoke the session server-side, but log out locally either way.
      await logoutRequest(refreshToken).catch(() => {})
    }
    clearTokens()
    router.push('/')
  }

  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page} aria-label="Страница профиля">
        <div className="mx-auto flex max-w-[560px] flex-col gap-6 px-4 py-10 sm:px-6">
          <section className="rounded-2xl border border-[#999999]/25 bg-white p-6 shadow-[0_1px_2px_rgba(23,18,21,0.04)] sm:p-8">
            <div className="flex flex-col items-center gap-3 border-b border-[#999999]/20 pb-6 text-center">
              <div className="relative">
                <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-[#F6F8FA] text-[#171215] [&_img]:h-full [&_img]:w-full [&_svg]:h-10 [&_svg]:w-10">
                  <ProfileAvatar />
                </div>
                <button
                  type="button"
                  aria-label="Аватарды өзгерту"
                  className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#3248F2] text-white shadow-[0_4px_10px_rgba(50,72,242,0.35)] transition-colors hover:bg-[#2839c9]"
                >
                  <HugeiconsIcon
                    icon={Edit02Icon}
                    size={14}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </button>
              </div>
              <div>
                <p className="font-display text-[17px] font-semibold text-[#171215]">
                  {profile.name}
                </p>
                <p className="text-[13px] text-[#999999]">{profile.email}</p>
              </div>
            </div>

            <form
              className="flex flex-col gap-4 pt-6"
              onSubmit={handleProfileSubmit}
            >
              <Field
                id="name"
                label="Аты-жөні"
                value={profile.name}
                onChange={handleProfileChange('name')}
              />
              <Field
                id="email"
                label="Email"
                type="email"
                value={profile.email}
                onChange={handleProfileChange('email')}
              />
              <Field
                id="phone"
                label="Телефон"
                type="tel"
                value={profile.phone}
                onChange={handleProfileChange('phone')}
              />

              <button
                type="submit"
                className="mt-2 self-end rounded-lg bg-[#3248F2] px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_22px_rgba(50,72,242,0.25)] transition-colors hover:bg-[#2839c9]"
              >
                Сақтау
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-[#999999]/25 bg-white p-6 shadow-[0_1px_2px_rgba(23,18,21,0.04)] sm:p-8">
            <h2 className="font-display text-[15px] font-semibold text-[#171215]">
              Парольді өзгерту
            </h2>

            <form
              className="mt-4 flex flex-col gap-4"
              onSubmit={handlePasswordSubmit}
            >
              <Field
                id="current-password"
                label="Ағымдағы пароль"
                type="password"
                value={passwords.current}
                onChange={handlePasswordChange('current')}
              />
              <Field
                id="new-password"
                label="Жаңа пароль"
                type="password"
                value={passwords.next}
                onChange={handlePasswordChange('next')}
              />
              <Field
                id="repeat-password"
                label="Жаңа парольді қайталау"
                type="password"
                value={passwords.repeat}
                onChange={handlePasswordChange('repeat')}
              />

              <button
                type="submit"
                className="mt-2 self-end rounded-lg border border-[#999999]/40 px-5 py-2.5 text-[14px] font-medium text-[#171215] transition-colors hover:bg-[#F6F8FA]"
              >
                Өзгерту
              </button>
            </form>
          </section>

          <button
            type="button"
            onClick={handleLogout}
            className="self-center text-[14px] font-medium text-[#DC2626] transition-colors hover:underline"
          >
            Шығу
          </button>
        </div>
      </div>
    </>
  )
}

function Field({ id, label, type = 'text', value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[13px] font-medium text-[#171215]/80"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        className="rounded-lg border border-[#999999]/35 bg-white px-3.5 py-2.5 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2]"
      />
    </div>
  )
}
