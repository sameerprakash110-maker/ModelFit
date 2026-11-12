import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { SiteFooter } from '../../components/landing/SiteFooter.tsx'
import { Wordmark } from '../../components/landing/Wordmark.tsx'
import { isAuthenticated, logIn, signUp } from '../../services/auth.ts'
import type { AuthResult } from '../../services/auth.ts'
import '../../styles/site.css'
import './auth.css'

const COPY = {
  signup: {
    title: 'Sign up for ModelFit',
    pitch: 'Bring a workload. Leave with a verdict.',
    submit: 'Sign Up',
    switchPrompt: 'Already have an account?',
    switchLabel: 'Log In',
    switchTo: '/login',
  },
  login: {
    title: 'Log in to ModelFit',
    pitch: 'Your workloads and past runs are where you left them.',
    submit: 'Log In',
    switchPrompt: 'New to ModelFit?',
    switchLabel: 'Sign Up',
    switchTo: '/signup',
  },
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

/*
  Entry point to the account system for the public website. The form
  validates locally, then services/auth.ts calls the backend. On success the
  visitor goes to the page they were trying to reach, or the lab.
*/
export default function AuthPage({ mode }: { mode: 'signup' | 'login' }) {
  const copy = COPY[mode]
  const id = useId()
  const location = useLocation()
  const navigate = useNavigate()
  const from = (location.state as { from?: string } | null)?.from
  const cameFromLab = from?.startsWith('/app') ?? false
  const destination = cameFromLab && from ? from : '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AuthResult | null>(null)
  const [alreadySignedIn] = useState(isAuthenticated)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setResult(null)

    const next: { email?: string; password?: string } = {}
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter an email address, like name@company.com.'
    if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    } else if (password.length === 0) {
      next.password = 'Enter your password.'
    }
    setErrors(next)
    if (next.email || next.password) return

    setSubmitting(true)
    try {
      const credentials = { email: email.trim(), password }
      const outcome = await (mode === 'signup' ? signUp(credentials) : logIn(credentials))
      if (outcome.status === 'ok') {
        navigate(destination, { replace: true })
        return
      }
      setResult(outcome)
    } catch {
      setResult({ status: 'error', message: 'The account service could not be reached. Try again in a moment.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (alreadySignedIn) return <Navigate to={destination} replace />

  return (
    <div className="lp plain-page">
      <header className="wrap plain-top">
        <Link to="/" className="site-nav-logo">
          <Wordmark />
        </Link>
        <Link to="/" className="stitch-link">
          Back to the website
        </Link>
      </header>

      <main className="wrap auth">
        <div className="auth-pitch">
          <h1 className="h2">{copy.title}</h1>
          <p className="lede">{cameFromLab ? 'The lab opens once you have an account.' : copy.pitch}</p>
        </div>

        <form className="auth-panel" onSubmit={onSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor={`${id}-email`}>Work email</label>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? `${id}-email-error` : undefined}
            />
            {errors.email && (
              <p id={`${id}-email-error`} className="field-error">
                {errors.email}
              </p>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor={`${id}-password`}>Password</label>
            <input
              id={`${id}-password`}
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? `${id}-password-error` : undefined}
            />
            {errors.password && (
              <p id={`${id}-password-error`} className="field-error">
                {errors.password}
              </p>
            )}
          </div>

          <button type="submit" className="btn btn--on-light" disabled={submitting}>
            {submitting ? 'One moment…' : copy.submit}
          </button>

          <div aria-live="polite">
            {result?.status === 'error' && <p className="auth-result is-error">{result.message}</p>}
          </div>

          <p className="auth-switch">
            {copy.switchPrompt}{' '}
            <Link to={copy.switchTo} state={location.state}>
              {copy.switchLabel}
            </Link>
          </p>
        </form>
      </main>

      <SiteFooter />
    </div>
  )
}
