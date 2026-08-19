import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { me, refresh } from './api'

const ACCESS_TOKEN_KEY = 'airec_access_token'
const REFRESH_TOKEN_KEY = 'airec_refresh_token'

/**
 * "Запомнить меня" is answered by *which store the tokens go into*, and the
 * two browser stores already mean exactly the two things being asked:
 *
 *   localStorage    survives the browser closing — remembered
 *   sessionStorage  cleared with the tab — not remembered
 *
 * That is only half of it. The backend takes the same flag on `POST /auth/login`
 * and grants a matching refresh-token lifetime (30 days vs 12 hours), because
 * dropping the token here would otherwise leave a live credential on the server
 * that nobody holds — visible to the owner as a device in «Активные сессии»
 * that has not existed for a month.
 *
 * Worth knowing: sessionStorage is *per tab*. Opening AIRec in a second tab
 * after choosing not to be remembered asks for the password again. That is the
 * behaviour the choice describes, not a bug — but it is why the box is ticked
 * by default.
 *
 * Only one store ever holds a session: writing to either clears the other, so
 * the readers below can take the first hit without deciding anything.
 */
function tokenStore(remember) {
  return remember ? localStorage : sessionStorage
}

function currentStore() {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY) ? sessionStorage : localStorage
}

function read(key) {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(key) ?? localStorage.getItem(key)
}

/**
 * `remember` is stated only by a fresh sign-in. A rotation omits it and stays
 * in the store it is already in — passing `remember` there would let a session
 * the user asked not to remember promote itself to a permanent one the first
 * time its 15-minute access token ran out.
 */
export function saveTokens({ access_token, refresh_token }, { remember } = {}) {
  const store = remember === undefined ? currentStore() : tokenStore(remember)
  const other = store === localStorage ? sessionStorage : localStorage

  other.removeItem(ACCESS_TOKEN_KEY)
  other.removeItem(REFRESH_TOKEN_KEY)
  store.setItem(ACCESS_TOKEN_KEY, access_token)
  store.setItem(REFRESH_TOKEN_KEY, refresh_token)
}

export function getAccessToken() {
  return read(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return read(REFRESH_TOKEN_KEY)
}

/** Clears both stores — a sign-out must not leave a stale pair in the other. */
export function clearTokens() {
  if (typeof window === 'undefined') return
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(ACCESS_TOKEN_KEY)
    store.removeItem(REFRESH_TOKEN_KEY)
  }
}

/**
 * Confirms the current session against the backend, transparently rotating
 * an expired access token via the refresh token when needed.
 *
 * Returns the current user on success, or `null` (after clearing whatever
 * tokens turned out to be dead) when there is no valid session.
 */
export async function verifySession() {
  const accessToken = getAccessToken()
  if (accessToken) {
    try {
      return await me(accessToken)
    } catch {
      // Expired, invalid, or the server is briefly unreachable — fall through
      // and try to recover via the refresh token below rather than failing here.
    }
  }

  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    clearTokens()
    return null
  }

  try {
    const { user, tokens } = await refresh(refreshToken)
    saveTokens(tokens)
    return user
  } catch {
    clearTokens()
    return null
  }
}

/**
 * Redirects to /login when there is no valid session. Use in the dashboard shell.
 * Returns the signed-in user once the check has run, or `null` while it's still
 * in flight — callers must render nothing until it's non-null, so protected
 * content never flashes on screen. The user is returned rather than a bare
 * boolean so the shell can show their avatar without a second `/auth/me` call.
 */
export function useRequireAuth() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [user, setUser] = useState(null)

  useEffect(() => {
    let cancelled = false

    verifySession().then((me) => {
      if (cancelled) return
      if (me) {
        setUser(me)
      } else {
        navigate('/login', { replace: true })
      }
    })

    return () => {
      cancelled = true
    }
    // Only the mount/route-change matters here, not the navigate identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return user
}

/** Redirects a visitor with a valid session away from login/signup. */
export function useRedirectIfAuthed(destination = '/dashboard') {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    verifySession().then((user) => {
      if (!cancelled && user) {
        navigate(destination, { replace: true })
      }
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
