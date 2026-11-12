import { Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useMatch, useNavigate, useParams } from 'react-router-dom'
import { Dialog } from '../../../components/lab/Dialog.tsx'
import { ProjectForm } from '../../../components/lab/ProjectForm.tsx'
import { Crumbs, ErrorNote, Loading } from '../../../components/lab/ui.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import { useActionError, useResource } from '../../../hooks/useResource.ts'
import { api } from '../../../services/api.ts'
import type { Benchmark, Project, Provider, TestCase } from '../../../services/api.ts'
import { formatCount, formatDate } from '../../../utils/format.ts'
import { analysisPath, newestFirst, projectPath } from './context.ts'
import type { ProjectContext } from './context.ts'

interface ProjectData {
  project: Project
  testCases: TestCase[]
  benchmarks: Benchmark[]
  providers: Provider[]
}

async function loadProject(projectId: string): Promise<ProjectData> {
  const [project, testCases, benchmarks, providers] = await Promise.all([
    api.getProject(projectId),
    api.listTestCases(projectId),
    api.listBenchmarks(projectId),
    // Only used to name providers; the page still works without it.
    api.listProviders().catch(() => [] as Provider[]),
  ])
  return { project, testCases, benchmarks: newestFirst(benchmarks), providers }
}

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`

/**
 * Every project screen: breadcrumbs, the project header with edit and delete,
 * and two tabs. Overview (the default) answers "where does this stand?";
 * Detailed analysis holds everything else, folded away until asked for.
 */
export default function ProjectLayout() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const describeError = useActionError()
  const { data, error, loading, reload } = useResource(() => loadProject(projectId), [projectId])
  const onAnalysis = useMatch('/app/projects/:projectId/analysis') !== null
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null)

  const notify = useCallback((text: string) => setToast({ key: Date.now(), text }), [])
  const openEdit = useCallback(() => setDialog('edit'), [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(timer)
  }, [toast])

  // While a run is in progress, check back so the status changes without a reload.
  const running = data?.benchmarks.some((b) => b.status === 'running') ?? false
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(reload, 4000)
    return () => window.clearInterval(timer)
  }, [running, reload])

  const context = useMemo<ProjectContext | null>(
    () =>
      data
        ? {
            project: data.project,
            testCases: data.testCases,
            benchmarks: data.benchmarks,
            providers: data.providers,
            reload,
            notify,
            openEdit,
          }
        : null,
    [data, reload, notify, openEdit],
  )

  // Data for another project is still on screen while this one loads; don't show it.
  if (!data || data.project.id !== projectId) {
    if (error) {
      return (
        <div className="page">
          <ErrorNote onRetry={reload}>
            <p>{error}</p>
            <p>
              <Link to="/app">Back to the dashboard</Link>
            </p>
          </ErrorNote>
        </div>
      )
    }
    return loading ? <Loading label="Opening project…" /> : null
  }

  const { project, testCases, benchmarks } = data
  const closeDialog = () => {
    setDialog(null)
    setDeleteError(null)
  }

  const onDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.deleteProject(project.id)
      navigate('/app', { replace: true, state: { notice: `Deleted “${project.name}”.` } })
    } catch (err) {
      setDeleteError(describeError(err))
      setDeleting(false)
    }
  }

  return (
    <div className="page proj">
      <Crumbs
        items={[
          { label: 'Dashboard', to: '/app' },
          { label: 'Projects', to: '/app#projects' },
          { label: project.name, to: projectPath(project.id) },
          { label: onAnalysis ? 'Detailed analysis' : 'Overview' },
        ]}
      />

      <header className="proj-head">
        <div className="proj-id">
          <h1 className="page-title">{project.name}</h1>
          {project.description && <p className="page-lede">{project.description}</p>}
          <dl className="proj-meta">
            <div>
              <dt>Domain</dt>
              <dd>{project.business_domain ?? <span className="muted">Not set</span>}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(project.created_at)}</dd>
            </div>
          </dl>
        </div>
        <div className="head-actions">
          <button type="button" className="btn-secondary btn-sm" onClick={openEdit}>
            <Pencil aria-hidden="true" />
            Edit project
          </button>
          <button type="button" className="btn-text btn-text--danger" onClick={() => setDialog('delete')}>
            <Trash2 aria-hidden="true" />
            Delete
          </button>
        </div>
      </header>

      <div className="proj-body">
        <ProjectTabs project={project} />
        {/* Keyed so each project starts with its own fresh tab state. */}
        <div className="proj-view" key={project.id}>
          <Outlet context={context} />
        </div>
      </div>

      <Dialog open={dialog === 'edit'} onClose={closeDialog} title="Edit project">
        <ProjectForm
          project={project}
          promptNote={
            benchmarks.length > 0
              ? 'Changes apply to future benchmarks. Benchmarks that already ran keep their results.'
              : undefined
          }
          onSaved={() => {
            closeDialog()
            reload()
            notify('Project updated.')
          }}
          onCancel={closeDialog}
        />
      </Dialog>

      <Dialog
        open={dialog === 'delete'}
        onClose={closeDialog}
        tone="danger"
        title={`Delete “${project.name}”?`}
        description={
          <p>
            This deletes the project, its {plural(testCases.length, 'test case')} and{' '}
            {plural(benchmarks.length, 'benchmark')} with all their results. It can’t be undone.
          </p>
        }
      >
        {deleteError && <ErrorNote>{deleteError}</ErrorNote>}
        <div className="actions">
          <button type="button" className="btn-danger" onClick={onDelete} disabled={deleting}>
            <Trash2 aria-hidden="true" />
            {deleting ? 'Deleting…' : 'Delete project'}
          </button>
          <button type="button" className="btn-text" onClick={closeDialog} data-autofocus>
            Keep project
          </button>
        </div>
      </Dialog>

      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <p key={toast.key} className="toast">
            {toast.text}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * The two views of a project. They stay pinned to the top while scrolling, and
 * once the header has scrolled away they carry the project name so you know
 * where you are.
 */
function ProjectTabs({ project }: { project: Project }) {
  const sentinel = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLElement>(null)
  const [stuck, setStuck] = useState(false)
  // The bar sits under the phone top bar on narrow screens, so its offset changes with width.
  const wide = useMediaQuery('(min-width: 64rem)')

  useEffect(() => {
    const target = sentinel.current
    const nav = bar.current
    if (!target || !nav || !('IntersectionObserver' in window)) return
    const top = parseFloat(getComputedStyle(nav).top) || 0
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      rootMargin: `${-top - 1}px 0px 0px 0px`,
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [wide])

  return (
    <>
      <div ref={sentinel} className="proj-sentinel" aria-hidden="true" />
      <nav ref={bar} className={`proj-tabs${stuck ? ' is-stuck' : ''}`} aria-label="Project views">
        {/* The h1 already names the project; this copy is only a visual reminder. */}
        <span className="proj-tabs-name" aria-hidden="true">
          {project.name}
        </span>
        <NavLink end to={projectPath(project.id)} className="proj-tab">
          Overview
        </NavLink>
        <NavLink to={analysisPath(project.id)} className="proj-tab">
          Detailed analysis
        </NavLink>
      </nav>
    </>
  )
}
