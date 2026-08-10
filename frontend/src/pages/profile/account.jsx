import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon, ImageUpload01Icon, User02Icon } from '@hugeicons/core-free-icons'
import AvatarCropper from '../../components/AvatarCropper'
import ProfileSection from '../../components/ProfileSection'
import {
  deleteAvatar,
  mediaUrl,
  updateProfile,
  uploadAvatar,
} from '../../lib/api'
import { getAccessToken, verifySession } from '../../lib/auth'
import styles from '../../styles/Profile.module.css'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

/** One settings row: label and hint on the left, control on the right. */
function Row({ label, hint, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-2 border-b border-[#999999]/20 py-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="sm:w-[200px] sm:shrink-0">
        <label
          htmlFor={htmlFor}
          className="block text-[14px] font-medium text-[#171215]"
        >
          {label}
        </label>
        {hint && <p className="mt-0.5 text-[13px] text-[#999999]">{hint}</p>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function TextField({ id, value, onChange, error, ...rest }) {
  return (
    <>
      <input
        id={id}
        value={value}
        onChange={onChange}
        className={`w-full max-w-[380px] rounded-lg border bg-white px-3.5 py-2 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2] ${
          error ? 'border-[#DC2626]' : 'border-[#999999]/35'
        }`}
        {...rest}
      />
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-[#DC2626]">
          {error}
        </p>
      )}
    </>
  )
}

export default function AccountSettingsPage() {
  const fileInputRef = useRef(null)

  const [user, setUser] = useState(null)
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
  })
  const [pickedFile, setPickedFile] = useState(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    verifySession().then((me) => {
      if (cancelled || !me) return
      setUser(me)
      setForm({
        full_name: me.full_name || '',
        username: me.username || '',
        email: me.email || '',
        phone: me.phone || '',
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setStatus('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})
    setStatus('')
    setIsSaving(true)

    try {
      const updated = await updateProfile(getAccessToken(), {
        full_name: form.full_name.trim() || null,
        phone: form.phone.trim() || null,
        username: form.username.trim(),
        email: form.email.trim(),
      })
      setUser(updated)
      setStatus('Changes saved.')
    } catch (err) {
      if (err.fields?.length) {
        setFieldErrors(
          Object.fromEntries(err.fields.map((f) => [f.field, f.message]))
        )
      } else {
        setError(err.message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleFilePicked = (event) => {
    const file = event.target.files?.[0]
    // Reset immediately so re-picking the same file still fires onChange.
    event.target.value = ''
    if (!file) return

    setAvatarError('')
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image must be smaller than 5 MB.')
      return
    }
    setPickedFile(file)
  }

  const handleCropSave = async (blob) => {
    setAvatarBusy(true)
    try {
      const updated = await uploadAvatar(getAccessToken(), blob)
      setUser(updated)
      setPickedFile(null)
      setStatus('Photo updated.')
    } catch (err) {
      setAvatarError(err.message)
      throw err
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleAvatarDelete = async () => {
    setAvatarBusy(true)
    setAvatarError('')
    try {
      const updated = await deleteAvatar(getAccessToken())
      setUser(updated)
      setStatus('Photo removed.')
    } catch (err) {
      setAvatarError(err.message)
    } finally {
      setAvatarBusy(false)
    }
  }

  const avatarSrc = mediaUrl(user?.avatar_url)

  return (
    <>
      <Head>
        <title>AIRec</title>
      </Head>
      <div className={styles.page}>
        <ProfileSection
          title="Account"
          description="Your personal details and how you sign in"
        >
          {/* Avatar sits above the form: it saves on its own, not with the
              Save button, so keeping it inside the <form> would mislead. */}
          <div className="flex flex-col gap-4 border-b border-[#999999]/20 py-6 sm:flex-row sm:items-center sm:gap-8">
            <div className="sm:w-[200px] sm:shrink-0">
              <p className="text-[14px] font-medium text-[#171215]">Photo</p>
              <p className="mt-0.5 text-[13px] text-[#999999]">
                PNG or JPG, up to 5 MB
              </p>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-[#999999]/25">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <HugeiconsIcon
                    icon={User02Icon}
                    size={30}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.6}
                    className="text-[#999999]"
                  />
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#999999]/35 bg-white px-3.5 py-2 text-[13px] font-medium text-[#171215] transition-colors hover:bg-[#F6F8FA] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <HugeiconsIcon
                      icon={ImageUpload01Icon}
                      size={15}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.9}
                    />
                    {avatarSrc ? 'Replace' : 'Upload'}
                  </button>

                  {avatarSrc && (
                    <button
                      type="button"
                      onClick={handleAvatarDelete}
                      disabled={avatarBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[#DC2626] transition-colors hover:bg-[#DC2626]/8 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <HugeiconsIcon
                        icon={Delete02Icon}
                        size={15}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.9}
                      />
                      Remove
                    </button>
                  )}
                </div>

                {avatarError && (
                  <p role="alert" className="text-[13px] text-[#DC2626]">
                    {avatarError}
                  </p>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFilePicked}
                className="hidden"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <Row
              label="Full name"
              hint="The name your clients will see"
              htmlFor="full_name"
            >
              <TextField
                id="full_name"
                type="text"
                value={form.full_name}
                onChange={setField('full_name')}
                placeholder="Aruzhan Akhmetova"
                autoComplete="name"
                error={fieldErrors.full_name}
              />
            </Row>

            <Row label="Username" hint="Your unique handle" htmlFor="username">
              <TextField
                id="username"
                type="text"
                value={form.username}
                onChange={setField('username')}
                autoComplete="username"
                error={fieldErrors.username}
              />
            </Row>

            <Row
              label="Email"
              hint="Used for sign-in and notifications"
              htmlFor="email"
            >
              <TextField
                id="email"
                type="email"
                value={form.email}
                onChange={setField('email')}
                autoComplete="email"
                error={fieldErrors.email}
              />
            </Row>

            <Row label="Phone" hint="Optional" htmlFor="phone">
              <TextField
                id="phone"
                type="tel"
                value={form.phone}
                onChange={setField('phone')}
                placeholder="+7 700 123 45 67"
                autoComplete="tel"
                error={fieldErrors.phone}
              />
            </Row>

            <div className="flex flex-wrap items-center gap-3 py-5">
              <button
                type="submit"
                disabled={isSaving || !user}
                className="rounded-lg bg-[#3248F2] px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#2839c9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>

              {status && (
                <p role="status" className="text-[13px] text-[#16A34A]">
                  {status}
                </p>
              )}
              {error && (
                <p role="alert" className="text-[13px] text-[#DC2626]">
                  {error}
                </p>
              )}
            </div>
          </form>
        </ProfileSection>
      </div>

      {pickedFile && (
        <AvatarCropper
          file={pickedFile}
          onCancel={() => setPickedFile(null)}
          onSave={handleCropSave}
        />
      )}
    </>
  )
}
