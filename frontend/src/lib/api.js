import { getLanguage, translate } from './i18n'

/**
 * Where the backend is.
 *
 * Relative by default, on purpose. In development the Vite dev server proxies
 * `/api` and `/media` to the backend on 127.0.0.1, so the browser only ever
 * talks to the origin it loaded the page from — which is what lets a phone on
 * the Wi-Fi use the API without the backend leaving localhost, without a
 * firewall rule for its port, and without CORS being involved at all.
 *
 * `VITE_API_URL` wins when set: that is how you point at a deployed backend, or
 * at one running somewhere the proxy cannot reach.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

// Uploaded files are served from the backend root (/media/...), not from under
// the versioned API prefix, so strip it to get the origin. With the default
// relative base this comes out empty, which is right: `/media/x.png` is then
// resolved against the page's own origin and goes through the same proxy.
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '')

/** Turns a backend-relative path like `/media/avatars/x.png` into a full URL. */
export function mediaUrl(path) {
  if (!path) return null
  return path.startsWith('http') ? path : `${API_ORIGIN}${path}`
}

export class ApiError extends Error {
  constructor({ code, message, fields, status }) {
    super(message)
    this.code = code
    this.fields = fields || []
    this.status = status
  }
}

/**
 * How long to wait before deciding the server is not there.
 *
 * Without it a request to a host that is reachable but has nothing listening —
 * a phone pointed at a laptop whose backend is bound to localhost, say — sits
 * unanswered until the operating system's TCP timeout, which can be a minute or
 * more. `fetch` never rejects in that window, so the form shows «Входим…» and
 * nothing else, forever. Ten seconds is long enough for a slow upload to start
 * and short enough that a dead backend says so while you are still looking.
 */
const REQUEST_TIMEOUT_MS = 10_000

async function request(path, { method = 'GET', body, formData, accessToken } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        // Never set Content-Type for FormData — the browser has to add its own
        // multipart boundary, and setting it by hand breaks the upload.
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        // The backend words its own errors, so it has to be told which language
        // to word them in — otherwise a reader on Kazakh or English gets the
        // whole UI translated and every failure in Russian. Read at call time,
        // not at import: the language can change while the tab is open.
        'Accept-Language': getLanguage(),
      },
      body: formData ?? (body ? JSON.stringify(body) : undefined),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new ApiError({
      code: error?.name === 'TimeoutError' ? 'timeout' : 'network_error',
      // `translate`, not `useT`: this is not a component, and the call happens
      // at throw time rather than at import, so it picks up whatever language
      // is in force when the request actually fails.
      //
      // Only the two failures *we* generate are translated. Everything the
      // backend returns below arrives already worded, in Russian, and stays
      // that way until the API learns `Accept-Language`.
      message: translate(
        error?.name === 'TimeoutError' ? 'error.timeout' : 'error.network'
      ),
    })
  }

  if (response.status === 204) return null

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = data?.error
    throw new ApiError({
      code: error?.code || 'unknown_error',
      message: error?.message || translate('error.unknown'),
      fields: error?.fields,
      status: response.status,
    })
  }

  return data
}

export function register({ username, email, password }) {
  return request('/auth/register', {
    method: 'POST',
    body: { username, email, password },
  })
}

export function checkUsernameAvailability(username) {
  return request(`/auth/username-availability?username=${encodeURIComponent(username)}`)
}

/**
 * `remember` decides how long the refresh token lives — 30 days against 12
 * hours. It has to be sent, not inferred: the server defaults it to `false`,
 * so an omitted flag signs you out by evening. `lib/auth.js` handles the other
 * half, choosing the store the tokens are kept in.
 */
export function login({ identifier, password, remember = false }) {
  return request('/auth/login', {
    method: 'POST',
    body: { identifier, password, remember },
  })
}

export function refresh(refreshToken) {
  return request('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
}

export function logout(refreshToken) {
  return request('/auth/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
}

export function me(accessToken) {
  return request('/auth/me', { method: 'GET', accessToken })
}

export function updateProfile(accessToken, changes) {
  return request('/auth/me', { method: 'PATCH', body: changes, accessToken })
}

/**
 * Starts an email change: sends a 6-digit code to `newEmail`.
 * The account keeps its current address until `confirmEmailChange` succeeds —
 * `updateProfile` deliberately cannot change the email at all.
 */
export function requestEmailChange(accessToken, newEmail) {
  return request('/auth/me/email-change', {
    method: 'POST',
    body: { new_email: newEmail },
    accessToken,
  })
}

/** Drops a pending change. Idempotent — safe to call with nothing pending. */
export function cancelEmailChange(accessToken) {
  return request('/auth/me/email-change', { method: 'DELETE', accessToken })
}

/** `{pending_email}` — null once there is nothing left to confirm. */
export function getPendingEmailChange(accessToken) {
  return request('/auth/me/email-change', { method: 'GET', accessToken })
}

/** Applies the pending change; resolves to the updated user. */
export function confirmEmailChange(accessToken, code) {
  return request('/auth/me/email-change/confirm', {
    method: 'POST',
    body: { code },
    accessToken,
  })
}

/** Emails a 6-digit code authorising a password change for the signed-in user. */
export function requestPasswordChange(accessToken) {
  return request('/auth/me/password-change', { method: 'POST', accessToken })
}

/**
 * Sets the new password, proved by *either* `currentPassword` or `code` — the
 * backend rejects both together. Resolves to `{user, tokens}`: every session is
 * revoked, so the caller must save the returned tokens or it logs itself out.
 */
export function confirmPasswordChange(
  accessToken,
  { code, currentPassword, newPassword }
) {
  return request('/auth/me/password-change/confirm', {
    method: 'POST',
    body: {
      new_password: newPassword,
      ...(code ? { code } : { current_password: currentPassword }),
    },
    accessToken,
  })
}

/**
 * Schedules the account for deletion. The row survives the grace period, so
 * `restoreAccount` can bring it back until then. Signs out every device.
 */
export function deleteAccount(accessToken, { currentPassword, confirmation }) {
  return request('/auth/me/delete', {
    method: 'POST',
    body: { current_password: currentPassword, confirmation },
    accessToken,
  })
}

/** Undoes a deletion still inside its grace period and signs the user back in.
 *  Takes `remember` for the same reason `login` does — it is the same form. */
export function restoreAccount({ identifier, password, remember = false }) {
  return request('/auth/restore', {
    method: 'POST',
    body: { identifier, password, remember },
  })
}

/** Devices currently signed in: `[{id, device, ip_address, …, is_current}]`. */
export function listSessions(accessToken) {
  return request('/auth/me/sessions', { method: 'GET', accessToken })
}

export function revokeSession(accessToken, sessionId) {
  return request(`/auth/me/sessions/${sessionId}`, { method: 'DELETE', accessToken })
}

/** Signs out every device except the one making the call. */
export function revokeOtherSessions(accessToken) {
  return request('/auth/me/sessions', { method: 'DELETE', accessToken })
}

export function uploadAvatar(accessToken, blob) {
  const formData = new FormData()
  formData.append('file', blob, 'avatar.png')
  return request('/auth/me/avatar', { method: 'POST', formData, accessToken })
}

export function deleteAvatar(accessToken) {
  return request('/auth/me/avatar', { method: 'DELETE', accessToken })
}

/**
 * The account's business. Created empty on the server the first time it's
 * asked for, so this never 404s and callers need no "not set up yet" branch.
 */
export function getBusiness(accessToken) {
  return request('/business', { method: 'GET', accessToken })
}

export function updateBusiness(accessToken, changes) {
  return request('/business', { method: 'PATCH', body: changes, accessToken })
}

export function uploadBusinessLogo(accessToken, blob) {
  const formData = new FormData()
  formData.append('file', blob, 'logo.png')
  return request('/business/logo', { method: 'POST', formData, accessToken })
}

export function deleteBusinessLogo(accessToken) {
  return request('/business/logo', { method: 'DELETE', accessToken })
}

export function getServices(accessToken) {
  return request('/business/services', { method: 'GET', accessToken })
}

/**
 * Sends the price list whole. Rows keep their `id` so the server updates them
 * in place; a row without one is new, and anything left out is deleted.
 */
export function saveServices(accessToken, services) {
  return request('/business/services', {
    method: 'PUT',
    body: { services },
    accessToken,
  })
}

export function getWorkingHours(accessToken) {
  return request('/business/working-hours', { method: 'GET', accessToken })
}

export function saveWorkingHours(accessToken, days) {
  return request('/business/working-hours', {
    method: 'PUT',
    body: { days },
    accessToken,
  })
}

/**
 * Bookings overlapping a span of local days, `from`/`to` as `YYYY-MM-DD`.
 *
 * `query` searches the client's name and phone; sent on its own, without dates,
 * the server drops the range and looks through the whole history.
 */
export function listAppointments(accessToken, { from, to, status, query } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (query) params.set('query', query)
  // Repeated rather than comma-joined — the endpoint takes one per status.
  for (const item of status ?? []) params.append('status', item)

  return request(`/appointments?${params}`, { method: 'GET', accessToken })
}

/**
 * Start times a service still fits into on a local day, already filtered by
 * opening hours, breaks, bookings taken, notice and horizon — so the client
 * never has to re-derive any of those rules to know what it may offer.
 */
export function getSlots(accessToken, { serviceId, day }) {
  const params = new URLSearchParams({ service_id: serviceId, day })
  return request(`/appointments/slots?${params}`, { method: 'GET', accessToken })
}

export function createAppointment(accessToken, booking) {
  return request('/appointments', {
    method: 'POST',
    body: booking,
    accessToken,
  })
}

/** Partial update — status, note, client, a new `service_id`, or a new
 *  `starts_at` to reschedule. Anything omitted is left as it was. */
export function updateAppointment(accessToken, id, changes) {
  return request(`/appointments/${id}`, {
    method: 'PATCH',
    body: changes,
    accessToken,
  })
}

/**
 * Removes the booking for good. Irreversible — ask before calling it.
 *
 * **Not** how a booking is cancelled: that is a status, and it goes through
 * `updateAppointment(token, id, { status: 'cancelled' })`. A cancelled booking
 * is one that fell through and is worth looking back on; this is for a row that
 * should never have existed.
 *
 * (It was named `cancelAppointment` until the endpoint stopped cancelling.
 * Renamed rather than repointed on purpose: an old caller now fails to build
 * instead of quietly deleting what it meant to cancel.)
 */
export function deleteAppointment(accessToken, id) {
  return request(`/appointments/${id}`, { method: 'DELETE', accessToken })
}

export function forgotPassword(email) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  })
}

export function resetPassword({ email, code, newPassword }) {
  return request('/auth/reset-password', {
    method: 'POST',
    body: { email, code, new_password: newPassword },
  })
}

/* --- the inbox ------------------------------------------------------------
 *
 * The conversations the assistant is having and the messages inside them. The
 * endpoints behind these are finished; what does not exist yet is the WhatsApp
 * channel that would put anything in them, so a new account's inbox is
 * genuinely empty rather than unfinished.
 */

/**
 * The thread list, newest first.
 *
 * Everything is optional and the defaults are the server's: archived threads
 * are left out unless asked for, and no filter means every thread that is not
 * archived. `archived: null` includes both, which is why it is checked against
 * `undefined` rather than for truthiness — `false` and `null` are two different
 * questions here.
 *
 * The list never carries messages. A hundred rows each dragging their history
 * behind them is what makes a list endpoint slow, so the transcript comes from
 * `getConversation` when a thread is actually opened.
 */
export function listConversations(
  accessToken,
  { query, archived, starred, status, limit, offset } = {},
) {
  const params = new URLSearchParams()
  if (query) params.set('query', query)
  if (archived !== undefined) params.set('archived', String(archived))
  if (starred !== undefined) params.set('starred', String(starred))
  if (limit !== undefined) params.set('limit', String(limit))
  if (offset !== undefined) params.set('offset', String(offset))
  // Repeated rather than comma-joined, like the bookings list.
  for (const item of status ?? []) params.append('status', item)

  return request(`/conversations?${params}`, { method: 'GET', accessToken })
}

/** One thread with its messages — the only shape that carries the transcript. */
export function getConversation(accessToken, id) {
  return request(`/conversations/${id}`, { method: 'GET', accessToken })
}

/**
 * The owner's own decisions about a thread: what to call the client, whether it
 * is dealt with, starred, out of the way — and whether the assistant may speak
 * in it. A PATCH, so an omitted field is left alone.
 */
export function updateConversation(accessToken, id, changes) {
  return request(`/conversations/${id}`, {
    method: 'PATCH',
    body: changes,
    accessToken,
  })
}

/** Clears the thread's unread count. Opening it is what calls this. */
export function markConversationRead(accessToken, id) {
  return request(`/conversations/${id}/read`, { method: 'POST', accessToken })
}

/**
 * Removes the thread and every message in it. Irreversible — ask before calling.
 *
 * **Not** how a thread is put out of the way: that is `archived`, a view flag
 * that leaves the conversation and its history where they were. This is for one
 * that should never have existed — a wrong number, a test.
 */
export function deleteConversation(accessToken, id) {
  return request(`/conversations/${id}`, { method: 'DELETE', accessToken })
}

/**
 * The transcript, oldest first.
 *
 * Separate from `getConversation` even though that one can carry messages too:
 * this is what a thread already on screen re-reads after something is said, and
 * it does not need the conversation's own row back with it.
 */
export function listMessages(accessToken, id, { limit, before } = {}) {
  const params = new URLSearchParams()
  if (limit !== undefined) params.set('limit', String(limit))
  if (before) params.set('before', before)
  return request(`/conversations/${id}/messages?${params}`, {
    method: 'GET',
    accessToken,
  })
}

/**
 * Records something we are saying. **It does not send it** — there is no
 * outbound channel yet, so this writes to the transcript and nothing leaves the
 * building. The screen has to say so.
 *
 * The author defaults to the owner on the server, and an owner's message
 * switches the assistant off for that thread. That is the rule the whole inbox
 * exists around: whoever steps in takes the thread over.
 */
export function createMessage(accessToken, id, body) {
  return request(`/conversations/${id}/messages`, {
    method: 'POST',
    body: { body },
    accessToken,
  })
}

/**
 * A client wrote — the one entrance for anything inbound.
 *
 * **What the real WhatsApp webhook will call**, and until it exists, what the
 * dev console on `/dev/client` calls so an inbox can be looked at with real
 * messages in it. It finds the thread by the provider's id or the number, opens
 * one if there is none, and drops a redelivery — hence `messageExternalId`,
 * which has to differ per message or the second one is recognised as a repeat.
 */
export function ingestMessage(
  accessToken,
  { clientPhone, clientName, body, messageExternalId },
) {
  return request('/conversations/ingest', {
    method: 'POST',
    body: {
      client_phone: clientPhone,
      client_name: clientName || null,
      body,
      message_external_id: messageExternalId,
    },
    accessToken,
  })
}
