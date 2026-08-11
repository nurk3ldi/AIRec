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

export function uploadAvatar(accessToken, blob) {
  const formData = new FormData()
  formData.append('file', blob, 'avatar.png')
  return request('/auth/me/avatar', { method: 'POST', formData, accessToken })
}

export function deleteAvatar(accessToken) {
  return request('/auth/me/avatar', { method: 'DELETE', accessToken })
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
