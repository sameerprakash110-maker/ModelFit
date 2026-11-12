import { Menu, PanelLeftOpen, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Wordmark } from '../../components/landing/Wordmark.tsx'
import { SidebarContent } from '../../components/lab/Sidebar.tsx'
import { useMediaQuery } from '../../hooks/useMediaQuery.ts'
import { useResource } from '../../hooks/useResource.ts'
import { api, LAB_DATA_CHANGED } from '../../services/api.ts'
import { fetchCurrentUser, getStoredUser, logOut } from '../../services/auth.ts'
import type { User } from '../../services/auth.ts'
import '../../styles/site.css'
import './lab.css'

const SIDEBAR_KEY = 'modelfit:sidebar'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'collapsed'
  } catch {
    return false
  }
}

/**
 * Frame for every signed-in page: the sidebar (a column on wide screens that can be
 * hidden, a drawer on narrow ones) and the page beside it.
 */
export default function LabLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [user, setUser] = useState<User | null>(getStoredUser)
  const drawer = useRef<HTMLDialogElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const wide = useMediaQuery('(min-width: 64rem)')
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const hideButton = useRef<HTMLButtonElement>(null)
  const focusAfterToggle = useRef(false)
  const sidebarHidden = wide && collapsed

  const setSidebar = (hidden: boolean) => {
    setCollapsed(hidden)
    focusAfterToggle.current = true
    try {
      localStorage.setItem(SIDEBAR_KEY, hidden ? 'collapsed' : 'open')
    } catch {
      // Storage blocked: the choice just won't be remembered.
    }
  }

  // The button you pressed disappears, so hand focus to the one that undoes it.
  useEffect(() => {
    if (!focusAfterToggle.current) return
    focusAfterToggle.current = false
    ;(collapsed ? menuButton.current : hideButton.current)?.focus()
  }, [collapsed])

  // Confirm the session with the server once per visit.
  useEffect(() => {
    let cancelled = false
    fetchCurrentUser()
      .then((current) => {
        if (cancelled) return
        if (current) setUser(current)
        else navigate('/login', { replace: true, state: { from: window.location.pathname } })
      })
      .catch(() => {
        // Backend unreachable: pages show their own errors.
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  // Projects and benchmarks for the sidebar, refreshed whenever anything changes.
  const nav = useResource(
    () =>
      Promise.all([api.listProjects(), api.listBenchmarks()]).then(([projects, benchmarks]) => ({
        projects,
        benchmarks,
      })),
    [],
  )
  const reloadNav = nav.reload
  useEffect(() => {
    window.addEventListener(LAB_DATA_CHANGED, reloadNav)
    return () => window.removeEventListener(LAB_DATA_CHANGED, reloadNav)
  }, [reloadNav])

  const projects = nav.data?.projects ?? []
  const benchmarks = nav.data?.benchmarks ?? []
  const anyRunning = benchmarks.some((b) => b.status === 'running')

  // While a run is in progress, keep its status current.
  useEffect(() => {
    if (!anyRunning) return
    const timer = window.setInterval(reloadNav, 4000)
    return () => window.clearInterval(timer)
  }, [anyRunning, reloadNav])

  const activeBenchmarkId = pathname.match(/^\/app\/benchmarks\/([^/]+)/)?.[1] ?? null
  const activeProjectId =
    pathname.match(/^\/app\/projects\/([^/]+)/)?.[1] ??
    benchmarks.find((b) => b.id === activeBenchmarkId)?.project_id ??
    null

  const openDrawer = () => {
    drawer.current?.showModal()
    setDrawerOpen(true)
  }
  const closeDrawer = useCallback(() => drawer.current?.close(), [])

  // Following a link closes the drawer.
  useEffect(() => {
    closeDrawer()
  }, [pathname, closeDrawer])

  const onLogOut = () => {
    logOut()
    navigate('/', { replace: true })
  }

  const sidebarProps = {
    projects,
    benchmarks,
    loading: nav.loading && !nav.data,
    activeProjectId,
    activeBenchmarkId,
    email: user?.email ?? null,
    onLogOut,
  }

  return (
    <div className={`lp lab lab-shell${collapsed ? ' is-collapsed' : ''}`}>
      <a className="skip-link" href="#lab-main">
        Skip to content
      </a>

      {/* inert while hidden, so its links can't be tabbed to or read out. */}
      <aside id="lab-sidebar" className="sidebar" aria-label="Lab navigation" inert={sidebarHidden}>
        <SidebarContent {...sidebarProps} onHide={() => setSidebar(true)} hideButtonRef={hideButton} />
      </aside>

      {/* Narrow screens, or a hidden sidebar on a wide one: a slim bar with the menu and the main action. */}
      <header className="mobilebar">
        {wide ? (
          <button
            ref={menuButton}
            type="button"
            className="mobilebar-menu"
            aria-label="Show sidebar"
            title="Show sidebar"
            aria-expanded={!collapsed}
            aria-controls="lab-sidebar"
            onClick={() => setSidebar(false)}
          >
            <PanelLeftOpen aria-hidden="true" />
          </button>
        ) : (
          <button
            ref={menuButton}
            type="button"
            className="mobilebar-menu"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="lab-drawer"
            onClick={openDrawer}
          >
            <Menu aria-hidden="true" />
          </button>
        )}
        <Link to="/app" className="mobilebar-logo" aria-label="ModelFit lab overview">
          <Wordmark />
          <span className="side-tag">Lab</span>
        </Link>
        <Link to="/app/new" className="mobilebar-cta">
          <Plus aria-hidden="true" />
          <span>New benchmark</span>
        </Link>
      </header>

      <dialog
        id="lab-drawer"
        ref={drawer}
        className="drawer"
        aria-label="Lab navigation"
        onClose={() => {
          setDrawerOpen(false)
          menuButton.current?.focus()
        }}
        // Tapping the dimmed area outside the panel closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget) closeDrawer()
        }}
      >
        <div className="drawer-panel">
          <button type="button" className="drawer-close" aria-label="Close navigation" onClick={closeDrawer}>
            <X aria-hidden="true" />
          </button>
          {drawerOpen && <SidebarContent {...sidebarProps} />}
        </div>
      </dialog>

      <main id="lab-main" className="lab-main">
        <div className="frame">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
