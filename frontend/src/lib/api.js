const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'

export class ApiError extends Error {
  constructor({ code, message, fields, status }) {
    super(message)
    this.code = code
    this.fields = fields || []
    this.status = status
  }
}

async function request(path, { method = 'GET', body, accessToken } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
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
