/*
  INTEGRATION POINT: authentication.

  The public website needs three things from the account system: sign up,
  log in, and "is this visitor logged in". The backend's auth contract has
  not been agreed yet, so nothing here calls a server. Every function reports
  that honestly instead of pretending to succeed.

  To connect it: replace the bodies below with calls to the real auth
  endpoints (through an API client that reads VITE_API_BASE_URL) and return
  { status: 'ok' } or { status: 'error', message } accordingly. The pages
  that call these functions already handle all three statuses.
*/

export interface Credentials {
  email: string
  password: string
}

export type AuthResult = { status: 'ok' } | { status: 'error'; message: string } | { status: 'not-connected' }

export async function signUp(_credentials: Credentials): Promise<AuthResult> {
  return { status: 'not-connected' }
}

export async function logIn(_credentials: Credentials): Promise<AuthResult> {
  return { status: 'not-connected' }
}

/** Whether the visitor has a session. Always false until authentication is connected. */
export function isAuthenticated(): boolean {
  return false
}
