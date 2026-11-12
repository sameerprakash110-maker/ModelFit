import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TestCaseForm, TestCaseList } from '../../components/lab/TestCases.tsx'
import { Crumbs, EmptyState, ErrorNote, Loading, StatusChip } from '../../components/lab/ui.tsx'
import { useActionError, useResource } from '../../hooks/useResource.ts'
import { api } from '../../services/api.ts'
import type { Benchmark, Project, TestCase } from '../../services/api.ts'
import { formatCount, formatDateTime } from '../../utils/format.ts'

interface ProjectData {
  project: Project
  testCases: TestCase[]
  benchmarks: Benchmark[]
}

async function loadProject(projectId: string): Promise<ProjectData> {
  const [project, testCases, benchmarks] = await Promise.all([
    api.getProject(projectId),
    api.listTestCases(projectId),
    api.listBenchmarks(projectId),
  ])
  return { project, testCases, benchmarks }
}

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`

export default function ProjectPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const describeError = useActionError()
  const { data, error, loading, reload } = useResource(() => loadProject(projectId), [projectId])
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (loading && !data) return <Loading label="Opening project…" />
  if (error && !data) {
    return (
      <div className="page">
        <ErrorNote onRetry={reload}>
          <p>{error}</p>
          <p>
            <Link to="/app">Back to the overview</Link>
          </p>
        </ErrorNote>
      </div>
    )
  }
  if (!data) return null

  const { project, testCases, benchmarks } = data
  const showForm = adding || testCases.length === 0

  const onDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.deleteProject(project.id)
      navigate('/app', { replace: true })
    } catch (err) {
      setDeleteError(describeError(err))
      setDeleting(false)
    }
  }

  return (
    <div className="page">
      <Crumbs items={[{ label: 'Overview', to: '/app' }, { label: project.name }]} />

      <header className="page-head page-head--split">
        <div>
          <h1 className="page-title">{project.name}</h1>
          {(project.business_domain || project.description) && (
            <p className="page-lede">
              {project.description}
              {project.business_domain && <span className="domain">{project.business_domain}</span>}
            </p>
          )}
        </div>
        <div className="head-actions">
          <Link to={`/app/new?project=${project.id}`} className="btn-primary">
            <Plus aria-hidden="true" />
            Benchmark this project
          </Link>
        </div>
      </header>

      <details className="prompt-box">
        <summary>System prompt every model receives</summary>
        <pre>{project.system_prompt}</pre>
      </details>

      <section className="section" aria-labelledby="bench-title">
        <h2 id="bench-title" className="section-title">
          Benchmarks
        </h2>
        {benchmarks.length === 0 ? (
          <EmptyState
            title={testCases.length === 0 ? 'Add test cases first' : 'No benchmarks yet'}
            action={
              testCases.length > 0 ? (
                <Link to={`/app/new?project=${project.id}`} className="btn-primary">
                  Run the first benchmark
                </Link>
              ) : undefined
            }
          >
            <p>
              {testCases.length === 0
                ? 'A benchmark asks each model every test case, so add a few below to get started.'
                : `You have ${plural(testCases.length, 'test case')}. Pick models to compare and run.`}
            </p>
          </EmptyState>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Benchmarks (scrolls sideways)">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Benchmark</th>
                  <th scope="col">Models</th>
                  <th scope="col" className="numcol">
                    Runs each
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((b) => (
                  <tr key={b.id}>
                    <th scope="row">
                      <Link to={`/app/benchmarks/${b.id}`} className="row-link">
                        {b.name}
                      </Link>
                    </th>
                    <td className="models-cell">
                      {b.selected_models.join(', ')}
                      {b.baseline_model && <span className="cell-sub">Used today: {b.baseline_model}</span>}
                    </td>
                    <td className="numcol">{b.repeats}</td>
                    <td>
                      <StatusChip status={b.status} />
                    </td>
                    <td className="muted">{formatDateTime(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="cases-title">
        <div className="section-head">
          <h2 id="cases-title" className="section-title">
            Test cases <span className="count">{formatCount(testCases.length)}</span>
          </h2>
          {!showForm && (
            <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" />
              Add a test case
            </button>
          )}
        </div>
        <p className="section-lede">
          Real inputs from this workload, each with what a good answer does. Every model answers each one and a judge
          scores the answers against it.
          {testCases.length > 0 && testCases.length < 5 && ' Five or more give a steadier result.'}
        </p>
        {testCases.length > 0 && <TestCaseList testCases={testCases} onChanged={reload} />}
        {showForm && (
          <div className="panel">
            <h3 className="panel-title">{testCases.length === 0 ? 'Add your first test case' : 'Add a test case'}</h3>
            <TestCaseForm projectId={project.id} onAdded={reload} />
            {testCases.length > 0 && (
              <button type="button" className="btn-text" onClick={() => setAdding(false)}>
                Done adding
              </button>
            )}
          </div>
        )}
      </section>

      <section className="section danger-zone" aria-labelledby="danger-title">
        <h2 id="danger-title" className="section-title">
          Delete this project
        </h2>
        {confirmDelete ? (
          <div className="confirm">
            <p>
              This deletes {project.name}, its {plural(testCases.length, 'test case')} and{' '}
              {plural(benchmarks.length, 'benchmark')} with all their results. It can't be undone.
            </p>
            <div className="actions">
              <button type="button" className="btn-danger" onClick={onDelete} disabled={deleting}>
                <Trash2 aria-hidden="true" />
                {deleting ? 'Deleting…' : 'Delete project'}
              </button>
              <button type="button" className="btn-text" onClick={() => setConfirmDelete(false)}>
                Keep project
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-text btn-text--danger" onClick={() => setConfirmDelete(true)}>
            Delete project…
          </button>
        )}
        {deleteError && <ErrorNote>{deleteError}</ErrorNote>}
      </section>
    </div>
  )
}
