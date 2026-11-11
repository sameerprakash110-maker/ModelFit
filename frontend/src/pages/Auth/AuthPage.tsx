import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SiteFooter } from '../../components/landing/SiteFooter.tsx'
import { Wordmark } from '../../components/landing/Wordmark.tsx'
import { logIn, signUp } from '../../services/auth.ts'
import type { AuthResult } from '../../services/auth.ts'
import '../../styles/site.css'
import './auth.css'

const COPY = {
  signup: {
    title: 'Sign up for ModelFit',
    pitch: 'Bring a workload. Leave with a verdict.',
    submit: 'Sign Up',
    notConnected: 'Nothing was sent. Sign-up will work once the account service is connected.',
    switchPrompt: 'Already have an account?',
    switchLabel: 'Log In',
    switchTo: '/login',
  },
  login: {
    title: 'Log in to ModelFit',
    pitch: 'Your workloads and past runs are where you left them.',
    submit: 'Log In',
    notConnected: 'Nothing was sent. Log-in will work once the account service is connected.',
    switchPrompt: 'New to ModelFit?',
    switchLabel: 'Sign Up',
    switchTo: '/signup',
  },
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

/*
  Entry point to the account system for the public website. The form
  validates and then hands off to services/auth.ts, which is the integration
  point. Until that is connected the page says so, before and after submitting.
*/
export default function AuthPage({ mode }: { mode: 'signup' | 'login' }) {
  const copy = COPY[mode]
  const id = useId()
  const location = useLocation()
  const navigate = useNavigate()
  const cameFromLab = (location.state as { from?: string } | null)?.from?.startsWith('/app') ?? false

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AuthResult | null>(null)

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
      const authResult = await (mode === 'signup' ? signUp(credentials) : logIn(credentials))
      setResult(authResult)
      if (authResult.status === 'ok') {
        const dest = (location.state as { from?: string } | null)?.from || '/app'
        navigate(dest, { replace: true })
      }
    } catch {
      setResult({ status: 'error', message: 'The account service could not be reached. Try again in a moment.' })
    } finally {
      setSubmitting(false)
    }
  }

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
          <p className="auth-notice">
            Enter your credentials to {mode === 'signup' ? 'create a ModelFit account' : 'sign in to ModelFit'}.
          </p>

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
            {copy.submit}
          </button>

          <div aria-live="polite">
            {result?.status === 'not-connected' && <p className="auth-result">{copy.notConnected}</p>}
            {result?.status === 'error' && <p className="auth-result is-error">{result.message}</p>}
            {result?.status === 'ok' && <p className="auth-result is-success">Success! Redirecting to workspace...</p>}
          </div>

          <p className="auth-switch">
            {copy.switchPrompt} <Link to={copy.switchTo}>{copy.switchLabel}</Link>
          </p>
        </form>
      </main>

      <SiteFooter />
    </div>
  )
}
