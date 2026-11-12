import { ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorNote, Loading, SimulatedTag, StatusChip } from '../../../components/lab/ui.tsx'
import { useResource } from '../../../hooks/useResource.ts'
import { api, providerForModel } from '../../../services/api.ts'
import type { Benchmark, BenchmarkStatus, Provider } from '../../../services/api.ts'
import { formatCount, formatDateTime, formatUnitRupees, usdToInr } from '../../../utils/format.ts'
import { RunBenchmark } from './RunBenchmark.tsx'

const FILTER_FROM = 4

const STATUS_FILTERS: { value: BenchmarkStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'running', label: 'Running' },
  { value: 'pending', label: 'Not run yet' },
  { value: 'failed', label: 'Failed' },
]

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`

/** Every run of this project as a compact row; open one to see how it was set up and how it went. */
export function BenchmarkHistory({
  projectId,
  benchmarks,
  testCaseCount,
  providers,
  onAddTestCase,
}: {
  projectId: string
  /** Newest first. */
  benchmarks: Benchmark[]
  testCaseCount: number
  providers: Provider[]
  onAddTestCase: () => void
}) {
  const id = useId()
  const [status, setStatus] = useState<BenchmarkStatus | 'all'>('all')
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest')

  if (benchmarks.length === 0) {
    return (
      <div className="acc-body">
        <EmptyState
          title="Your first benchmark starts here."
          action={<RunBenchmark projectId={projectId} hasTestCases={testCaseCount > 0} onAddTestCase={onAddTestCase} />}
        >
          <p>
            {testCaseCount > 0
              ? `Pick the models to compare. Each answers your ${plural(testCaseCount, 'test case')}, and a judge scores the answers.`
              : 'A benchmark asks every model each of your test cases, so it needs at least one.'}
          </p>
        </EmptyState>
      </div>
    )
  }

  const shown = benchmarks.filter((b) => status === 'all' || b.status === status)
  const ordered = order === 'newest' ? shown : [...shown].reverse()

  return (
    <div className="acc-body">
      <div className="toolbar">
        {benchmarks.length >= FILTER_FROM && (
          <>
            <div className="field field--inline">
              <label htmlFor={`${id}-status`}>Status</label>
              <select id={`${id}-status`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {STATUS_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--inline">
              <label htmlFor={`${id}-order`}>Order</label>
              <select id={`${id}-order`} value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </>
        )}
        <span className="toolbar-end">
          <RunBenchmark
            projectId={projectId}
            hasTestCases={testCaseCount > 0}
            onAddTestCase={onAddTestCase}
            size="sm"
          />
        </span>
      </div>

      {ordered.length === 0 ? (
        <EmptyState
          title="No runs with this status"
          action={
            <button type="button" className="btn-text" onClick={() => setStatus('all')}>
              Show all runs
            </button>
          }
        />
      ) : (
        <ul className="entries" aria-label="Benchmark runs">
          {ordered.map((b) => (
            <BenchmarkEntry key={b.id} benchmark={b} providers={providers} />
          ))}
        </ul>
      )}
    </div>
  )
}

function BenchmarkEntry({ benchmark: b, providers }: { benchmark: Benchmark; providers: Provider[] }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  if (open && !mounted) setMounted(true)

  return (
    <li className={`entry${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="entry-toggle"
        aria-expanded={open}
        aria-controls={`${id}-detail`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="entry-main">
          <span className="entry-title">{b.name}</span>
          <span className="entry-sub">
            {plural(b.selected_models.length, 'model')}, {plural(b.repeats, 'run')} per test case
          </span>
        </span>
        <span className="entry-meta">
          <StatusChip status={b.status} />
        </span>
        <span className="entry-meta entry-date">{formatDateTime(b.created_at)}</span>
        <ChevronRight aria-hidden="true" className="entry-chevron" />
      </button>
      <div id={`${id}-detail`} className="entry-detail" hidden={!open}>
        {mounted && <BenchmarkDetail benchmark={b} providers={providers} />}
      </div>
    </li>
  )
}

function BenchmarkDetail({ benchmark: b, providers }: { benchmark: Benchmark; providers: Provider[] }) {
  const ran = b.status !== 'pending'
  const summary = useResource(
    () => (ran ? api.getBenchmarkSummary(b.id) : Promise.resolve(null)),
    [b.id, b.status, b.updated_at],
  )
  const s = summary.data
  const providerNames = [
    ...new Set(
      b.selected_models.map(
        (m) => providerForModel(providers, m)?.display_name ?? s?.model_summaries[m]?.provider ?? 'Unknown provider',
      ),
    ),
  ]
  const finished =
    b.completed_at !== null
      ? formatDateTime(b.completed_at)
      : b.status === 'running'
        ? 'Still running'
        : b.status === 'pending'
          ? 'Not run yet'
          : 'Not recorded'
  const action =
    b.status === 'pending' ? 'Open and run' : b.status === 'running' ? 'Watch progress' : 'Open full results'

  return (
    <>
      <dl className="kv kv--grid">
        <div>
          <dt>Status</dt>
          <dd>
            <StatusChip status={b.status} />
          </dd>
        </div>
        <div>
          <dt>{providerNames.length === 1 ? 'Provider' : 'Providers'}</dt>
          <dd>{providerNames.join(', ')}</dd>
        </div>
        <div className="kv-wide">
          <dt>Models</dt>
          <dd>
            <ul className="name-list">
              {b.selected_models.map((m) => (
                <li key={m}>
                  {m}
                  {m === b.baseline_model && <span className="muted"> (used today)</span>}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>Set up</dt>
          <dd>{formatDateTime(b.created_at)}</dd>
        </div>
        <div>
          <dt>Finished</dt>
          <dd>{finished}</dd>
        </div>
        <div>
          <dt>Runs per test case</dt>
          <dd>{formatCount(b.repeats)}</dd>
        </div>
        <div>
          <dt>Model used today</dt>
          <dd>{b.baseline_model ?? <span className="muted">Not set</span>}</dd>
        </div>
        {ran && s && (
          <>
            <div>
              <dt>Completed tasks</dt>
              <dd>
                {formatCount(s.successful_evaluations)} of {formatCount(s.total_evaluations)}
              </dd>
            </div>
            <div>
              <dt>Failed tasks</dt>
              <dd className={s.failed_evaluations > 0 ? 'bad' : undefined}>{formatCount(s.failed_evaluations)}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{s.total_evaluations === 0 ? '—' : s.is_mock ? <SimulatedTag /> : 'Live'}</dd>
            </div>
            <div>
              <dt>Model spend</dt>
              <dd>{formatUnitRupees(usdToInr(s.total_cost_usd))}</dd>
            </div>
          </>
        )}
        {b.description && (
          <div className="kv-wide">
            <dt>Description</dt>
            <dd>{b.description}</dd>
          </div>
        )}
      </dl>
      {ran && summary.loading && !s && <Loading label="Counting tasks…" />}
      {ran && summary.error && !s && <ErrorNote onRetry={summary.reload}>{summary.error}</ErrorNote>}
      <div className="actions">
        <Link to={`/app/benchmarks/${b.id}`} className="btn-secondary btn-sm">
          {action}
          <span className="visually-hidden">: {b.name}</span>
        </Link>
      </div>
    </>
  )
}
