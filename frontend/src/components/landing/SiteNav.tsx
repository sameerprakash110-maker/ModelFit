import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isAuthenticated, logOut } from '../../services/auth.ts'
import { useActiveSection } from '../../hooks/useActiveSection.ts'
import { Wordmark } from './Wordmark.tsx'

const SECTIONS = [
  { id: 'trap', label: 'The Trap' },
  { id: 'fitting', label: 'How It Works' },
  { id: 'measured', label: "What's Measured" },
]
const SECTION_IDS = SECTIONS.map((section) => section.id)

// Width at which the full row of links fits. Keep in step with site.css.
const DESKTOP_QUERY = '(min-width: 66rem)'

/** Sticky top bar. It tightens once the page is scrolled, and folds into a menu on small screens. */
export function SiteNav() {
  const [compact, setCompact] = useState(false)
  const [open, setOpen] = useState(false)
  const active = useActiveSection(SECTION_IDS)
  const [signedIn, setSignedIn] = useState(isAuthenticated)

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const desktop = window.matchMedia(DESKTOP_QUERY)
    const onDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    desktop.addEventListener('change', onDesktop)
    return () => {
      window.removeEventListener('keydown', onKey)
      desktop.removeEventListener('change', onDesktop)
    }
  }, [open])

  const close = () => setOpen(false)
  const onLogOut = () => {
    close()
    logOut()
    setSignedIn(false)
  }
  const toTop = () => {
    close()
    window.scrollTo({ top: 0 })
  }

  return (
    <header className={`site-nav${compact ? ' is-compact' : ''}${open ? ' is-open' : ''}`}>
      <nav className="wrap site-nav-bar" aria-label="Main">
        <Link to="/" className="site-nav-logo" onClick={toTop}>
          <Wordmark />
        </Link>

        <ul className="site-nav-links">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} aria-current={active === section.id ? 'true' : undefined}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="site-nav-account">
          {signedIn ? (
            <button type="button" className="site-nav-login" onClick={onLogOut}>
              Log Out
            </button>
          ) : (
            <>
              <Link to="/login" className="site-nav-login">
                Log In
              </Link>
              <Link to="/signup" className="btn btn--outline btn--small">
                Sign Up
              </Link>
            </>
          )}
        </div>

        <Link to="/app" className="btn btn--small site-nav-cta">
          Open the Lab
        </Link>

        <button
          type="button"
          className="site-nav-toggle"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </nav>

      <div id="site-menu" className="site-menu" hidden={!open}>
        <ul className="wrap">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} onClick={close}>
                {section.label}
              </a>
            </li>
          ))}
          {signedIn ? (
            <li>
              <button type="button" onClick={onLogOut}>
                Log Out
              </button>
            </li>
          ) : (
            <>
              <li>
                <Link to="/login" onClick={close}>
                  Log In
                </Link>
              </li>
              <li>
                <Link to="/signup" onClick={close}>
                  Sign Up
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </header>
  )
}
