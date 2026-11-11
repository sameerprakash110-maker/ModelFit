/*
  ModelFit Frontend Authentication Service
  Connects the web client to the backend authentication endpoints (/api/v1/auth/signup, /api/v1/auth/login, /api/v1/auth/me)
  and manages JWT session persistence via localStorage.
*/
import axios from 'axios'

export interface Credentials {
  email: string
  password: string
}

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuthSuccessPayload {
  access_token: string
  token_type: string
  user: UserProfile
}

export type AuthResult =
  | { status: 'ok' }
  | { status: 'error'; message: string }
  | { status: 'not-connected' }

const API_BASE_URL = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || '/api/v1'
const TOKEN_KEY = 'modelfit_access_token'
const USER_KEY = 'modelfit_user'

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const errorObj = err as { response?: { data?: { detail?: unknown; error?: { message?: string } } }; message?: string }
    if (errorObj.response?.data) {
      const data = errorObj.response.data
      if (typeof data.detail === 'string') return data.detail
      if (typeof data.error?.message === 'string') return data.error.message
      if (Array.isArray(data.detail) && data.detail.length > 0) {
        const first = data.detail[0] as { msg?: string }
        if (first?.msg) return first.msg
      }
    }
    if (typeof errorObj.message === 'string') {
      return errorObj.message
    }
  }
  return fallback
}

export function saveSession(token: string, user: UserProfile): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // Ignore localStorage failures in sandboxed contexts
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // Ignore
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getCurrentUser(): UserProfile | null {
  try {
    const userStr = localStorage.getItem(USER_KEY)
    return userStr ? JSON.parse(userStr) : null
  } catch {
    return null
  }
}

export async function signUp(credentials: Credentials): Promise<AuthResult> {
  try {
    const response = await axios.post<AuthSuccessPayload>(`${API_BASE_URL}/auth/signup`, {
      email: credentials.email,
      password: credentials.password,
    })
    if (response.data?.access_token) {
      saveSession(response.data.access_token, response.data.user)
      return { status: 'ok' }
    }
    return { status: 'error', message: 'No access token received from authentication server.' }
  } catch (err: unknown) {
    return {
      status: 'error',
      message: extractErrorMessage(err, 'Failed to create account. Please try again.'),
    }
  }
}

export async function logIn(credentials: Credentials): Promise<AuthResult> {
  try {
    const response = await axios.post<AuthSuccessPayload>(`${API_BASE_URL}/auth/login`, {
      email: credentials.email,
      password: credentials.password,
    })
    if (response.data?.access_token) {
      saveSession(response.data.access_token, response.data.user)
      return { status: 'ok' }
    }
    return { status: 'error', message: 'No access token received from authentication server.' }
  } catch (err: unknown) {
    return {
      status: 'error',
      message: extractErrorMessage(err, 'Incorrect email or password.'),
    }
  }
}

export function isAuthenticated(): boolean {
  const token = getToken()
  if (!token) return false

  try {
    const parts = token.split('.')
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]))
      if (payload.exp && typeof payload.exp === 'number') {
        const now = Math.floor(Date.now() / 1000)
        if (payload.exp < now) {
          clearSession()
          return false
        }
      }
    }
  } catch {
    // Fall back to token presence if atob fails
  }
  return true
}

export function logOut(): void {
  clearSession()
}

export function getAuthHeaders(): { Authorization?: string } {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
