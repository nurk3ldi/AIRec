import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { googleSignIn } from '../lib/api'
import { saveTokens } from '../lib/auth'
import { useGoogleSignIn } from '../lib/google'
import { useT } from '../lib/i18n'
import { BUTTON_SECONDARY } from './controls'

/**
 * «Продолжить с Google» — one component for the login page and the signup page.
 *
 * **Sign-in and sign-up are the same press.** Google says who is at the button;
 * the server finds the account by that or makes one (`POST /auth/google`), so a
 * person who registered with a password and a person who never visited both
 * press this and arrive. Two copies of this flow — popup, exchange, errors,
 * restore — would be two flows that agree until one of them is edited.
 *
 * **What it says, and when.** Closing Google's window is somebody changing
 * their mind, and says nothing. A blocked popup says how to allow it. A server
 * without a client id says the sign-in is not configured — on press, not by
 * hiding the button, because a button that silently vanishes on one machine and
 * not another is harder to understand than one that explains itself. While the
 * token is being exchanged the button reads «Входим…» and cannot be pressed
 * twice.
 *
 * **A deleted account is offered back, not refused.** Google has just proved
 * who this is — the same proof a password is — so, as on the login form, the
 * answer to `account_deleted` is a second button that restores the account with
 * the token already in hand, instead of a message that leaves the owner stuck.
 */
export default function GoogleButton({ remember = true }) {
  const t = useT()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [canRestore, setCanRestore] = useState(false)
  // The token from the last press, kept only for the restore button.
  const lastToken = useRef(null)

  const exchange = async (accessToken, restore = false) => {
    setBusy(true)
    setError('')
    try {
      const { tokens } = await googleSignIn({ accessToken, remember, restore })
      saveTokens(tokens, { remember })
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
      setCanRestore(err.code === 'account_deleted')
      setBusy(false)
    }
  }

  const { status, start } = useGoogleSignIn({
    onToken: (accessToken) => {
      lastToken.current = accessToken
      setCanRestore(false)
      exchange(accessToken)
    },
    onError: (type) => {
      setBusy(false)
      if (type === 'popup_closed') return
      setError(
        t(type === 'popup_failed_to_open' ? 'form.googleBlocked' : 'form.googleFailed'),
      )
    },
  })

  const press = () => {
    setError('')
    if (status === 'unconfigured') {
      setError(t('form.googleUnconfigured'))
      return
    }
    if (status === 'failed') {
      setError(t('form.googleFailed'))
      return
    }
    if (status !== 'ready') return
    start()
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={press}
        disabled={busy}
        aria-busy={busy || undefined}
        className={`${BUTTON_SECONDARY} flex items-center justify-center gap-2`}
      >
        <img src="/google_logo.svg" alt="" className="h-4 w-4" aria-hidden="true" />
        {t(busy ? 'form.googleBusy' : 'form.google')}
      </button>

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}

      {canRestore && lastToken.current && (
        <button
          type="button"
          onClick={() => exchange(lastToken.current, true)}
          disabled={busy}
          className={BUTTON_SECONDARY}
        >
          {t('login.restore')}
        </button>
      )}
    </div>
  )
}
