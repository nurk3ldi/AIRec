const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'

// Uploaded files are served from the backend root (/media/...), not from under
// the versioned API prefix, so strip it to get the origin.
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
      },
      body: formData ?? (body ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new ApiError({
      code: 'network_error',
      message: 'Cannot reach the server. Is the backend running?',
    })
  }

  if (response.status === 204) return null

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = data?.error
    throw new ApiError({
      code: error?.code || 'unknown_error',
      message: error?.message || 'Something went wrong.',
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

export function login({ identifier, password }) {
  return request('/auth/login', {
    method: 'POST',
    body: { identifier, password },
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

/** Undoes a deletion still inside its grace period and signs the user back in. */
export function restoreAccount({ identifier, password }) {
  return request('/auth/restore', {
    method: 'POST',
    body: { identifier, password },
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
