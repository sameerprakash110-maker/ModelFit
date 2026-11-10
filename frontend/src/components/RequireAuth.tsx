import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAuthenticated } from '../services/auth.ts'

/**
 * Guards the lab. Visitors without a session are sent to sign up, and the
 * page they wanted is passed along so they can be returned to it afterwards.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!isAuthenticated()) {
    return <Navigate to="/signup" replace state={{ from: location.pathname }} />
  }
  return children
}
