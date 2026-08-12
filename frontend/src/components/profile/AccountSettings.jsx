import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  Camera01Icon,
  EyeIcon,
  EyeOffIcon,
  Tick02Icon,
  User02Icon,
} from '@hugeicons/core-free-icons'
import AvatarCropper from '../AvatarCropper'
import OtpInput from '../OtpInput'
import {
  cancelEmailChange,
  checkUsernameAvailability,
  confirmEmailChange,
  confirmPasswordChange,
  getPendingEmailChange,
  mediaUrl,
  deleteAvatar,
  requestEmailChange,
  requestPasswordChange,
  updateProfile,
  uploadAvatar,
} from '../../lib/api'
import { getAccessToken, saveTokens, verifySession } from '../../lib/auth'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const FORM_ID = 'account-settings-form'
const PASSWORD_FORM_ID = 'account-password-form'
const EMAIL_FORM_ID = 'account-email-form'
// Same rule the backend enforces — checking it here keeps the live lookup from
// firing on input that could never be valid anyway.
const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{2,31}$/
// Deliberately loose: this catches typos ("нет @", "нет домена") before a round
// trip. Whether an address really exists is settled by the confirmation code,
// not by a regex, so there's nothing to gain from a stricter one here.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_COOLDOWN_SECONDS = 30

// No `email` here on purpose: it isn't edited inline any more — it has its own
// verified step, the same as the password.
const EMPTY_FORM = { first_name: '', last_name: '', username: '' }

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

/**
 * A password box with its own show/hide eye.
 *
 * `show` is owned by the caller, so every box in a step flips together — they
 * hold the same secret, and revealing one while the other stays masked makes
 * comparing them impossible, which is the whole point of a repeat field.
 */
function PasswordInput({ show, onToggleShow, ...inputProps }) {
  return (
    <div className="relative flex items-center">
      <input
        type={show ? 'text' : 'password'}
        className="w-full rounded-lg border border-[#999999]/35 bg-white px-3.5 py-2 pr-11 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2]"
        {...inputProps}
      />
      <button
        type="button"
        onClick={onToggleShow}
        aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
        className="absolute right-3 grid place-items-center text-[#999999] transition-colors hover:text-[#171215]"
      >
        <HugeiconsIcon
          icon={show ? EyeIcon : EyeOffIcon}
          size={18}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
        />
      </button>
    </div>
  )
}

/**
 * A read-only value with its own "Изменить" action — for the two things that
 * can't be edited inline because changing them has to be proved: the email and
 * the password. Deliberately shaped like `Field` so the column reads evenly.
 */
function ActionRow({
  label,
  value,
  valueClassName = '',
  action,
  onAction,
  disabled,
  footer,
}) {
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-[#999999]">{label}</span>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[#999999]/35 bg-white px-3.5 py-2">
        <span className={`min-w-0 truncate text-[14px] text-[#171215] ${valueClassName}`}>
          {value}
        </span>
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="shrink-0 text-[13px] font-medium text-[#3248F2] outline-none hover:underline disabled:text-[#999999] disabled:no-underline"
        >
          {action}
        </button>
      </div>
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

/** `tone="muted"` for the secondary action, so two side by side don't compete. */
function StatusAction({ onClick, disabled, tone = 'accent', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 text-[13px] font-medium outline-none hover:underline disabled:text-[#999999] disabled:no-underline ${
        tone === 'muted' ? 'text-[#999999]' : 'ml-auto text-[#3248F2]'
      }`}
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
  // Removal is staged the same way an upload is, so both kinds of photo change
  // commit on Save rather than one of them acting instantly.
  const [avatarRemoved, setAvatarRemoved] = useState(false)
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
  // null | 'address' (typing the new one) | 'code' (entering what was mailed).
  // Separate from `pendingEmail`: a pending change exists whether or not the
  // user is currently on one of those screens.
  const [emailStep, setEmailStep] = useState(null)
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  // Password change — its own step, with its own code and cooldown so it can't
  // pick up a countdown left running by the email flow.
  const [showPasswordStep, setShowPasswordStep] = useState(false)
  // 'password' proves the change with the current password, 'code' with one
  // mailed to the account. Neither is stronger than the other outright, so the
  // quicker one is the default and the other is the way out of a forgotten one.
  const [pwMode, setPwMode] = useState('password')
  const [currentPassword, setCurrentPassword] = useState('')
  const [pwCode, setPwCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pwError, setPwError] = useState('')
  // A password change leaves nothing visible behind — the field still shows
  // dots — so unlike the other saves this one does need to say it worked.
  const [pwChanged, setPwChanged] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [pwResendCooldown, setPwResendCooldown] = useState(0)

  const applyUser = (me) => {
    setUser(me)
    setForm({
      first_name: me.first_name || '',
      last_name: me.last_name || '',
      username: me.username || '',
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

  useEffect(() => {
    if (pwResendCooldown <= 0) return undefined
    const timer = setTimeout(() => setPwResendCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [pwResendCooldown])

  // Object URLs are held by the browser until revoked; the cleanup runs on the
  // *previous* value, so replacing a pending photo releases the one it replaced.
  useEffect(() => {
    if (!pendingAvatar) return undefined
    return () => URL.revokeObjectURL(pendingAvatar.url)
  }, [pendingAvatar])

  const setField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  // Save stays disabled until something actually differs, so the button can't
  // fire a no-op request. Email isn't here — it never changes through Save.
  const isDirty =
    Boolean(user) &&
    (Boolean(pendingAvatar) ||
      avatarRemoved ||
      form.first_name.trim() !== (user.first_name || '') ||
      form.last_name.trim() !== (user.last_name || '') ||
      form.username.trim() !== user.username)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})
    setIsSaving(true)

    try {
      // The picture goes first so that if it fails the fields aren't left
      // saved against a photo that never made it.
      setAvatarError('')
      if (pendingAvatar) {
        await uploadAvatar(getAccessToken(), pendingAvatar.blob)
        setPendingAvatar(null)
        setAvatarRemoved(false)
      } else if (avatarRemoved) {
        await deleteAvatar(getAccessToken())
        setAvatarRemoved(false)
      }

      // The email is *not* part of this PATCH — the backend refuses it there —
      // because moving to a new address has to be proved by receiving a code
      // at it. That lives in its own step.
      const updated = await updateProfile(getAccessToken(), {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        username: form.username.trim(),
      })
      applyUser(updated)
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

  const handleStartEmailChange = () => {
    setError('')
    setNewEmail('')
    setEmailError('')
    setEmailStep('address')
  }

  const handleSubmitNewEmail = async (event) => {
    event.preventDefault()
    const address = newEmail.trim()

    if (!EMAIL_PATTERN.test(address)) {
      setEmailError('Некорректный email.')
      return
    }

    setEmailError('')
    setIsSaving(true)
    try {
      await requestEmailChange(getAccessToken(), address)
      setPendingEmail(address)
      setCode('')
      setCodeError('')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      setEmailStep('code')
    } catch (err) {
      setEmailError(err.fields?.[0]?.message || err.message)
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
      setEmailStep(null)
      setCode('')
    } catch (err) {
      setCodeError(err.message)
      setCode('')
    } finally {
      setIsConfirming(false)
    }
  }

  // Opens straight into the password path — no email round trip unless the
  // user actually asks for one.
  const handleStartPasswordChange = () => {
    setError('')
    setPwChanged(false)
    setPwMode('password')
    setCurrentPassword('')
    setPwCode('')
    setNewPassword('')
    setConfirmPassword('')
    setPwError('')
    setShowPasswordStep(true)
  }

  const handleSwitchToCode = async () => {
    setPwError('')
    setIsSaving(true)
    try {
      await requestPasswordChange(getAccessToken())
      setCurrentPassword('')
      setPwCode('')
      setPwResendCooldown(RESEND_COOLDOWN_SECONDS)
      setPwMode('code')
    } catch (err) {
      setPwError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSwitchToPassword = () => {
    setPwError('')
    setPwCode('')
    setPwMode('password')
  }

  const handleResendPasswordCode = async () => {
    if (pwResendCooldown > 0) return
    setPwError('')
    setPwCode('')
    try {
      await requestPasswordChange(getAccessToken())
      setPwResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setPwError(err.message)
    }
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    setPwError('')

    if (pwMode === 'code' && pwCode.length !== 6) {
      setPwError('Введите 6-значный код.')
      return
    }
    if (pwMode === 'password' && !currentPassword) {
      setPwError('Введите текущий пароль.')
      return
    }
    if (/\s/.test(newPassword)) {
      setPwError('Пробелы недопустимы.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Пароли не совпадают.')
      return
    }

    setIsChangingPassword(true)
    try {
      const { tokens } = await confirmPasswordChange(getAccessToken(), {
        ...(pwMode === 'code' ? { code: pwCode } : { currentPassword }),
        newPassword,
      })
      // The change revoked every session including this one; without saving the
      // pair it hands back, the next request would 401 the user out.
      saveTokens(tokens)
      setPwChanged(true)
      setShowPasswordStep(false)
      setCurrentPassword('')
      setPwCode('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwError(err.fields?.[0]?.message || err.message)
      // Clear the rejected proof so it has to be re-entered, but leave the new
      // password alone — it's the code or the old password that was wrong.
      if (!err.fields?.length) {
        if (pwMode === 'code') setPwCode('')
        else setCurrentPassword('')
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleClosePasswordStep = () => {
    setShowPasswordStep(false)
    setCurrentPassword('')
    setPwCode('')
    setNewPassword('')
    setConfirmPassword('')
    setPwError('')
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
      setEmailStep('code')
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
    setEmailStep(null)
    setCode('')
    setCodeError('')
  }

  // Drops the request itself. Without this the banner would sit there until the
  // code expired, with no way to say "never mind" — including after a typo in
  // the address.
  const handleCancelEmailChange = async () => {
    setError('')
    try {
      await cancelEmailChange(getAccessToken())
      setPendingEmail('')
      setEmailStep(null)
      setCode('')
      setCodeError('')
    } catch (err) {
      setError(err.message)
    }
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
    setAvatarRemoved(false)
    setPendingAvatar({ blob, url: URL.createObjectURL(blob) })
    setPickedFile(null)
  }

  const handleRemoveAvatar = () => {
    setAvatarError('')
    setPendingAvatar(null)
    setAvatarRemoved(true)
  }

  // Reflects what Save is about to do: a staged crop wins, a staged removal
  // empties the circle, otherwise it's whatever is stored.
  const avatarSrc = pendingAvatar
    ? pendingAvatar.url
    : avatarRemoved
      ? null
      : mediaUrl(user?.avatar_url)

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
          <StatusAction onClick={() => setEmailStep('code')}>
            Подтвердить
          </StatusAction>
          <StatusAction tone="muted" onClick={handleCancelEmailChange}>
            Отменить
          </StatusAction>
        </StatusRow>
      )
    }

    if (!user.email_verified) {
      return (
        <StatusRow tone="warning" label="Не подтверждён">
          <StatusAction
            onClick={pendingEmail ? () => setEmailStep('code') : handleVerifyCurrentEmail}
            disabled={isSaving}
          >
            Подтвердить
          </StatusAction>
        </StatusRow>
      )
    }

    return <StatusRow tone="success" label="Подтверждён" />
  })()

  if (showPasswordStep) {
    return (
      <>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">
          {pwMode === 'code' ? (
            <>
              <p className="text-center text-[14px] text-[#171215]">
                Мы отправили 6-значный код на
              </p>
              <p className="mt-0.5 text-center text-[14px] font-semibold text-[#171215]">
                {user?.email}
              </p>
            </>
          ) : (
            <p className="text-center text-[14px] text-[#999999]">
              Введите текущий пароль, чтобы задать новый.
            </p>
          )}

          <form
            id={PASSWORD_FORM_ID}
            onSubmit={handleChangePassword}
            noValidate
            className="mt-5 flex flex-col gap-4"
          >
            {pwMode === 'code' ? (
              <OtpInput
                value={pwCode}
                onChange={(next) => {
                  setPwCode(next)
                  setPwError('')
                }}
                hasError={Boolean(pwError)}
                autoFocus
              />
            ) : (
              <PasswordInput
                show={showPassword}
                onToggleShow={() => setShowPassword((prev) => !prev)}
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value)
                  setPwError('')
                }}
                placeholder="Текущий пароль"
                autoComplete="current-password"
                autoFocus
              />
            )}

            <PasswordInput
              show={showPassword}
              onToggleShow={() => setShowPassword((prev) => !prev)}
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value)
                setPwError('')
              }}
              placeholder="Новый пароль"
              autoComplete="new-password"
            />

            <PasswordInput
              show={showPassword}
              onToggleShow={() => setShowPassword((prev) => !prev)}
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value)
                setPwError('')
              }}
              placeholder="Повторите пароль"
              autoComplete="new-password"
            />
          </form>

          {pwError && (
            <p role="alert" className="mt-3 text-center text-[13px] text-[#DC2626]">
              {pwError}
            </p>
          )}

          <div className="mt-3 flex flex-col items-center gap-1.5">
            {pwMode === 'code' ? (
              <>
                <button
                  type="button"
                  onClick={handleResendPasswordCode}
                  disabled={pwResendCooldown > 0}
                  className="text-[13px] font-medium text-[#3248F2] outline-none hover:underline disabled:text-[#999999] disabled:no-underline"
                >
                  {pwResendCooldown > 0
                    ? `Отправить код ещё раз (${pwResendCooldown})`
                    : 'Отправить код ещё раз'}
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToPassword}
                  className="text-[13px] font-medium text-[#999999] outline-none hover:underline"
                >
                  Ввести текущий пароль
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSwitchToCode}
                disabled={isSaving}
                className="text-[13px] font-medium text-[#3248F2] outline-none hover:underline disabled:text-[#999999] disabled:no-underline"
              >
                {isSaving ? 'Отправляем код…' : 'Не помните пароль? Получить код на почту'}
              </button>
            )}
          </div>

          <p className="mt-3 text-center text-[12px] text-[#999999]">
            После смены пароля вы останетесь в системе, но выйдете на других
            устройствах.
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={handleClosePasswordStep}
            className="rounded-xl border border-[#999999]/30 px-5 py-2.5 text-[14px] font-medium text-[#171215] outline-none transition-colors hover:bg-[#171215]/5 focus-visible:bg-[#171215]/5"
          >
            Отменить
          </button>
          <button
            type="submit"
            form={PASSWORD_FORM_ID}
            disabled={
              (pwMode === 'code' ? pwCode.length !== 6 : !currentPassword) ||
              !newPassword ||
              !confirmPassword ||
              isChangingPassword
            }
            className="rounded-xl bg-[#3248F2] px-5 py-2.5 text-[14px] font-medium text-white outline-none transition-colors hover:bg-[#2839c9] focus-visible:bg-[#2839c9] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isChangingPassword ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </>
    )
  }

  // The confirmation step replaces the form entirely rather than sitting under
  // it: the address isn't changed yet, so leaving the editable field on screen
  // would invite editing it while a code for the old value is outstanding.
  if (emailStep === 'address') {
    return (
      <>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">
          <p className="text-center text-[14px] text-[#999999]">
            Текущий адрес
          </p>
          <p className="mt-0.5 text-center text-[14px] font-semibold text-[#171215]">
            {user?.email}
          </p>

          <form
            id={EMAIL_FORM_ID}
            onSubmit={handleSubmitNewEmail}
            noValidate
            className="mt-5"
          >
            <input
              type="email"
              value={newEmail}
              onChange={(event) => {
                setNewEmail(event.target.value)
                setEmailError('')
              }}
              placeholder="Новый email"
              autoComplete="email"
              autoFocus
              className={`w-full rounded-lg border bg-white px-3.5 py-2 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#3248F2] ${
                emailError ? 'border-[#DC2626]' : 'border-[#999999]/35'
              }`}
            />
          </form>

          {emailError ? (
            <p role="alert" className="mt-2 text-[13px] text-[#DC2626]">
              {emailError}
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-[#999999]">
              На новый адрес придёт код подтверждения. Пока вы его не введёте,
              адрес аккаунта не изменится.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={() => setEmailStep(null)}
            className="rounded-xl border border-[#999999]/30 px-5 py-2.5 text-[14px] font-medium text-[#171215] outline-none transition-colors hover:bg-[#171215]/5 focus-visible:bg-[#171215]/5"
          >
            Отменить
          </button>
          <button
            type="submit"
            form={EMAIL_FORM_ID}
            disabled={!newEmail.trim() || isSaving}
            className="rounded-xl bg-[#3248F2] px-5 py-2.5 text-[14px] font-medium text-white outline-none transition-colors hover:bg-[#2839c9] focus-visible:bg-[#2839c9] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSaving ? 'Отправляем…' : 'Отправить код'}
          </button>
        </div>
      </>
    )
  }

  if (emailStep === 'code' && pendingEmail) {
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

          <div className="mt-3 flex flex-col items-center gap-1.5">
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
            {pendingEmail !== user?.email && (
              <button
                type="button"
                onClick={handleCancelEmailChange}
                className="text-[13px] font-medium text-[#999999] outline-none hover:underline"
              >
                Отменить смену email
              </button>
            )}
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

          {/* Only offered when there's a picture to remove, so it never sits
              there as a dead control on a default avatar. */}
          {avatarSrc && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={isSaving}
              className="rounded-lg px-2 py-0.5 text-[13px] font-medium text-[#999999] outline-none transition-colors hover:text-[#DC2626] focus-visible:text-[#DC2626] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Удалить фото
            </button>
          )}

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
        </form>

        {/* Email and password both sit outside the form: neither is saved by
            the Save button, each opens its own verified step instead. */}
        <ActionRow
          label="Email"
          value={user?.email || ''}
          action="Изменить"
          onAction={handleStartEmailChange}
          disabled={isSaving}
          footer={emailStatus}
        />

        <ActionRow
          label="Пароль"
          value="••••••••"
          valueClassName="tracking-[0.2em]"
          action="Изменить"
          onAction={handleStartPasswordChange}
          disabled={isSaving}
          footer={
            pwChanged && (
              <p
                role="status"
                className="inline-flex items-center gap-1.5 text-[13px] text-[#16A34A]"
              >
                <HugeiconsIcon
                  icon={Tick02Icon}
                  size={15}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.1}
                />
                Пароль изменён.
              </p>
            )
          }
        />

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
          disabled={!isDirty || isSaving}
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
