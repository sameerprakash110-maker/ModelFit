import { ArrowUpRight, Check, KeyRound, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorNote, Loading, SimulatedTag, StatusChip } from '../../components/lab/ui.tsx'
import { useResource } from '../../hooks/useResource.ts'
import { api } from '../../services/api.ts'
import type { Benchmark, BenchmarkReport, Project, Provider, TestCase } from '../../services/api.ts'
import { getStoredUser } from '../../services/auth.ts'
import { buildModelViews, compare, deriveVerdict, sortProjectsByActivity } from '../../utils/benchmark.ts'
import { formatCount, formatDate, formatDateTime, formatMs, formatPercent, formatRupees, formatUnitRupees } from '../../utils/format.ts'
import { envKeyFor } from '../../utils/providers.ts'

interface OverviewData {
  projects: Project[]
  benchmarks: Benchmark[]
  testCases: TestCase[]
  providers: Provider[]
}

async function loadOverview(): Promise<OverviewData> {
  const [projects, benchmarks, testCases, providers] = await Promise.all([
    api.listProjects(),
    api.listBenchmarks(),
    api.listTestCases(),
    api.listProviders(),
  ])
  return { projects, benchmarks, testCases, providers }
}

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Overview() {
  const { data, error, loading, reload } = useResource(loadOverview, [])
  const user = getStoredUser()
  const firstName = user?.full_name?.split(' ')[0]

  if (loading && !data) return <Loading label="Loading your lab…" />
  if (error && !data) {
    return (
      <div className="page">
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      </div>
    )
  }
  if (!data) return null

  const { projects, benchmarks, testCases, providers } = data
  const completed = benchmarks.filter((b) => b.status === 'completed')
  const caseCount = (projectId: string) => testCases.filter((t) => t.project_id === projectId).length
  const nextStep =
    projects.length === 0
      ? 'Start with one job you use a model for. ModelFit will test models on it and tell you which fits best.'
      : testCases.length === 0
        ? `Add a few real examples to ${projects[0].name}, then run your first benchmark.`
        : benchmarks.length === 0
          ? 'You have test cases ready. Run your first benchmark to see which model fits.'
          : 'Here is where your workloads stand.'

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="page-lede">{nextStep}</p>
      </header>

      <Inventory
        projects={projects.length}
        testCases={testCases.length}
        completed={completed.length}
        providers={providers}
      />

      {completed.length > 0 && <BestFit completed={completed} projects={projects} />}

      {projects.length === 0 ? (
        <FirstUse />
      ) : (
        <section className="section" aria-labelledby="projects-title">
          <div className="section-head">
            <h2 id="projects-title" className="section-title">
              Your projects
            </h2>
          </div>
          <ul className="project-grid">
            {sortProjectsByActivity(projects, benchmarks).map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                cases={caseCount(p.id)}
                benchmarks={benchmarks.filter((b) => b.project_id === p.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {benchmarks.length > 0 && (
        <section className="section" aria-labelledby="recent-title">
          <h2 id="recent-title" className="section-title">
            Recent benchmarks
          </h2>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Recent benchmarks (scrolls sideways)">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Benchmark</th>
                  <th scope="col">Project</th>
                  <th scope="col" className="numcol">
                    Models
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.slice(0, 8).map((b) => (
                  <tr key={b.id}>
                    <th scope="row">
                      <Link to={`/app/benchmarks/${b.id}`} className="row-link">
                        {b.name}
                      </Link>
                    </th>
                    <td>{projects.find((p) => p.id === b.project_id)?.name ?? 'Deleted project'}</td>
                    <td className="numcol">{b.selected_models.length}</td>
                    <td>
                      <StatusChip status={b.status} />
                    </td>
                    <td className="muted">{formatDateTime(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

/* ---------- inventory ---------- */

function Inventory({
  projects,
  testCases,
  completed,
  providers,
}: {
  projects: number
  testCases: number
  completed: number
  providers: Provider[]
}) {
  const missing = providers.filter((p) => !p.is_configured)
  return (
    <section className="inventory" aria-label="Your lab at a glance">
      <dl className="inventory-counts">
        <div>
          <dt>{projects === 1 ? 'Project' : 'Projects'}</dt>
          <dd>{formatCount(projects)}</dd>
        </div>
        <div>
          <dt>{testCases === 1 ? 'Test case' : 'Test cases'}</dt>
          <dd>{formatCount(testCases)}</dd>
        </div>
        <div>
          <dt>Benchmarks completed</dt>
          <dd>{formatCount(completed)}</dd>
        </div>
      </dl>
      <div className="inventory-providers">
        <p className="inventory-label">Model providers</p>
        <ul>
          {providers.map((p) => (
            <li key={p.name} className={p.is_configured ? 'is-on' : 'is-off'}>
              {p.is_configured ? <Check aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
              {p.display_name}
              <span className="visually-hidden">{p.is_configured ? ' connected' : ' not connected'}</span>
            </li>
          ))}
        </ul>
        {missing.length > 0 && (
          <p className="hint">
            {missing.length === providers.length ? 'No provider is connected, so only simulated runs are possible. ' : ''}
            To connect, add{' '}
            {missing.map((p, i) => (
              <span key={p.name}>
                {i > 0 && ', '}
                <code>{envKeyFor(p.name)}</code>
              </span>
            ))}{' '}
            to <code>backend/.env</code> and restart the backend.
          </p>
        )}
      </div>
    </section>
  )
}

/* ---------- best fit ---------- */

/**
 * The headline insight: the latest recommendation from a completed benchmark.
 * Prefers a live run over a simulated one, and a run with a verdict over one without.
 */
function BestFit({ completed, projects }: { completed: Benchmark[]; projects: Project[] }) {
  const candidates = completed.slice(0, 4)
  const { data, loading, error, reload } = useResource(
    () =>
      Promise.all(
        candidates.map((b) =>
          api
            .getReport(b.id, 1_00_000, 'best_value')
            .then((r) => ({ benchmark: b, report: r }))
            .catch(() => null),
        ),
      ),
    [candidates.map((b) => b.id).join()],
  )

  if (loading && !data) {
    return (
      <section className="bestfit bestfit--loading" aria-label="Best fit for your workload">
        <Loading label="Reading your latest results…" />
      </section>
    )
  }
  if (error && !data) return <ErrorNote onRetry={reload}>{error}</ErrorNote>

  const reports = (data ?? []).filter((r): r is { benchmark: Benchmark; report: BenchmarkReport } => r !== null)
  const hasVerdict = (r: BenchmarkReport) =>
    Boolean(r.roi_recommendation?.recommended_primary_model) && r.roi_recommendation?.category !== 'no_eligible_model'
  const chosen =
    reports.find((r) => !r.report.is_mock && hasVerdict(r.report)) ??
    reports.find((r) => hasVerdict(r.report)) ??
    reports[0]
  if (!chosen) return null

  const { benchmark, report } = chosen
  const models = buildModelViews(report)
  const verdict = deriveVerdict(report, models, 'best_value')
  const project = projects.find((p) => p.id === benchmark.project_id)
  const pick = verdict.pick
  const reference = verdict.reference
  const findings = pick && reference ? compare(pick, reference) : []

  return (
    <section className={`bestfit bestfit--${verdict.kind}`} aria-labelledby="bestfit-title">
      <div className="bestfit-main">
        <p className="bestfit-context">
          <span id="bestfit-title">
            Best fit for your workload{project ? ` in ${project.name}` : ''}
          </span>
          {report.is_mock && <SimulatedTag />}
        </p>
        <p className="bestfit-word">{verdict.word}</p>
        <p className="bestfit-headline">{verdict.headline}</p>
        {pick ? (
          <dl className="bestfit-evidence">
            <div>
              <dt>Quality</dt>
              <dd>{pick.quality === null ? 'Not scored' : `${pick.quality.toFixed(1)}/10`}</dd>
            </div>
            <div>
              <dt>Cost per answer</dt>
              <dd>{pick.costPerSuccess === null ? '—' : formatUnitRupees(pick.costPerSuccess)}</dd>
            </div>
            <div>
              <dt>Typical speed</dt>
              <dd>{pick.latencyP50 === null ? '—' : formatMs(pick.latencyP50)}</dd>
            </div>
            <div>
              <dt>Answered</dt>
              <dd>{formatPercent(pick.successRate)}</dd>
            </div>
          </dl>
        ) : (
          <p className="bestfit-why">{verdict.because}</p>
        )}
        {findings.length > 0 && reference && (
          <p className="bestfit-why">
            Against {reference.name} ({verdict.referenceLabel}):{' '}
            {findings
              .filter((f) => f.direction !== 'same')
              .map((f) => f.text.toLowerCase())
              .join('; ') || 'about the same on every measure'}
            .
          </p>
        )}
      </div>
      <div className="bestfit-side">
        {verdict.monthly && pick && (
          <p className="bestfit-money">
            <span className="bestfit-money-figure">{formatRupees(verdict.monthly.pick)}</span>
            <span>a month at 1,00,000 requests</span>
            {verdict.monthly.savings > 0 && (
              <span className="bestfit-save">saves {formatRupees(verdict.monthly.savings)}</span>
            )}
          </p>
        )}
        <Link to={`/app/benchmarks/${benchmark.id}`} className="btn-secondary">
          See the full results
          <ArrowUpRight aria-hidden="true" />
        </Link>
        <p className="bestfit-source">
          From “{benchmark.name}”
          {benchmark.completed_at && <>, {formatDate(benchmark.completed_at)}</>}
        </p>
      </div>
    </section>
  )
}

/* ---------- projects ---------- */

function ProjectCard({ project, cases, benchmarks }: { project: Project; cases: number; benchmarks: Benchmark[] }) {
  const latest = benchmarks[0]
  let next: { label: string; to: string }
  if (cases === 0) next = { label: 'Add test cases', to: `/app/projects/${project.id}` }
  else if (!latest) next = { label: 'Run the first benchmark', to: `/app/new?project=${project.id}` }
  else if (latest.status === 'pending') next = { label: `Run “${latest.name}”`, to: `/app/benchmarks/${latest.id}` }
  else if (latest.status === 'running') next = { label: 'Watch the run in progress', to: `/app/benchmarks/${latest.id}` }
  else if (latest.status === 'failed') next = { label: 'See why the last run failed', to: `/app/benchmarks/${latest.id}` }
  else next = { label: 'See the latest results', to: `/app/benchmarks/${latest.id}` }

  return (
    <li className="project-card">
      <Link to={`/app/projects/${project.id}`} className="project-card-name">
        {project.name}
      </Link>
      {project.business_domain && <p className="project-card-domain">{project.business_domain}</p>}
      <p className="project-card-meta">
        {plural(cases, 'test case')}, {plural(benchmarks.length, 'benchmark')}
      </p>
      <Link to={next.to} className="project-card-next">
        {next.label}
      </Link>
    </li>
  )
}

function FirstUse() {
  return (
    <section className="section" aria-labelledby="how-title">
      <h2 id="how-title" className="section-title">
        How a benchmark works
      </h2>
      <ol className="how">
        <li>
          <p className="how-title">Describe the job</p>
          <p>Name the workload and paste the system prompt you use in production.</p>
        </li>
        <li>
          <p className="how-title">Add real examples</p>
          <p>A handful of real inputs, each with what a good answer does.</p>
        </li>
        <li>
          <p className="how-title">Pick models and run</p>
          <p>Every model answers every example; a judge model scores each answer.</p>
        </li>
        <li>
          <p className="how-title">Read the verdict</p>
          <p>Switch, stay, or not enough evidence, with quality, speed, reliability and cost side by side.</p>
        </li>
      </ol>
      <EmptyState
        title="No projects yet"
        action={
          <Link to="/app/new" className="btn-primary">
            <Plus aria-hidden="true" />
            Create your first project
          </Link>
        }
      >
        <p>Not ready to spend credit? Simulated runs are free and show the whole flow with placeholder results.</p>
      </EmptyState>
    </section>
  )
}
