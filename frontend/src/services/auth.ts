/*
 * Authentication against the ModelFit backend (/api/v1/auth).
 * The JWT is stored locally and attached to authenticated API requests.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const TOKEN_KEY = 'modelfit_access_token'
const USER_KEY = 'modelfit_user'

export interface Credentials {
  email: string
  password: string
}

export interface User {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type UserProfile = User
export type AuthResult = { status: 'ok' } | { status: 'error'; message: string }

const UNREACHABLE = 'The account service could not be reached. Check that the backend is running, then try again.'

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // The session can still be used for this page even if storage is unavailable.
  }
}

function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore unavailable storage.
  }
}

function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const exp = (JSON.parse(json) as { exp?: unknown }).exp
    return typeof exp === 'number' ? exp : null
  } catch {
    return null
  }
}

export function getAuthToken(): string | null {
  const token = storageGet(TOKEN_KEY)
  if (!token) return null
  const exp = tokenExpiry(token)
  if (exp === null || exp * 1000 <= Date.now()) {
    logOut()
    return null
  }
  return token
}

export function getToken(): string | null {
  return getAuthToken()
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null
}

export function getStoredUser(): User | null {
  const raw = storageGet(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function getCurrentUser(): User | null {
  return getStoredUser()
}

export function logOut(): void {
  storageRemove(TOKEN_KEY)
  storageRemove(USER_KEY)
}

export function clearSession(): void {
  logOut()
}

export function saveSession(token: string, user: User): void {
  storageSet(TOKEN_KEY, token)
  storageSet(USER_KEY, JSON.stringify(user))
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as {
      detail?: string | { msg?: string }[]
      error?: { message?: string }
    }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      return body.detail[0].msg.replace(/^Value error, /, '')
    }
    if (body.error?.message) return body.error.message
  } catch {
    // Non-JSON response, such as a proxy error page.
  }
  return res.status >= 500 ? UNREACHABLE : fallback
}

async function authenticate(
  path: 'signup' | 'login',
  credentials: Credentials,
  fallback: string,
): Promise<AuthResult> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
  } catch {
    return { status: 'error', message: UNREACHABLE }
  }

  if (!res.ok) return { status: 'error', message: await errorMessage(res, fallback) }

  const data = (await res.json()) as { access_token: string; user: User }
  saveSession(data.access_token, data.user)
  return { status: 'ok' }
}

export function signUp(credentials: Credentials): Promise<AuthResult> {
  return authenticate('signup', credentials, 'Sign-up failed. Try again.')
}

export function logIn(credentials: Credentials): Promise<AuthResult> {
  return authenticate('login', credentials, 'Incorrect email or password.')
}

export function getAuthHeaders(): { Authorization?: string } {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (res.status === 401) logOut()
  return res
}

export async function fetchCurrentUser(): Promise<User | null> {
  if (!getAuthToken()) return null
  const res = await authFetch('/auth/me')
  if (!res.ok) return null
  const user = (await res.json()) as User
  storageSet(USER_KEY, JSON.stringify(user))
  return user
}
