import { RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnswersExplorer } from '../../components/lab/AnswersExplorer.tsx'
import { ChartCard } from '../../components/lab/charts/ChartCard.tsx'
import { MetricBars } from '../../components/lab/charts/MetricBars.tsx'
import { OutcomeBar } from '../../components/lab/charts/OutcomeBar.tsx'
import { QualityCostMap } from '../../components/lab/charts/QualityCostMap.tsx'
import { ComparisonTable } from '../../components/lab/ComparisonTable.tsx'
import { Glossary } from '../../components/lab/Glossary.tsx'
import { RunOptions } from '../../components/lab/RunOptions.tsx'
import { RunProgress } from '../../components/lab/RunProgress.tsx'
import { Crumbs, EmptyState, ErrorNote, Loading, SimulatedTag, StatusChip } from '../../components/lab/ui.tsx'
import { VerdictPanel } from '../../components/lab/Verdict.tsx'
import { useActionError, useResource } from '../../hooks/useResource.ts'
import { api, LAB_DATA_CHANGED } from '../../services/api.ts'
import type { Benchmark, Project, Provider, TargetCategory, TestCase } from '../../services/api.ts'
import {
  buildModelViews,
  costTakeaway,
  deriveVerdict,
  qualityTakeaway,
  reliabilityTakeaway,
  speedTakeaway,
  TARGETS,
} from '../../utils/benchmark.ts'
import type { Role } from '../../utils/benchmark.ts'
import {
  USD_TO_INR,
  formatCount,
  formatDateTime,
  formatMs,
  formatPercent,
  formatUnitRupees,
  parseNumber,
  regroup,
} from '../../utils/format.ts'

interface BaseData {
  benchmark: Benchmark
  project: Project
  providers: Provider[]
  testCases: TestCase[]
}

async function loadBase(benchmarkId: string): Promise<BaseData> {
  const benchmark = await api.getBenchmark(benchmarkId)
  const [project, providers, testCases] = await Promise.all([
    api.getProject(benchmark.project_id),
    api.listProviders(),
    api.listTestCases(benchmark.project_id),
  ])
  return { benchmark, project, providers, testCases }
}

/* Runs started from this tab. Module-level so React's development double-mount can't start one twice. */
const startedHere = new Set<string>()

type AutoRun = { mock: boolean; judge: boolean }

export default function BenchmarkPage() {
  const { benchmarkId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const describeError = useActionError()
  const base = useResource(() => loadBase(benchmarkId), [benchmarkId])
  const [ownRun, setOwnRun] = useState<{ startedAt: number } | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const reloadBase = base.reload
  const status = base.data?.benchmark.status

  const startRun = useCallback(
    async ({ mock, judge }: AutoRun) => {
      if (startedHere.has(benchmarkId)) return
      startedHere.add(benchmarkId)
      setOwnRun({ startedAt: Date.now() })
      setRunError(null)
      // The run request only returns when the run ends. Once the server has marked it running,
      // tell the sidebar so its status updates now rather than at the end.
      const announce = window.setTimeout(() => window.dispatchEvent(new Event(LAB_DATA_CHANGED)), 1200)
      try {
        await api.runBenchmark(benchmarkId, { mock, judge_enabled: judge })
      } catch (err) {
        setRunError(describeError(err))
      } finally {
        window.clearTimeout(announce)
        startedHere.delete(benchmarkId)
        setOwnRun(null)
        reloadBase()
      }
    },
    [benchmarkId, describeError, reloadBase],
  )

  // Arriving from "Create and run": start once, then clear the request so a reload doesn't rerun it.
  const autoRun = (location.state as { autoRun?: AutoRun } | null)?.autoRun
  useEffect(() => {
    if (!autoRun || status !== 'pending') return
    navigate(location.pathname, { replace: true, state: null })
    // Starting the run is the side effect this effect exists for; it marks the page as running.
    // oxlint-disable-next-line react/set-state-in-effect
    void startRun(autoRun)
  }, [autoRun, status, navigate, location.pathname, startRun])

  // A run started elsewhere: check back until it finishes.
  useEffect(() => {
    if (status !== 'running' || ownRun) return
    const timer = window.setInterval(reloadBase, 3000)
    return () => window.clearInterval(timer)
  }, [status, ownRun, reloadBase])

  if (base.loading && !base.data) return <Loading label="Opening benchmark…" />
  if (base.error && !base.data) {
    return (
      <div className="page">
        <ErrorNote onRetry={base.reload}>
          <p>{base.error}</p>
          <p>
            <Link to="/app">Back to the dashboard</Link>
          </p>
        </ErrorNote>
      </div>
    )
  }
  if (!base.data) return null

  const { benchmark, project, providers, testCases } = base.data
  const calls = benchmark.selected_models.length * testCases.length * benchmark.repeats
  const running = Boolean(ownRun) || benchmark.status === 'running'
  const finished = !running && (benchmark.status === 'completed' || benchmark.status === 'failed')

  return (
    <div className="page">
      <Crumbs
        items={[
          { label: 'Dashboard', to: '/app' },
          { label: 'Projects', to: '/app#projects' },
          { label: project.name, to: `/app/projects/${project.id}` },
          { label: benchmark.name },
        ]}
      />

      <header className="page-head page-head--split">
        <div>
          <h1 className="page-title">{benchmark.name}</h1>
          <dl className="facts">
            <div>
              <dt>Project</dt>
              <dd>
                <Link to={`/app/projects/${project.id}`}>{project.name}</Link>
              </dd>
            </div>
            <div>
              <dt>Models</dt>
              <dd>{benchmark.selected_models.length}</dd>
            </div>
            <div>
              <dt>Test cases</dt>
              <dd>{testCases.length}</dd>
            </div>
            <div>
              <dt>Runs per test case</dt>
              <dd>{benchmark.repeats}</dd>
            </div>
            {benchmark.completed_at && (
              <div>
                <dt>Finished</dt>
                <dd>{formatDateTime(benchmark.completed_at)}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="head-actions">
          <StatusChip status={running ? 'running' : benchmark.status} />
          {finished && <RunAgainButton benchmark={benchmark} />}
        </div>
      </header>

      {runError && (
        <ErrorNote>
          <p>The run stopped with an error: {runError}</p>
          <p>Any calls that finished are saved below.</p>
        </ErrorNote>
      )}

      {running ? (
        <RunProgress
          benchmarkId={benchmark.id}
          models={benchmark.selected_models}
          totalCalls={calls}
          startedAt={ownRun?.startedAt ?? null}
          ownRun={Boolean(ownRun)}
          onRecover={async () => {
            await api.recoverBenchmark(benchmark.id)
            base.reload()
          }}
        />
      ) : benchmark.status === 'pending' ? (
        <section className="panel ready" aria-labelledby="ready-title">
          <h2 id="ready-title" className="section-title">
            Ready to run
          </h2>
          {testCases.length === 0 ? (
            <EmptyState
              title="This project has no test cases"
              action={
                <Link className="btn-primary" to={`/app/projects/${project.id}/analysis?open=tests&add=1`}>
                  Add test cases to {project.name}
                </Link>
              }
            >
              <p>Every model answers each test case. Add at least one, then come back to run.</p>
            </EmptyState>
          ) : (
            <>
              <p className="section-lede">
                {benchmark.selected_models.join(', ')} will each answer {plural(testCases.length, 'test case')}
                {benchmark.repeats > 1 ? `, ${benchmark.repeats} times each` : ''}.
                {benchmark.baseline_model && ` You marked ${benchmark.baseline_model} as the model you use today.`}
              </p>
              <RunOptions
                models={benchmark.selected_models}
                providers={providers}
                calls={calls}
                onRun={(options) => void startRun(options)}
              />
            </>
          )}
        </section>
      ) : (
        <Results benchmark={benchmark} testCases={testCases} />
      )}
    </div>
  )
}

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`

function RunAgainButton({ benchmark }: { benchmark: Benchmark }) {
  const navigate = useNavigate()
  const describeError = useActionError()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClick = async () => {
    setBusy(true)
    setError(null)
    try {
      const copy = await api.createBenchmark({
        project_id: benchmark.project_id,
        name: `${benchmark.name.replace(/ \(again\)$/, '')} (again)`,
        description: benchmark.description,
        selected_models: benchmark.selected_models,
        baseline_model: benchmark.baseline_model,
        repeats: benchmark.repeats,
      })
      navigate(`/app/benchmarks/${copy.id}`)
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn-secondary" onClick={onClick} disabled={busy}>
        <RotateCcw aria-hidden="true" />
        {busy ? 'Copying…' : 'Run again'}
      </button>
      {error && <p className="field-error">{error}</p>}
    </>
  )
}

/* ---------- results ---------- */

const VOLUME_PRESETS = [10_000, 1_00_000, 10_00_000]

function Results({ benchmark, testCases }: { benchmark: Benchmark; testCases: TestCase[] }) {
  const id = useId()
  const [volume, setVolume] = useState(1_00_000)
  const [volumeDraft, setVolumeDraft] = useState('1,00,000')
  const [volumeError, setVolumeError] = useState<string | null>(null)
  const [target, setTarget] = useState<TargetCategory>('best_value')
  const report = useResource(() => api.getReport(benchmark.id, volume, target), [benchmark.id, volume, target])
  const evaluations = useResource(() => api.listEvaluations(benchmark.id), [benchmark.id])

  const models = useMemo(() => (report.data ? buildModelViews(report.data) : []), [report.data])
  const verdict = useMemo(
    () => (report.data ? deriveVerdict(report.data, models, target) : null),
    [report.data, models, target],
  )

  const applyVolume = (event?: FormEvent) => {
    event?.preventDefault()
    const value = parseNumber(volumeDraft)
    if (value === null || value < 100) {
      setVolumeError('Enter a number of requests, at least 100.')
      return
    }
    setVolumeError(null)
    setVolumeDraft(regroup(String(Math.round(value))))
    setVolume(Math.round(value))
  }

  if (report.loading && !report.data) return <Loading label="Measuring the results…" />
  if (report.error && !report.data) return <ErrorNote onRetry={report.reload}>{report.error}</ErrorNote>
  if (!report.data || !verdict) return null

  const data = report.data
  // The legend lists every role on screen; a model can be recommended and used today at once.
  const roles = [...new Set<Role>([...models.map((m) => m.role), ...(models.some((m) => m.isBaseline) ? ['baseline' as Role] : [])])]
  const scored = data.overall_quality.sample_count
  const failed = data.overall_reliability.failed_evaluations
  const unscored = Math.max(0, data.overall_reliability.successful_evaluations - scored)
  const hasMap = models.some((m) => m.quality !== null && m.costPerSuccess !== null && m.costPerSuccess > 0)

  return (
    <div className={`bench-results${report.loading ? ' is-refreshing' : ''}`}>
      {data.is_mock && (
        <aside className="note note--sim">
          <SimulatedTag long />
          <p>
            No real model was called. Answers, quality scores, speeds and costs below are placeholders made by the
            simulator, useful for seeing how results read, not for choosing a model. Run again in Live mode for real
            numbers.
          </p>
        </aside>
      )}

      {benchmark.status === 'failed' && <FailureReason evaluations={evaluations.data} />}

      <form className="controls" onSubmit={applyVolume} aria-label="Recommendation settings">
        <fieldset className="target-picker">
          <legend>Optimise for</legend>
          <div className="target-row">
            {TARGETS.map((t) => (
              <label key={t.value}>
                <input
                  type="radio"
                  name={`${id}-target`}
                  checked={target === t.value}
                  onChange={() => setTarget(t.value)}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field field--volume">
          <label htmlFor={`${id}-vol`}>Requests per month</label>
          <div className="volume-row">
            <input
              id={`${id}-vol`}
              inputMode="numeric"
              value={volumeDraft}
              onChange={(e) => setVolumeDraft(e.target.value)}
              onBlur={() => applyVolume()}
              aria-invalid={volumeError ? true : undefined}
              aria-describedby={`${id}-vol-hint`}
            />
            {VOLUME_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                className={`preset${volume === v ? ' is-on' : ''}`}
                aria-pressed={volume === v}
                onClick={() => {
                  setVolume(v)
                  setVolumeDraft(formatCount(v))
                  setVolumeError(null)
                }}
              >
                {formatCount(v)}
              </button>
            ))}
          </div>
          <p id={`${id}-vol-hint`} className={volumeError ? 'field-error' : 'hint'}>
            {volumeError ?? 'Changes the recommendation and monthly estimate. The measurements stay the same.'}
          </p>
        </div>
      </form>

      <VerdictPanel verdict={verdict} models={models} isMock={data.is_mock} />

      <section className="section" aria-labelledby="health-title">
        <h2 id="health-title" className="section-title">
          How the run went
        </h2>
        <p className="section-lede">
          {formatCount(data.overall_reliability.total_evaluations)} calls:{' '}
          {benchmark.selected_models.length} models answered {plural(testCases.length, 'test case')}
          {benchmark.repeats > 1 ? `, ${benchmark.repeats} times each so you can see how consistent they are` : ''}.
          {failed > 0 && ' Failed calls count against a model’s reliability and cost per answer.'}
          {unscored > 0 && ' Answers without a score were not judged, so they don’t affect quality.'}
        </p>
        <OutcomeBar scored={scored} unscored={unscored} failed={failed} />
      </section>

      <section className="section" aria-labelledby="compare-title">
        <h2 id="compare-title" className="section-title">
          Compare the models
        </h2>
        {data.is_mock && (
          <p className="section-lede">
            <SimulatedTag /> These charts show placeholder numbers from the simulator.
          </p>
        )}

        {hasMap ? (
          <ChartCard
            id="map"
            className="chart--wide"
            title="Quality against cost"
            description="Each dot is a model: higher means better answers (judge score out of 10), further left means cheaper per successful answer (₹). The best trade-offs sit top-left."
            roles={roles}
            takeaway={mapTakeaway(models)}
          >
            <QualityCostMap models={models} />
          </ChartCard>
        ) : (
          <p className="callout">
            The quality-against-cost map needs both a quality score and a successful answer for at least one model.
            {data.overall_quality.sample_count === 0 && ' Answers were not scored in this run.'}
          </p>
        )}

        <div className="chart-grid">
          <ChartCard
            id="quality"
            title="Quality"
            description="Average judge score per model, out of 10. Higher is better."
            takeaway={qualityTakeaway(models)}
          >
            <MetricBars
              better="higher"
              max={10}
              emptyLabel="Not scored"
              items={models.map((m) => ({
                model: m,
                value: m.quality,
                label: m.quality === null ? '' : `${m.quality.toFixed(1)}/10`,
              }))}
            />
          </ChartCard>
          <ChartCard
            id="cost"
            title="Cost per successful answer"
            description="Rupees spent per answer that came back. Lower is better."
            takeaway={costTakeaway(models)}
          >
            <MetricBars
              better="lower"
              emptyLabel="No answers"
              items={models.map((m) => ({
                model: m,
                value: m.costPerSuccess,
                label: m.costPerSuccess === null ? '' : formatUnitRupees(m.costPerSuccess),
              }))}
            />
          </ChartCard>
          <ChartCard
            id="speed"
            title="Speed"
            description="Bar: typical response time (median). Tick: the slowest 1 in 20 calls (p95). Shorter is better."
            takeaway={speedTakeaway(models)}
          >
            <MetricBars
              better="lower"
              emptyLabel="No answers"
              markerName="Slowest 5% of calls (p95)"
              items={models.map((m) => ({
                model: m,
                value: m.latencyP50,
                label: m.latencyP50 === null ? '' : formatMs(m.latencyP50),
                marker:
                  m.latencyP95 !== null && m.latencyP50 !== null && m.latencyP95 > m.latencyP50
                    ? { value: m.latencyP95, label: `p95 ${formatMs(m.latencyP95)}` }
                    : null,
              }))}
            />
          </ChartCard>
          <ChartCard
            id="reliability"
            title="Reliability"
            description="Share of calls that returned an answer. Higher is better; below 90% rules a model out."
            takeaway={reliabilityTakeaway(models)}
          >
            <MetricBars
              better="higher"
              max={1}
              emptyLabel="No calls"
              items={models.map((m) => ({
                model: m,
                value: m.calls > 0 ? m.successRate : null,
                label: m.calls > 0 ? `${formatPercent(m.successRate)} (${m.successes}/${m.calls})` : '',
              }))}
            />
          </ChartCard>
        </div>
      </section>

      <section className="section" aria-labelledby="numbers-title">
        <h2 id="numbers-title" className="section-title">
          All the numbers
        </h2>
        <p className="section-lede">Every measurement for every model, including tokens used per call.</p>
        <ComparisonTable models={models} isMock={data.is_mock} />
        <Glossary />
      </section>

      <section className="section" aria-labelledby="answers-title">
        <h2 id="answers-title" className="section-title">
          What each model said
        </h2>
        <p className="section-lede">Read the answers behind the scores, one test case at a time.</p>
        {evaluations.error ? (
          <ErrorNote onRetry={evaluations.reload}>{evaluations.error}</ErrorNote>
        ) : !evaluations.data ? (
          <Loading label="Loading answers…" />
        ) : (
          <AnswersExplorer
            evaluations={evaluations.data}
            testCases={testCases}
            models={models}
            isMock={data.is_mock}
          />
        )}
      </section>

      <p className="footnote">
        Providers price in US dollars. Rupee amounts use ₹{USD_TO_INR} per US$ and include only model calls, not judge
        calls.
      </p>
    </div>
  )
}

function mapTakeaway(models: ReturnType<typeof buildModelViews>): string {
  const pick = models.find((m) => m.isRecommended)
  const plotted = models.filter((m) => m.quality !== null && m.costPerSuccess !== null)
  if (!pick || pick.quality === null || pick.costPerSuccess === null) {
    return `${plotted.length} ${plotted.length === 1 ? 'model is' : 'models are'} plotted. None is recommended, so read the dots against each other.`
  }
  const cheaperAndBetter = plotted.filter(
    (m) => m !== pick && (m.costPerSuccess as number) <= pick.costPerSuccess! && (m.quality as number) >= pick.quality!,
  )
  return cheaperAndBetter.length === 0
    ? `No other model is both cheaper and higher quality than ${pick.name}.`
    : `${cheaperAndBetter.map((m) => m.name).join(' and ')} matched or beat ${pick.name} on both quality and cost. ${pick.name} still won on the current “Optimise for” setting, or the others were ruled out (see “Can be recommended?” below).`
}

function FailureReason({ evaluations }: { evaluations: { id: string; status: string }[] | null }) {
  const firstFailed = evaluations?.find((e) => e.status === 'failed')
  const detail = useResource(
    () => (firstFailed ? api.getEvaluation(firstFailed.id) : Promise.resolve(null)),
    [firstFailed?.id],
  )
  const message = detail.data?.attempts.find((a) => a.error_message)?.error_message

  return (
    <ErrorNote>
      <p>
        <strong>No call in this run succeeded,</strong> so there is nothing to compare.
      </p>
      {message && (
        <p>
          The provider said: <q>{message}</q>
        </p>
      )}
      <p>
        Fix the cause (often a missing API key or exhausted credit), then use <strong>Run again</strong>.
      </p>
    </ErrorNote>
  )
}
