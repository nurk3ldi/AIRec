import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError, me, refresh } from './api'

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
  return sessionStorage.getItem(REFRESH_TOKEN_KEY)
    ? sessionStorage
    : localStorage
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
 *
 * **Single-flight, and that is load-bearing.** A refresh token is good for
 * exactly one use, so two overlapping checks would send the same one twice.
 * There are two easy ways to get there: `<StrictMode>` double-invokes every
 * effect in development, and `useRequireAuth` re-runs on each route change, so
 * a quick navigation can start a second check before the first has answered.
 * The backend now refuses the loser of that race outright — before it did, both
 * won, and one session ended up with two live tokens showing as two identical
 * devices in «Активные сессии». Sharing one in-flight promise means the
 * question is only ever asked once.
 */
let inFlight = null

export function verifySession() {
  if (!inFlight) {
    inFlight = runVerify().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

async function runVerify(isRetry = false) {
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
    // The in-flight promise above is per tab, and `localStorage` is not: a
    // second tab can rotate the token while this request is on the wire, so
    // ours comes back rejected on a token that really is spent — while the
    // session is alive and its replacement is already in storage. Clearing here
    // would sign both tabs out over a race neither of them lost. Once only: if
    // the stored token has not moved, the session is genuinely gone.
    const stored = getRefreshToken()
    if (!isRetry && stored && stored !== refreshToken) return runVerify(true)

    clearTokens()
    return null
  }
}

/**
 * Runs an authenticated call, and renews the session once if the token has died
 * under it.
 *
 * **The access token lives fifteen minutes and nothing was renewing it.**
 * `verifySession()` runs when the dashboard shell mounts and on every route
 * change, which covers arriving at a page and covers nothing after that: leave
 * a screen open through lunch and the next request it makes — a booking being
 * saved, a week being reloaded — comes back «Access token is invalid or
 * expired.» with a live session sitting in storage behind it. The refresh token
 * is good for thirty days; only the fifteen-minute half was ever being used.
 *
 * So every data call goes through here: try it, and on the *one* error that
 * means "this token specifically", renew and try again.
 *
 * **It renews through `verifySession()` rather than calling `refresh()` itself,
 * and that is the load-bearing part.** A page makes several of these at once —
 * the week, the price list, the business — so several will hit the wall in the
 * same instant. `verifySession()` is single-flight, so they share one renewal;
 * calling `refresh()` from each would send the same refresh token three times,
 * and a replayed refresh token is treated as theft and revokes every session
 * the user has. The grace window on the server forgives that, but a client that
 * needs forgiving is a client waiting to be caught out.
 *
 * Only `not_authenticated` is retried. A 404, a 409 or a validation error means
 * the call itself was wrong, and running it twice would not make it right.
 */
export async function authed(call) {
  const token = getAccessToken()
  let failure = null

  if (token) {
    try {
      return await call(token)
    } catch (error) {
      if (error.code !== 'not_authenticated') throw error
      failure = error
    }
  }

  const user = await verifySession()
  if (!user) {
    // `verifySession` has already cleared the tokens; the shell's own check
    // takes the visitor to /login on its next run. What matters here is that
    // the caller hears about it rather than seeing an empty screen.
    throw (
      failure ??
      new ApiError({
        code: 'not_authenticated',
        message: 'Требуется вход в систему.',
        status: 401,
      })
    )
  }

  return call(getAccessToken())
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
