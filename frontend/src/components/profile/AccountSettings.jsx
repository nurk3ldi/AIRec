import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  Camera01Icon,
  Tick02Icon,
  User02Icon,
} from '@hugeicons/core-free-icons'
import AvatarCropper from '../AvatarCropper'
import OtpInput from '../OtpInput'
import {
  checkUsernameAvailability,
  confirmEmailChange,
  getPendingEmailChange,
  mediaUrl,
  requestEmailChange,
  updateProfile,
  uploadAvatar,
} from '../../lib/api'
import { getAccessToken, verifySession } from '../../lib/auth'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const FORM_ID = 'account-settings-form'
// Same rule the backend enforces — checking it here keeps the live lookup from
// firing on input that could never be valid anyway.
const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{2,31}$/
// Deliberately loose: this catches typos ("нет @", "нет домена") before a round
// trip. Whether an address really exists is settled by the confirmation code,
// not by a regex, so there's nothing to gain from a stricter one here.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_COOLDOWN_SECONDS = 30

const EMPTY_FORM = { first_name: '', last_name: '', username: '', email: '' }

/**
 * Label above the input, outside it. The input itself is deliberately the same
 * control as the ones on `login.jsx` / `signup.jsx` — same border, radius,
 * padding and focus colour — so a field looks identical wherever it appears.
 */
function Field({
  id,
  label,
  error,
  hint,
  hintTone = 'muted',
  adornment,
  footer,
  ...inputProps
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-[#999999]">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          className={`w-full rounded-lg border bg-white px-3.5 py-2 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2] ${
            adornment ? 'pr-9' : ''
          } ${error ? 'border-[#DC2626]' : 'border-[#999999]/35'}`}
          {...inputProps}
        />
        {adornment}
      </div>
      {/* A failure always wins the line — a stale "all good" under a rejected
          field would contradict the red border right above it. */}
      {error ? (
        <p role="alert" className="text-[13px] text-[#DC2626]">
          {error}
        </p>
      ) : (
        hint && (
          <p
            role="status"
            className={`text-[13px] ${
              hintTone === 'success' ? 'text-[#16A34A]' : 'text-[#999999]'
            }`}
          >
            {hint}
          </p>
        )
      )}
      {footer}
    </div>
  )
}

/** The tinted strip under the Email field carrying its verification state. */
function StatusRow({ tone, label, children }) {
  const isSuccess = tone === 'success'
  return (
    <div
      className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 ${
        isSuccess ? 'bg-[#16A34A]/8' : 'bg-[#DC2626]/6'
      }`}
    >
      <span
        className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${
          isSuccess ? 'text-[#16A34A]' : 'text-[#DC2626]'
        }`}
      >
        <HugeiconsIcon
          icon={isSuccess ? Tick02Icon : Alert02Icon}
          size={15}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.1}
        />
        {label}
      </span>
      {children}
    </div>
  )
}

function StatusAction({ onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ml-auto shrink-0 text-[13px] font-medium text-[#3248F2] outline-none hover:underline disabled:text-[#999999] disabled:no-underline"
    >
      {children}
    </button>
  )
}

/**
 * Account section body: a single centred column — avatar, then the fields,
 * then the actions — that simply grows downward and scrolls once it outgrows
 * the viewport. The dialog sizes itself narrower for this section.
 */
export default function AccountSettings({ onUserChange, onClose }) {
  const fileInputRef = useRef(null)

  const [user, setUser] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [pickedFile, setPickedFile] = useState(null)
  // A cropped picture waiting to be saved: `{ blob, url }`, where `url` is an
  // object URL used only for the preview. The upload happens on Save with the
  // rest of the form, so the photo is a pending change like any other field
  // rather than something that quietly commits on its own.
  const [pendingAvatar, setPendingAvatar] = useState(null)
  const [avatarError, setAvatarError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // idle | checking | available | taken — mirrors signup.jsx
  const [usernameStatus, setUsernameStatus] = useState('idle')
  // The address a code was sent to and that hasn't been confirmed yet. It
  // outlives the dialog — reloaded from the server on mount — so a half-finished
  // change is still visible (and finishable) after closing and reopening.
  const [pendingEmail, setPendingEmail] = useState('')
  // Whether the code-entry step is on screen. Separate from `pendingEmail`:
  // a pending change exists whether or not the user is currently entering it.
  const [showCodeStep, setShowCodeStep] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const applyUser = (me) => {
    setUser(me)
    setForm({
      first_name: me.first_name || '',
      last_name: me.last_name || '',
      username: me.username || '',
      email: me.email || '',
    })
    // Let the shell refresh the avatar it shows in the sidebar.
    onUserChange?.(me)
  }

  useEffect(() => {
    let cancelled = false
    verifySession().then((me) => {
      if (cancelled || !me) return
      applyUser(me)
      // An unconfirmed change from an earlier visit has to resurface here —
      // otherwise it would sit invisible until it silently expired.
      getPendingEmailChange(getAccessToken())
        .then(({ pending_email }) => {
          if (!cancelled) setPendingEmail(pending_email || '')
        })
        .catch(() => {})
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live availability check, same debounce and states as the signup form. The
  // one difference: the user's own current username is theirs already, so it
  // must not come back as "taken" — it stays unmarked instead.
  useEffect(() => {
    const value = form.username.trim()
    const isOwn = user && value.toLowerCase() === user.username.toLowerCase()

    if (isOwn || !USERNAME_PATTERN.test(value)) {
      setUsernameStatus('idle')
      return
    }

    setUsernameStatus('checking')
    const timer = setTimeout(() => {
      checkUsernameAvailability(value)
        .then(({ available }) => setUsernameStatus(available ? 'available' : 'taken'))
        .catch(() => setUsernameStatus('idle'))
    }, 400)

    return () => clearTimeout(timer)
  }, [form.username, user])

  useEffect(() => {
    if (resendCooldown <= 0) return undefined
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  // Object URLs are held by the browser until revoked; the cleanup runs on the
  // *previous* value, so replacing a pending photo releases the one it replaced.
  useEffect(() => {
    if (!pendingAvatar) return undefined
    return () => URL.revokeObjectURL(pendingAvatar.url)
  }, [pendingAvatar])

  const setField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const trimmedEmail = form.email.trim()
  const emailChanged = Boolean(user) && trimmedEmail !== user.email
  // Only complain once they've actually typed something wrong, and only about
  // an address they're changing to — their stored one is already valid.
  const emailInvalid =
    emailChanged && trimmedEmail.length > 0 && !EMAIL_PATTERN.test(trimmedEmail)

  // Save stays disabled until something actually differs, so the button can't
  // fire a no-op request.
  const isDirty =
    Boolean(user) &&
    (Boolean(pendingAvatar) ||
      form.first_name.trim() !== (user.first_name || '') ||
      form.last_name.trim() !== (user.last_name || '') ||
      form.username.trim() !== user.username ||
      emailChanged)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})

    if (emailChanged && !EMAIL_PATTERN.test(trimmedEmail)) {
      setFieldErrors({ email: 'Некорректный email.' })
      return
    }

    setIsSaving(true)

    try {
      // The picture goes first so that if it fails the fields aren't left
      // saved against a photo that never made it.
      if (pendingAvatar) {
        setAvatarError('')
        await uploadAvatar(getAccessToken(), pendingAvatar.blob)
        setPendingAvatar(null)
      }

      // Two separate steps on purpose. The email is *not* part of this PATCH —
      // the backend refuses it there — because moving to a new address has to
      // be proved by receiving a code at it.
      const updated = await updateProfile(getAccessToken(), {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        username: form.username.trim(),
      })

      if (!emailChanged) {
        applyUser(updated)
        return
      }

      await requestEmailChange(getAccessToken(), trimmedEmail)
      // The field goes back to the address the account actually has; the new
      // one now lives in the pending status instead, so the form never shows a
      // value that isn't in effect.
      applyUser(updated)
      setCode('')
      setCodeError('')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      setPendingEmail(trimmedEmail)
      setShowCodeStep(true)
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

  const handleConfirmEmail = async (event) => {
    event.preventDefault()
    setCodeError('')

    if (code.length !== 6) {
      setCodeError('Введите 6-значный код.')
      return
    }

    setIsConfirming(true)
    try {
      const updated = await confirmEmailChange(getAccessToken(), code)
      applyUser(updated)
      setPendingEmail('')
      setShowCodeStep(false)
      setCode('')
    } catch (err) {
      setCodeError(err.message)
      setCode('')
    } finally {
      setIsConfirming(false)
    }
  }

  // For an address the account already has but never proved. Same endpoint as a
  // change — the backend allows the current address precisely when it's still
  // unverified.
  const handleVerifyCurrentEmail = async () => {
    setError('')
    setIsSaving(true)
    try {
      await requestEmailChange(getAccessToken(), user.email)
      setCode('')
      setCodeError('')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      setPendingEmail(user.email)
      setShowCodeStep(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    setCodeError('')
    setCode('')
    try {
      // Same endpoint as the first send — it invalidates the previous code, so
      // resending can never leave two codes live at once.
      await requestEmailChange(getAccessToken(), pendingEmail)
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setCodeError(err.message)
    }
  }

  // Leaves the code step, not the change itself: the request stays pending and
  // keeps its status on the form, so a code that arrives late is still usable.
  const handleCloseCodeStep = () => {
    setShowCodeStep(false)
    setCode('')
    setCodeError('')
  }

  const handleFilePicked = (event) => {
    const file = event.target.files?.[0]
    // Reset immediately so re-picking the same file still fires onChange.
    event.target.value = ''
    if (!file) return

    setAvatarError('')
    if (!file.type.startsWith('image/')) {
      setAvatarError('Выберите файл изображения.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Изображение должно быть меньше 5 МБ.')
      return
    }
    setPickedFile(file)
  }

  // Only stages the crop — nothing is uploaded until Save.
  const handleCropSave = async (blob) => {
    setAvatarError('')
    setPendingAvatar({ blob, url: URL.createObjectURL(blob) })
    setPickedFile(null)
  }

  // The staged crop wins, so the circle shows what Save is about to upload.
  const avatarSrc = pendingAvatar?.url || mediaUrl(user?.avatar_url)

  /**
   * The line under the Email field. Three states, in priority order:
   * an outstanding request for a different address, an address the account has
   * but never proved, and finally the confirmed one.
   */
  const emailStatus = (() => {
    if (!user) return null

    if (pendingEmail && pendingEmail !== user.email) {
      return (
        <StatusRow tone="warning" label="Не подтверждён">
          <span className="min-w-0 flex-1 truncate text-[13px] text-[#171215]">
            {pendingEmail}
          </span>
          <StatusAction onClick={() => setShowCodeStep(true)}>
            Подтвердить
          </StatusAction>
        </StatusRow>
      )
    }

    if (!user.email_verified) {
      return (
        <StatusRow tone="warning" label="Не подтверждён">
          <StatusAction
            onClick={pendingEmail ? () => setShowCodeStep(true) : handleVerifyCurrentEmail}
            disabled={isSaving}
          >
            Подтвердить
          </StatusAction>
        </StatusRow>
      )
    }

    return <StatusRow tone="success" label="Подтверждён" />
  })()

  // The confirmation step replaces the form entirely rather than sitting under
  // it: the address isn't changed yet, so leaving the editable field on screen
  // would invite editing it while a code for the old value is outstanding.
  if (showCodeStep && pendingEmail) {
    return (
      <>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">
          <p className="text-center text-[14px] text-[#171215]">
            Мы отправили 6-значный код на
          </p>
          <p className="mt-0.5 text-center text-[14px] font-semibold text-[#171215]">
            {pendingEmail}
          </p>

          <form onSubmit={handleConfirmEmail} noValidate className="mt-5">
            <OtpInput
              value={code}
              onChange={(next) => {
                setCode(next)
                setCodeError('')
              }}
              hasError={Boolean(codeError)}
              autoFocus
            />
          </form>

          {codeError && (
            <p role="alert" className="mt-3 text-center text-[13px] text-[#DC2626]">
              {codeError}
            </p>
          )}

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendCooldown > 0}
              className="text-[13px] font-medium text-[#3248F2] outline-none hover:underline disabled:text-[#999999] disabled:no-underline"
            >
              {resendCooldown > 0
                ? `Отправить код ещё раз (${resendCooldown})`
                : 'Отправить код ещё раз'}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={handleCloseCodeStep}
            className="rounded-xl border border-[#999999]/30 px-5 py-2.5 text-[14px] font-medium text-[#171215] outline-none transition-colors hover:bg-[#171215]/5 focus-visible:bg-[#171215]/5"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={handleConfirmEmail}
            disabled={code.length !== 6 || isConfirming}
            className="rounded-xl bg-[#3248F2] px-5 py-2.5 text-[14px] font-medium text-white outline-none transition-colors hover:bg-[#2839c9] focus-visible:bg-[#2839c9] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isConfirming ? 'Проверяем…' : 'Подтвердить'}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6 [scrollbar-color:#3248F2_#F6F8FA] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#3248F2] [&::-webkit-scrollbar-track]:bg-[#F6F8FA] [&::-webkit-scrollbar]:w-2">
        {/* Avatar block — outside the <form>, since the picture saves on its
            own rather than with the Save button. */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <div className="grid h-[185px] w-[185px] place-items-center overflow-hidden rounded-full bg-[#F6F8FA]">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <HugeiconsIcon
                  icon={User02Icon}
                  size={73}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.2}
                  className="text-[#999999]"
                />
              )}
            </div>

            {/* Sits on the picture itself, so "change the photo" needs no
                separate button competing with the form's actions. */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
              aria-label={avatarSrc ? 'Заменить фото' : 'Загрузить фото'}
              className="absolute right-1.5 bottom-1.5 grid h-10 w-10 place-items-center rounded-full border border-[#999999]/20 bg-white text-[#171215] shadow-[0_4px_12px_rgba(23,18,21,0.14)] outline-none transition-colors hover:bg-[#F6F8FA] focus-visible:bg-[#F6F8FA] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <HugeiconsIcon
                icon={Camera01Icon}
                size={18}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.9}
              />
            </button>
          </div>

          {avatarError && (
            <p role="alert" className="text-center text-[13px] text-[#DC2626]">
              {avatarError}
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFilePicked}
            className="hidden"
          />
        </div>

        <form
          id={FORM_ID}
          onSubmit={handleSubmit}
          noValidate
          className="mt-5 flex flex-col gap-4"
        >
          <Field
            id="first_name"
            label="Имя"
            type="text"
            value={form.first_name}
            onChange={setField('first_name')}
            autoComplete="given-name"
            error={fieldErrors.first_name}
          />
          <Field
            id="last_name"
            label="Фамилия"
            type="text"
            value={form.last_name}
            onChange={setField('last_name')}
            autoComplete="family-name"
            error={fieldErrors.last_name}
          />
          <Field
            id="username"
            label="Имя пользователя"
            type="text"
            value={form.username}
            onChange={setField('username')}
            autoComplete="username"
            error={
              fieldErrors.username ||
              (usernameStatus === 'taken' ? 'Этот логин уже занят.' : '')
            }
            hint={usernameStatus === 'available' ? 'Логин свободен.' : ''}
            hintTone="success"
            adornment={
              usernameStatus === 'available' ? (
                <span className="absolute right-3 grid place-items-center text-[#16A34A]">
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.2}
                  />
                </span>
              ) : null
            }
          />
          <Field
            id="email"
            label="Email"
            type="email"
            value={form.email}
            onChange={setField('email')}
            autoComplete="email"
            error={
              fieldErrors.email || (emailInvalid ? 'Некорректный email.' : '')
            }
            hint={
              emailChanged && !emailInvalid
                ? 'На новый адрес придёт код подтверждения.'
                : ''
            }
            footer={emailChanged ? null : emailStatus}
          />
        </form>

        {/* Failures only — a successful save shows its result in the fields
            themselves, so a confirmation line would just be noise. */}
        {error && (
          <p role="alert" className="mt-3 text-center text-[13px] text-[#DC2626]">
            {error}
          </p>
        )}
      </div>

      {/* Pinned: the actions stay reachable however far the column scrolls. */}
      <div className="flex shrink-0 items-center justify-end gap-2 px-6 pb-5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-[#999999]/30 px-5 py-2.5 text-[14px] font-medium text-[#171215] outline-none transition-colors hover:bg-[#171215]/5 focus-visible:bg-[#171215]/5"
        >
          Отменить
        </button>
        <button
          type="submit"
          form={FORM_ID}
          disabled={!isDirty || emailInvalid || isSaving}
          className="rounded-xl bg-[#3248F2] px-5 py-2.5 text-[14px] font-medium text-white outline-none transition-colors hover:bg-[#2839c9] focus-visible:bg-[#2839c9] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSaving ? 'Сохраняем…' : 'Сохранить'}
        </button>
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
