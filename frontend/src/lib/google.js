import { useEffect, useRef, useState } from 'react'
import { getAuthProviders } from './api'

/**
 * Google's own client library, loaded once, on the pages that need it.
 *
 * **Loaded on demand rather than from `index.html`**: only the two auth pages
 * use it, and a third-party script on every screen of the dashboard is weight
 * and a network dependency for nothing. The promise is kept at module level so
 * a second page — or React's double-invoked effect — reuses the first load.
 */
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise = null

function loadScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      // Forget the failed attempt, so opening the page again can try again.
      scriptPromise = null
      reject(new Error('google_script_failed'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Sign in with Google through the token model.
 *
 * **Everything is prepared before the press, and the press only opens the
 * popup.** A browser allows a popup only inside the click that caused it; an
 * `await` between the click and `requestAccessToken` — fetching the client id,
 * loading the script — ends that allowance and the popup is blocked. So the id
 * and the library are fetched when the page opens, the token client is built
 * then, and `start` does nothing but open the window, synchronously.
 *
 * `status` is `'loading'`, `'ready'`, `'unconfigured'` (the server has no
 * client id) or `'failed'` (the script would not load). The callbacks live in
 * refs so the token client built once always calls the latest ones.
 *
 * **Why the token model and not Google's rendered button**: that button draws
 * itself, and the auth pages already have theirs. See `app/core/google.py` for
 * why an access token is safe to accept — the server checks it was issued to
 * this client id.
 */
export function useGoogleSignIn({ onToken, onError }) {
  const [status, setStatus] = useState('loading')
  const client = useRef(null)
  const handlers = useRef({ onToken, onError })
  handlers.current = { onToken, onError }

  useEffect(() => {
    let alive = true

    getAuthProviders()
      .then(async ({ google_client_id: clientId }) => {
        if (!clientId) {
          if (alive) setStatus('unconfigured')
          return
        }
        await loadScript()
        if (!alive) return
        client.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: (response) => {
            if (response.error) handlers.current.onError?.(response.error)
            else handlers.current.onToken?.(response.access_token)
          },
          // The popup closed or never opened — reported apart from a refusal,
          // because closing it is a person changing their mind, not a failure.
          error_callback: (error) => handlers.current.onError?.(error.type),
        })
        setStatus('ready')
      })
      .catch(() => alive && setStatus('failed'))

    return () => {
      alive = false
    }
  }, [])

  const start = () => {
    // `select_account` every time: a shared or family computer is exactly
    // where silently reusing the last Google account would sign in the wrong
    // person.
    client.current?.requestAccessToken({ prompt: 'select_account' })
  }

  return { status, start }
}
