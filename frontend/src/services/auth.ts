/*
  Authentication against the ModelFit backend (/api/v1/auth).

  The backend returns a JWT on sign-up and log-in. It is kept in localStorage
  and sent as `Authorization: Bearer <token>` by authFetch(). In development
  the Vite dev server proxies /api to the backend (see vite.config.ts), so no
  CORS setup is needed. Set VITE_API_BASE_URL to point somewhere else.
*/

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'
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

export type AuthResult = { status: 'ok' } | { status: 'error'; message: string }

const UNREACHABLE = 'The account service could not be reached. Check that the backend is running, then try again.'

/* ---------- storage ---------- */

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage blocked (private mode etc.). The session just won't persist.
  }
}

function storageRemove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/** Reads the `exp` claim (seconds) without verifying. The server verifies; this only avoids using a dead token. */
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

/** Whether the visitor has an unexpired session token. */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null
}

/** The signed-in user as of the last sign-up, log-in or fetchCurrentUser(). */
export function getStoredUser(): User | null {
  const raw = storageGet(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function logOut(): void {
  storageRemove(TOKEN_KEY)
  storageRemove(USER_KEY)
}

/* ---------- requests ---------- */

/** Turns any backend error body into one readable sentence. */
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
    // Not JSON (e.g. proxy error page)
  }
  if (res.status >= 500) return UNREACHABLE
  return fallback
}

async function authenticate(path: 'signup' | 'login', credentials: Credentials, fallback: string): Promise<AuthResult> {
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
  storageSet(TOKEN_KEY, data.access_token)
  storageSet(USER_KEY, JSON.stringify(data.user))
  return { status: 'ok' }
}

export function signUp(credentials: Credentials): Promise<AuthResult> {
  return authenticate('signup', credentials, 'Sign-up failed. Try again.')
}

export function logIn(credentials: Credentials): Promise<AuthResult> {
  return authenticate('login', credentials, 'Incorrect email or password.')
}

/**
 * fetch() against the API with the session token attached.
 * A 401 means the session is no longer valid, so it is cleared.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (res.status === 401) logOut()
  return res
}

/** Confirms the session with the server and refreshes the stored user. Returns null if signed out. */
export async function fetchCurrentUser(): Promise<User | null> {
  if (!getAuthToken()) return null
  const res = await authFetch('/auth/me')
  if (!res.ok) return null
  const user = (await res.json()) as User
  storageSet(USER_KEY, JSON.stringify(user))
  return user
}
