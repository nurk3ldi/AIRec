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
import { authed, clearTokens } from '../../lib/auth'
import { getLocale, translate, useT } from '../../lib/i18n'
import Skeleton, { SkeletonRegion } from '../Skeleton'

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

  // The locale follows the interface language rather than being pinned to
  // `ru-RU`: month names and the 12/24-hour choice are part of the translation,
  // not decoration on top of it.
  const locale = getLocale()
  const time = value.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
  const today = new Date()
  const isSameDay = (a, b) => a.toDateString() === b.toDateString()

  if (isSameDay(value, today)) return translate('security.today', { time })

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(value, yesterday))
    return translate('security.yesterday', { time })

  return value.toLocaleDateString(locale, {
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
  const t = useT()
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
    authed(listSessions)
      .then(setSessions)
      .catch((err) => setError(err.message))

  useEffect(() => {
    let cancelled = false
    authed(listSessions)
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
      await authed((token) => revokeSession(token, id))
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
      await authed(revokeOtherSessions)
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
      await authed((token) =>
        deleteAccount(token, {
          currentPassword: deletePassword,
          confirmation,
        }),
      )
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-2 pb-6">
      <p className="shrink-0 text-[14px] text-muted">{t('security.lead')}</p>

      {error && (
        <p
          role="alert"
          className="mt-4 inline-flex shrink-0 items-center gap-1.5 text-[13px] text-danger"
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
        // **The rows, not the word.** «Загрузка…» is a sentence where a list is
        // about to be, so the panel changed shape twice — once to say it was
        // asking and once to answer. Three placeholder rows at the real row's
        // height say the same thing and leave the layout alone.
        <SkeletonRegion
          label={t('security.loading')}
          className="mt-4 flex shrink-0 flex-col gap-2"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </SkeletonRegion>
      ) : (
        <div className="mt-4 flex shrink-0 flex-col gap-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium text-ink">
                    {session.device}
                  </span>
                  {session.is_current && (
                    <span className="rounded-md bg-ok/10 px-2 py-0.5 text-[12px] font-medium text-ok">
                      {t('security.current')}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[13px] text-muted">
                  {session.ip_address ? `${session.ip_address} · ` : ''}
                  {t('security.signedIn')}: {formatMoment(session.signed_in_at)}{' '}
                  · {t('security.lastActive')}:{' '}
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
                  aria-label={t('security.revoke')}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted outline-none transition-colors hover:bg-danger/8 hover:text-danger focus-visible:bg-danger/8 focus-visible:text-danger disabled:cursor-not-allowed disabled:opacity-50"
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
              className="mt-2 self-start rounded-xl border border-danger/30 px-4 py-2 text-[13px] font-medium text-danger outline-none transition-colors hover:bg-danger/6 focus-visible:bg-danger/6 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRevokingOthers
                ? t('security.revoking')
                : t('security.revokeOthers', { count: otherCount })}
            </button>
          )}
        </div>
      )}

      {/* Kept behind a disclosure and held to the bottom edge: this is the one
          action on the page that isn't undoable by clicking again, and the run
          of empty panel above it is what keeps a cursor travelling down the
          session list from arriving on it.

          `mt-auto` over a `pt-8` floor, the same pair `/profile` uses for its
          sign-out — the auto margin alone collapses the moment the sessions
          list is long enough to scroll, and the two blocks would touch.

          The `shrink-0` on every top-level child here is what makes that column
          scroll rather than squash: a flex item defaults to `flex-shrink: 1`,
          so a long session list would be compressed toward its min-content
          height inside the fixed panel instead of overflowing it. */}
      <div className="mt-auto shrink-0 pt-8">
        <div className="rounded-xl border border-danger/25 bg-danger/4 p-4">
          <h3 className="text-[14px] font-semibold text-danger">
            {t('security.deleteTitle')}
          </h3>

          {!isDeleteOpen ? (
            <>
              <p className="mt-1 text-[13px] text-ink/70">
                {t('security.deleteLead', { days: GRACE_DAYS })}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteOpen(true)
                  setDeleteError('')
                }}
                className="mt-3 ml-auto block rounded-xl border border-danger/40 px-4 py-2 text-[13px] font-medium text-danger outline-none transition-colors hover:bg-danger/8 focus-visible:bg-danger/8"
              >
                {t('security.deleteAction')}
              </button>
            </>
          ) : (
            <form
              onSubmit={handleDelete}
              noValidate
              className="mt-3 flex flex-col gap-3"
            >
              <p className="text-[13px] text-ink/70">
                {t('security.deleteWarning', { days: GRACE_DAYS })}
              </p>

              <div className="relative flex items-center">
                <input
                  type={showDeletePassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(event) => {
                    setDeletePassword(event.target.value)
                    setDeleteError('')
                  }}
                  placeholder={t('security.currentPassword')}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2 pr-11 text-[14px] text-ink outline-none transition-colors placeholder:text-muted focus:border-danger"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword((prev) => !prev)}
                  aria-label={t(
                    showDeletePassword
                      ? 'form.hidePassword'
                      : 'form.showPassword',
                  )}
                  className="absolute right-3 grid place-items-center text-muted transition-colors hover:text-ink"
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
                  className="text-[13px] text-ink/70"
                >
                  {t('security.confirmBefore')}{' '}
                  <span className="font-semibold">{user?.username}</span>
                  {t('security.confirmAfter')}
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
                  className="w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-[14px] text-ink outline-none transition-colors placeholder:text-muted focus:border-danger"
                />
              </div>

              {deleteError && (
                <p role="alert" className="text-[13px] text-danger">
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
                  className="rounded-xl border border-line px-4 py-2 text-[13px] font-medium text-ink outline-none transition-colors hover:bg-ink/5 focus-visible:bg-ink/5"
                >
                  {t('form.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!deletePassword || !confirmation || isDeleting}
                  className="rounded-xl bg-danger px-4 py-2 text-[13px] font-medium text-white outline-none transition-colors hover:bg-[#B91C1C] focus-visible:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {t(
                    isDeleting ? 'security.deleting' : 'security.deleteAction',
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
