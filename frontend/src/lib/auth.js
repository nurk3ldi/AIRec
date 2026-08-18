import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { me, refresh } from './api'

const ACCESS_TOKEN_KEY = 'airec_access_token'
const REFRESH_TOKEN_KEY = 'airec_refresh_token'

export function saveTokens({ access_token, refresh_token }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function isAuthenticated() {
  return Boolean(getAccessToken())
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
