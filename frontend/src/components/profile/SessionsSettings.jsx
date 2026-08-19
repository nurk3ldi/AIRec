import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  Cancel01Icon,
  EyeIcon,
  EyeOffIcon,
} from '@hugeicons/core-free-icons'
import {
  deleteAccount,
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from '../../lib/api'
import { clearTokens, getAccessToken } from '../../lib/auth'

// Mirrors `account_deletion_grace_days` on the backend. Only used for copy —
// the deadline the user is actually held to is the server's.
const GRACE_DAYS = 30

/**
 * "Сегодня, 14:30" for something recent, a plain date for anything older —
 * a timestamp is only useful here if you can place it at a glance.
 */
function formatMoment(iso) {
  const value = new Date(iso)
  if (Number.isNaN(value.getTime())) return ''

  const time = value.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const today = new Date()
  const isSameDay = (a, b) => a.toDateString() === b.toDateString()

  if (isSameDay(value, today)) return `Сегодня, ${time}`

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(value, yesterday)) return `Вчера, ${time}`

  return value.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: value.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

/**
 * The devices signed in to this account, with a way to sign each one out.
 *
 * Rotation revokes the token it replaces, so the backend returns exactly one
 * row per device — this list is not a token log, and shouldn't read like one.
 */
export default function SessionsSettings({ user }) {
  const navigate = useNavigate()

  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [isRevokingOthers, setIsRevokingOthers] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [showDeletePassword, setShowDeletePassword] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const load = () =>
    listSessions(getAccessToken())
      .then(setSessions)
      .catch((err) => setError(err.message))

  useEffect(() => {
    let cancelled = false
    listSessions(getAccessToken())
      .then((rows) => {
        if (!cancelled) setSessions(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleRevoke = async (id) => {
    setError('')
    setBusyId(id)
    try {
      await revokeSession(getAccessToken(), id)
      // Re-read rather than splicing locally: the server is the authority on
      // what's still live, and something may have expired meanwhile.
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleRevokeOthers = async () => {
    setError('')
    setIsRevokingOthers(true)
    try {
      await revokeOtherSessions(getAccessToken())
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsRevokingOthers(false)
    }
  }

  const handleDelete = async (event) => {
    event.preventDefault()
    setDeleteError('')
    setIsDeleting(true)
    try {
      await deleteAccount(getAccessToken(), {
        currentPassword: deletePassword,
        confirmation,
      })
      // Every session is gone server-side; drop the local copies too and leave
      // for the public side rather than letting the shell 401 its way out.
      clearTokens()
      navigate('/login?deleted=1')
    } catch (err) {
      setDeleteError(err.fields?.[0]?.message || err.message)
      setIsDeleting(false)
    }
  }

  const otherCount = sessions ? sessions.filter((s) => !s.is_current).length : 0

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">
      <p className="text-[14px] text-[#999999]">
        Устройства, на которых выполнен вход в ваш аккаунт. Если какое-то из них
        вам незнакомо — завершите сеанс и смените пароль.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-[#DC2626]"
        >
          <HugeiconsIcon
            icon={Alert02Icon}
            size={15}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.1}
          />
          {error}
        </p>
      )}

      {sessions === null ? (
        <p className="mt-4 text-[14px] text-[#999999]">Загружаем…</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 rounded-xl border border-[#999999]/25 bg-white px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium text-[#171215]">
                    {session.device}
                  </span>
                  {session.is_current && (
                    <span className="rounded-md bg-[#16A34A]/10 px-2 py-0.5 text-[12px] font-medium text-[#16A34A]">
                      Текущий
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[13px] text-[#999999]">
                  {session.ip_address ? `${session.ip_address} · ` : ''}
                  Вход: {formatMoment(session.signed_in_at)} · Активность:{' '}
                  {formatMoment(session.last_active_at)}
                </p>
              </div>

              {/* Ending the current session would sign you out of the page you
                  are standing on, so it isn't offered here — that's Выйти. */}
              {!session.is_current && (
                <button
                  type="button"
                  onClick={() => handleRevoke(session.id)}
                  disabled={busyId === session.id}
                  aria-label="Завершить сеанс"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#999999] outline-none transition-colors hover:bg-[#DC2626]/8 hover:text-[#DC2626] focus-visible:bg-[#DC2626]/8 focus-visible:text-[#DC2626] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={17}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </button>
              )}
            </div>
          ))}

          {otherCount > 0 && (
            <button
              type="button"
              onClick={handleRevokeOthers}
              disabled={isRevokingOthers}
              className="mt-2 self-start rounded-xl border border-[#DC2626]/30 px-4 py-2 text-[13px] font-medium text-[#DC2626] outline-none transition-colors hover:bg-[#DC2626]/6 focus-visible:bg-[#DC2626]/6 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRevokingOthers
                ? 'Завершаем…'
                : `Завершить остальные сеансы (${otherCount})`}
            </button>
          )}
        </div>
      )}

      {/* Kept behind a disclosure and visually separated: this is the one
          action on the page that isn't undoable by clicking again. */}
      <div className="mt-8 rounded-xl border border-[#DC2626]/25 bg-[#DC2626]/4 p-4">
        <h3 className="text-[14px] font-semibold text-[#DC2626]">Удаление аккаунта</h3>

        {!isDeleteOpen ? (
          <>
            <p className="mt-1 text-[13px] text-[#171215]/70">
              Аккаунт удаляется не сразу: {GRACE_DAYS} дней его можно
              восстановить, просто войдя снова. После этого удаление станет
              окончательным.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsDeleteOpen(true)
                setDeleteError('')
              }}
              className="mt-3 ml-auto block rounded-xl border border-[#DC2626]/40 px-4 py-2 text-[13px] font-medium text-[#DC2626] outline-none transition-colors hover:bg-[#DC2626]/8 focus-visible:bg-[#DC2626]/8"
            >
              Удалить аккаунт
            </button>
          </>
        ) : (
          <form onSubmit={handleDelete} noValidate className="mt-3 flex flex-col gap-3">
            <p className="text-[13px] text-[#171215]/70">
              Вы выйдете на всех устройствах. В течение {GRACE_DAYS} дней вход
              восстановит аккаунт. Всё это время ваш email и имя пользователя
              остаются занятыми.
            </p>

            <div className="relative flex items-center">
              <input
                type={showDeletePassword ? 'text' : 'password'}
                value={deletePassword}
                onChange={(event) => {
                  setDeletePassword(event.target.value)
                  setDeleteError('')
                }}
                placeholder="Текущий пароль"
                autoComplete="current-password"
                className="w-full rounded-lg border border-[#999999]/35 bg-white px-3.5 py-2 pr-11 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#DC2626]"
              />
              <button
                type="button"
                onClick={() => setShowDeletePassword((prev) => !prev)}
                aria-label={showDeletePassword ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute right-3 grid place-items-center text-[#999999] transition-colors hover:text-[#171215]"
              >
                <HugeiconsIcon
                  icon={showDeletePassword ? EyeIcon : EyeOffIcon}
                  size={18}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="delete-confirmation"
                className="text-[13px] text-[#171215]/70"
              >
                Введите <span className="font-semibold">{user?.username}</span>,
                чтобы подтвердить
              </label>
              <input
                id="delete-confirmation"
                type="text"
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value)
                  setDeleteError('')
                }}
                autoComplete="off"
                className="w-full rounded-lg border border-[#999999]/35 bg-white px-3.5 py-2 text-[14px] text-[#171215] outline-none transition-colors placeholder:text-[#999999] focus:border-[#DC2626]"
              />
            </div>

            {deleteError && (
              <p role="alert" className="text-[13px] text-[#DC2626]">
                {deleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteOpen(false)
                  setDeletePassword('')
                  setConfirmation('')
                  setDeleteError('')
                }}
                className="rounded-xl border border-[#999999]/30 px-4 py-2 text-[13px] font-medium text-[#171215] outline-none transition-colors hover:bg-[#171215]/5 focus-visible:bg-[#171215]/5"
              >
                Отменить
              </button>
              <button
                type="submit"
                disabled={!deletePassword || !confirmation || isDeleting}
                className="rounded-xl bg-[#DC2626] px-4 py-2 text-[13px] font-medium text-white outline-none transition-colors hover:bg-[#B91C1C] focus-visible:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isDeleting ? 'Удаляем…' : 'Удалить аккаунт'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
