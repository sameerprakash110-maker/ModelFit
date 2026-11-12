import {
  ChartColumn,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  ListPlus,
  LoaderCircle,
  Play,
  TriangleAlert,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, SimulatedTag, StatusChip } from '../../../components/lab/ui.tsx'
import { useResource } from '../../../hooks/useResource.ts'
import { api } from '../../../services/api.ts'
import type { Benchmark } from '../../../services/api.ts'
import { buildModelViews, deriveVerdict } from '../../../utils/benchmark.ts'
import { formatCount, formatDateTime } from '../../../utils/format.ts'
import {
  addTestCasePath,
  analysisPath,
  modelsEvaluated,
  newBenchmarkPath,
  projectHealth,
  useProject,
} from './context.ts'
import type { Health, HealthKind } from './context.ts'
import { RunBenchmark } from './RunBenchmark.tsx'

const RECENT = 5

/**
 * The first screen of every project: its status in one sentence, five numbers,
 * the latest runs and the three things you'd do next. Nothing technical.
 */
export default function ProjectOverview() {
  const { project, testCases, benchmarks } = useProject()
  const health = projectHealth(project.id, testCases, benchmarks)
  const evaluated = modelsEvaluated(benchmarks)
  const latest = benchmarks[0]

  return (
    <div className="ov">
      <HealthPanel health={health} />

      <dl className="stats" aria-label="Project at a glance">
        <div>
          <dt>Test cases</dt>
          <dd>{formatCount(testCases.length)}</dd>
        </div>
        <div>
          <dt>Benchmarks</dt>
          <dd>{formatCount(benchmarks.length)}</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{formatCount(benchmarks.filter((b) => b.status === 'completed').length)}</dd>
        </div>
        <div>
          <dt>Models evaluated</dt>
          <dd title={evaluated.join(', ') || undefined}>{formatCount(evaluated.length)}</dd>
        </div>
        <div>
          <dt>Latest run</dt>
          <dd className="stats-status">{latest ? <StatusChip status={latest.status} /> : 'None yet'}</dd>
        </div>
      </dl>

      <div className="ov-grid">
        <section className="ov-block" aria-labelledby="activity-title">
          <div className="block-head">
            <h2 id="activity-title" className="block-title">
              Benchmark activity
            </h2>
            {benchmarks.length > RECENT && (
              <Link to={analysisPath(project.id, 'benchmarks')} className="block-link">
                All {formatCount(benchmarks.length)} runs
              </Link>
            )}
          </div>
          {benchmarks.length === 0 ? (
            <EmptyState
              title="Your first benchmark starts here."
              action={<RunBenchmark projectId={project.id} hasTestCases={testCases.length > 0} />}
            >
              <p>
                {testCases.length > 0
                  ? 'Pick two or more models. Each answers every test case, and a judge scores the answers.'
                  : 'A benchmark needs at least one test case to ask the models.'}
              </p>
            </EmptyState>
          ) : (
            <ul className="activity">
              {benchmarks.slice(0, RECENT).map((b) => (
                <ActivityRow key={b.id} benchmark={b} />
              ))}
            </ul>
          )}
        </section>

        <section className="ov-block" aria-labelledby="quick-title">
          <h2 id="quick-title" className="block-title">
            Quick actions
          </h2>
          <ul className="quick">
            <li>
              <QuickLink
                to={addTestCasePath(project.id)}
                icon={<ListPlus aria-hidden="true" />}
                title="Add test cases"
                detail="Real inputs and what a good answer does."
              />
            </li>
            <li>
              <QuickLink
                to={testCases.length > 0 ? newBenchmarkPath(project.id) : null}
                icon={<Play aria-hidden="true" />}
                title="Run new benchmark"
                detail={
                  testCases.length > 0 ? 'Compare models on your test cases.' : 'Add a test case first; there is nothing to ask yet.'
                }
              />
            </li>
            <li>
              <QuickLink
                to={analysisPath(project.id)}
                icon={<ChartColumn aria-hidden="true" />}
                title="View detailed analysis"
                detail="Test cases, every run, model performance and the recommendation."
              />
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}

/* ---------- health ---------- */

const HEALTH_ICON: Record<HealthKind, ReactNode> = {
  empty: <ListPlus aria-hidden="true" />,
  ready: <Play aria-hidden="true" />,
  pending: <CircleDashed aria-hidden="true" />,
  running: <LoaderCircle aria-hidden="true" className="spin" />,
  results: <CircleCheck aria-hidden="true" />,
  failed: <TriangleAlert aria-hidden="true" />,
}

function HealthPanel({ health }: { health: Health }) {
  return (
    <section className={`health health--${health.kind}`} aria-labelledby="health-title">
      <span className="health-icon">{HEALTH_ICON[health.kind]}</span>
      <div className="health-text">
        <p className="health-label">Project status</p>
        <h2 id="health-title" className="health-title">
          {health.title}
        </h2>
        <p className="health-detail">{health.detail}</p>
        {health.kind === 'results' && health.benchmark && <LatestVerdict benchmark={health.benchmark} />}
      </div>
      {(health.action || health.secondary) && (
        <div className="health-actions">
          {health.action && (
            <Link to={health.action.to} className="btn-primary">
              {health.action.label}
            </Link>
          )}
          {health.secondary && (
            <Link to={health.secondary.to} className="btn-text">
              {health.secondary.label}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

/** The recommendation from the latest completed run, in one line. Says nothing if it can't be read. */
function LatestVerdict({ benchmark }: { benchmark: Benchmark }) {
  const { data, error } = useResource(() => api.getReport(benchmark.id, 1_00_000, 'best_value'), [benchmark.id])
  if (error) return null
  if (!data) return <p className="health-verdict muted">Reading the recommendation…</p>
  const verdict = deriveVerdict(data, buildModelViews(data), 'best_value')
  return (
    <p className="health-verdict">
      <span className={`vchip vchip--${verdict.kind}`}>{verdict.word}</span>
      <span>{verdict.headline}</span>
      {data.is_mock && <SimulatedTag />}
    </p>
  )
}

/* ---------- activity ---------- */

function ActivityRow({ benchmark: b }: { benchmark: Benchmark }) {
  const action =
    b.status === 'running' ? 'Watch progress' : b.status === 'pending' ? 'Open and run' : 'View results'
  return (
    <li className="activity-row">
      <div className="activity-main">
        <span className="activity-name">{b.name}</span>
        <span className="activity-models" title={b.selected_models.join(', ')}>
          {formatCount(b.selected_models.length)} {b.selected_models.length === 1 ? 'model' : 'models'}:{' '}
          {b.selected_models.join(', ')}
        </span>
      </div>
      <StatusChip status={b.status} />
      <span className="activity-date">{formatDateTime(b.created_at)}</span>
      {/* The link stretches over the whole row, so the row is one big target. */}
      <Link to={`/app/benchmarks/${b.id}`} className="activity-link">
        {/* On phones only the chevron shows; the status chip already says what's there. */}
        <span className="activity-link-text">{action}</span>
        <span className="visually-hidden">: {b.name}</span>
        <ChevronRight aria-hidden="true" />
      </Link>
    </li>
  )
}

/* ---------- actions ---------- */

function QuickLink({
  to,
  icon,
  title,
  detail,
}: {
  /** Null when the action isn't possible yet; `detail` then says why. */
  to: string | null
  icon: ReactNode
  title: string
  detail: string
}) {
  const body = (
    <>
      <span className="quick-icon">{icon}</span>
      <span className="quick-text">
        <span className="quick-title">{title}</span>
        <span className="quick-detail">{detail}</span>
      </span>
    </>
  )
  return to ? (
    <Link to={to} className="quick-link">
      {body}
    </Link>
  ) : (
    <button type="button" className="quick-link" disabled>
      {body}
    </button>
  )
}
