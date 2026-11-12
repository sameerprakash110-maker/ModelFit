import {
  Check,
  ChevronRight,
  CircleDashed,
  ExternalLink,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  PanelLeftClose,
  Plus,
  X,
} from 'lucide-react'
import { useId, useState } from 'react'
import type { Ref } from 'react'
import { Link, NavLink } from 'react-router-dom'
import type { Benchmark, BenchmarkStatus, Project } from '../../services/api.ts'
import { sortProjectsByActivity } from '../../utils/benchmark.ts'
import { Wordmark } from '../landing/Wordmark.tsx'

const LATEST_PER_PROJECT = 5

/** Under its project, a benchmark doesn't need the project's name again: "Support triage, 11 Nov" → "11 Nov". */
function shortName(name: string, projectName: string): string {
  const prefix = projectName.trim()
  if (!name.startsWith(prefix)) return name
  const rest = name.slice(prefix.length).replace(/^[\s,:–—-]+/, '')
  return rest || name
}

const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

/** When it was created: the time if today, otherwise the date. Tells same-named runs apart. */
function when(iso: string): string {
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
  return date.toDateString() === new Date().toDateString() ? timeFormat.format(date) : dayFormat.format(date)
}

const STATUS_TEXT: Record<BenchmarkStatus, string> = {
  pending: 'not run yet',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
}

/** A benchmark's state as a small icon; the words are there for screen readers and on hover. */
function StatusIcon({ status }: { status: BenchmarkStatus }) {
  const icon =
    status === 'completed' ? (
      <Check aria-hidden="true" />
    ) : status === 'running' ? (
      <LoaderCircle aria-hidden="true" className="spin" />
    ) : status === 'failed' ? (
      <X aria-hidden="true" />
    ) : (
      <CircleDashed aria-hidden="true" />
    )
  return (
    <span className={`side-status side-status--${status}`} title={STATUS_TEXT[status]}>
      {icon}
      <span className="visually-hidden">, {STATUS_TEXT[status]}</span>
    </span>
  )
}

/**
 * The lab's navigation, organised the way the data is: Overview, then each project
 * with its latest benchmarks underneath. The project you're in opens automatically.
 */
export function SidebarContent({
  projects,
  benchmarks,
  loading,
  activeProjectId,
  activeBenchmarkId,
  email,
  onLogOut,
  onHide,
  hideButtonRef,
}: {
  projects: Project[]
  benchmarks: Benchmark[]
  loading: boolean
  activeProjectId: string | null
  activeBenchmarkId: string | null
  email: string | null
  onLogOut: () => void
  /** Desktop only: collapse the sidebar. The drawer has its own close button instead. */
  onHide?: () => void
  hideButtonRef?: Ref<HTMLButtonElement>
}) {
  const id = useId()
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const isOpen = (projectId: string) => toggled[projectId] ?? projectId === activeProjectId

  return (
    <div className="side">
      <div className="side-top">
        <Link to="/app" className="side-logo" aria-label="ModelFit lab overview">
          <Wordmark />
          <span className="side-tag">Lab</span>
        </Link>
        {onHide && (
          <button
            ref={hideButtonRef}
            type="button"
            className="side-hide"
            onClick={onHide}
            aria-label="Hide sidebar"
            aria-expanded={true}
            aria-controls="lab-sidebar"
            title="Hide sidebar"
          >
            <PanelLeftClose aria-hidden="true" />
          </button>
        )}
      </div>

      <Link to="/app/new" className="side-cta">
        <Plus aria-hidden="true" />
        New benchmark
      </Link>

      <nav aria-label="Lab" className="side-nav">
        <ul className="side-list">
          <li>
            <NavLink to="/app" end className="side-link">
              <LayoutGrid aria-hidden="true" />
              Overview
            </NavLink>
          </li>
        </ul>

        <div className="side-group">
          <div className="side-group-head">
            <h2 id={`${id}-projects`} className="side-group-title">
              Projects
            </h2>
            <Link to="/app/new?create=1" className="side-add" aria-label="Create a project" title="Create a project">
              <Plus aria-hidden="true" />
            </Link>
          </div>

          {projects.length === 0 ? (
            <p className="side-empty">
              {loading ? (
                'Loading…'
              ) : (
                <>
                  No projects yet. <Link to="/app/new">Create one</Link> to start.
                </>
              )}
            </p>
          ) : (
            <ul className="side-list side-projects" aria-labelledby={`${id}-projects`}>
              {sortProjectsByActivity(projects, benchmarks).map((project) => {
                const mine = benchmarks.filter((b) => b.project_id === project.id)
                const open = isOpen(project.id)
                const listId = `${id}-p-${project.id}`
                const inProject = project.id === activeProjectId
                return (
                  <li key={project.id} className={`side-project${inProject ? ' is-here' : ''}`}>
                    <div className="side-project-row">
                      <button
                        type="button"
                        className="side-toggle"
                        aria-expanded={open}
                        aria-controls={listId}
                        onClick={() => setToggled((t) => ({ ...t, [project.id]: !open }))}
                      >
                        <ChevronRight aria-hidden="true" />
                        <span className="visually-hidden">
                          {open ? 'Hide' : 'Show'} benchmarks in {project.name}
                        </span>
                      </button>
                      <NavLink to={`/app/projects/${project.id}`} className="side-link side-link--project">
                        <span className="side-text">{project.name}</span>
                        <span className="side-count" aria-label={`${mine.length} benchmarks`}>
                          {mine.length}
                        </span>
                      </NavLink>
                    </div>

                    {open && (
                      <ul id={listId} className="side-list side-benchmarks">
                        {mine.length === 0 && (
                          <li>
                            <Link to={`/app/new?project=${project.id}`} className="side-link side-link--quiet">
                              Run the first benchmark
                            </Link>
                          </li>
                        )}
                        {mine.slice(0, LATEST_PER_PROJECT).map((b) => (
                          <li key={b.id}>
                            <Link
                              to={`/app/benchmarks/${b.id}`}
                              className="side-link side-link--bench"
                              aria-current={b.id === activeBenchmarkId ? 'page' : undefined}
                              title={b.name}
                            >
                              <StatusIcon status={b.status} />
                              <span className="side-text">{shortName(b.name, project.name)}</span>
                              <span className="side-when">
                                <span className="visually-hidden">, created </span>
                                {when(b.created_at)}
                              </span>
                            </Link>
                          </li>
                        ))}
                        {mine.length > LATEST_PER_PROJECT && (
                          <li>
                            <Link to={`/app/projects/${project.id}`} className="side-link side-link--quiet">
                              All {mine.length} benchmarks
                            </Link>
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </nav>

      <div className="side-foot">
        <a href="/" className="side-link side-link--quiet">
          <ExternalLink aria-hidden="true" />
          ModelFit website
        </a>
        <div className="side-account">
          {email && (
            <p className="side-email" title={email}>
              <span className="visually-hidden">Signed in as </span>
              {email}
            </p>
          )}
          <button type="button" className="side-logout" onClick={onLogOut}>
            <LogOut aria-hidden="true" />
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
