import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AccordionSection } from '../../../components/lab/Accordion.tsx'
import { TestCaseExplorer } from '../../../components/lab/TestCases.tsx'
import { EmptyState, ErrorNote, Loading, SimulatedTag, StatusChip } from '../../../components/lab/ui.tsx'
import { useResource } from '../../../hooks/useResource.ts'
import { api } from '../../../services/api.ts'
import type { TargetCategory } from '../../../services/api.ts'
import { buildModelViews, deriveVerdict } from '../../../utils/benchmark.ts'
import { formatCount, formatDate, wordCount } from '../../../utils/format.ts'
import { BenchmarkHistory } from './BenchmarkHistory.tsx'
import { useProject } from './context.ts'
import { EvaluationDetails } from './EvaluationDetails.tsx'
import { ModelPerformance } from './ModelPerformance.tsx'
import { RecommendationSection } from './RecommendationSection.tsx'
import { RunBenchmark } from './RunBenchmark.tsx'
import { WorkloadSection } from './WorkloadSection.tsx'

const SECTIONS = ['workload', 'tests', 'benchmarks', 'performance', 'evaluations', 'recommendation'] as const
type SectionKey = (typeof SECTIONS)[number]
const RESULT_SECTIONS: SectionKey[] = ['performance', 'evaluations', 'recommendation']

/** The volume the recommendation is priced at here; the full results page lets you change it. */
const VOLUME = 1_00_000

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`

function parseOpen(value: string | null): Set<SectionKey> {
  return new Set((value ?? '').split(',').filter((v): v is SectionKey => (SECTIONS as readonly string[]).includes(v)))
}

/**
 * Everything behind the project, in six folded sections: setup first
 * (workload, test cases, runs), then results from one chosen run
 * (performance, every evaluation, the recommendation). Open only what you need.
 */
export default function ProjectAnalysis() {
  const pickerId = useId()
  const { project, testCases, benchmarks, providers, reload, notify, openEdit } = useProject()
  const [params] = useSearchParams()
  const [initial] = useState(() => ({ open: parseOpen(params.get('open')), add: params.get('add') === '1' }))
  const [open, setOpen] = useState<Set<SectionKey>>(initial.open)
  const [addRequest, setAddRequest] = useState(0)

  // Arriving with ?open=… : bring the first requested section into view.
  useEffect(() => {
    const first = SECTIONS.find((key) => initial.open.has(key))
    if (first && !initial.add) document.getElementById(first)?.scrollIntoView({ block: 'start' })
  }, [initial])

  /* ---------- the run that results come from ---------- */

  const resultRuns = useMemo(
    () => benchmarks.filter((b) => b.status === 'completed' || b.status === 'failed'),
    [benchmarks],
  )
  const [chosenId, setChosenId] = useState<string | null>(null)
  const selected =
    resultRuns.find((b) => b.id === chosenId) ?? resultRuns.find((b) => b.status === 'completed') ?? resultRuns[0] ?? null
  const [target, setTarget] = useState<TargetCategory>('best_value')
  const report = useResource(
    () => (selected ? api.getReport(selected.id, VOLUME, target) : Promise.resolve(null)),
    [selected?.id, target],
  )
  const fresh = report.data && selected && report.data.benchmark_id === selected.id ? report.data : null
  // Until the chosen run's report arrives, keep the previous one on screen (dimmed), so open
  // folds stay open. If loading fails, nothing stale is left behind: the error shows instead.
  const current = fresh ?? (report.error ? null : report.data)
  const refreshing = current !== null && (report.loading || current !== fresh)
  const models = useMemo(() => (current ? buildModelViews(current) : []), [current])
  const verdict = useMemo(() => (current ? deriveVerdict(current, models, target) : null), [current, models, target])

  /* ---------- open and close ---------- */

  const visible = resultRuns.length > 0 ? SECTIONS : SECTIONS.filter((key) => !RESULT_SECTIONS.includes(key))
  const allOpen = visible.every((key) => open.has(key))
  const toggle = (key: SectionKey) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const addTestCase = () => {
    setOpen((prev) => new Set(prev).add('tests'))
    setAddRequest((n) => n + 1)
    // The form focuses its first field when it appears; this covers a form that was already open.
    window.requestAnimationFrame(() => document.getElementById('tests')?.scrollIntoView({ block: 'start' }))
  }

  const running = benchmarks.find((b) => b.status === 'running')
  const completedCount = benchmarks.filter((b) => b.status === 'completed').length
  const failedTasks = current?.overall_reliability.failed_evaluations ?? 0
  const loadingSummary = report.loading && !current ? 'Loading…' : undefined

  return (
    <div className="an">
      <div className="an-intro">
        <p className="an-lede">Every detail of this project, folded into sections. Open the ones you need.</p>
        <button
          type="button"
          className="btn-text"
          onClick={() => setOpen(allOpen ? new Set() : new Set(visible))}
          aria-pressed={allOpen}
        >
          {allOpen ? <ChevronsDownUp aria-hidden="true" /> : <ChevronsUpDown aria-hidden="true" />}
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <section className="an-group" aria-labelledby="setup-title">
        <div className="group-head">
          <h2 id="setup-title" className="group-title">
            Setup
          </h2>
        </div>

        <AccordionSection
          id="workload"
          level={3}
          title="Workload configuration"
          summary={`${project.business_domain ?? 'No domain set'}, ${formatCount(wordCount(project.system_prompt))}-word system prompt`}
          open={open.has('workload')}
          onToggle={() => toggle('workload')}
        >
          <WorkloadSection project={project} onEdit={openEdit} />
        </AccordionSection>

        <AccordionSection
          id="tests"
          level={3}
          title="Test cases"
          summary={testCases.length === 0 ? 'None yet' : plural(testCases.length, 'test case')}
          open={open.has('tests')}
          onToggle={() => toggle('tests')}
        >
          <div className="acc-body">
            <TestCaseExplorer
              projectId={project.id}
              testCases={testCases}
              onChanged={reload}
              notify={notify}
              startAdding={initial.add}
              addRequest={addRequest}
            />
          </div>
        </AccordionSection>

        <AccordionSection
          id="benchmarks"
          level={3}
          title="Benchmark runs"
          summary={
            benchmarks.length === 0
              ? 'None yet'
              : `${plural(benchmarks.length, 'run')}, ${formatCount(completedCount)} completed`
          }
          badge={running ? <StatusChip status="running" /> : undefined}
          open={open.has('benchmarks')}
          onToggle={() => toggle('benchmarks')}
        >
          <BenchmarkHistory
            projectId={project.id}
            benchmarks={benchmarks}
            testCaseCount={testCases.length}
            providers={providers}
            onAddTestCase={addTestCase}
          />
        </AccordionSection>
      </section>

      <section
        className={`an-group${refreshing ? ' is-refreshing' : ''}`}
        aria-labelledby="results-title"
        aria-busy={refreshing}
      >
        <div className="group-head">
          <h2 id="results-title" className="group-title">
            Results
          </h2>
          {selected && (
            <div className="group-tools">
              {resultRuns.length > 1 ? (
                <div className="field field--inline">
                  <label htmlFor={`${pickerId}-run`}>From</label>
                  <select id={`${pickerId}-run`} value={selected.id} onChange={(e) => setChosenId(e.target.value)}>
                    {resultRuns.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}, {formatDate(b.completed_at ?? b.created_at)}
                        {b.status === 'failed' ? ' (failed)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="group-note">From “{selected.name}”</p>
              )}
              {current?.is_mock && <SimulatedTag />}
              <Link to={`/app/benchmarks/${selected.id}`} className="btn-text">
                Open full results
              </Link>
            </div>
          )}
        </div>

        {!selected ? (
          <EmptyState
            title={running ? 'Results are on the way' : 'No results yet'}
            action={
              running ? (
                <Link to={`/app/benchmarks/${running.id}`} className="btn-primary">
                  Watch progress
                </Link>
              ) : (
                <RunBenchmark projectId={project.id} hasTestCases={testCases.length > 0} onAddTestCase={addTestCase} />
              )
            }
          >
            <p>Model performance, every evaluation and the recommendation appear here once a benchmark finishes.</p>
          </EmptyState>
        ) : (
          <>
            {report.error && !current && <ErrorNote onRetry={report.reload}>{report.error}</ErrorNote>}

            <AccordionSection
              id="performance"
              level={3}
              title="Model performance"
              summary={loadingSummary ?? (current ? `${plural(models.length, 'model')} compared on six measures` : '')}
              open={open.has('performance')}
              onToggle={() => toggle('performance')}
            >
              {current ? <ModelPerformance report={current} models={models} /> : <SectionLoading />}
            </AccordionSection>

            <AccordionSection
              id="evaluations"
              level={3}
              title="Evaluation details"
              summary={
                loadingSummary ??
                (current
                  ? `${plural(current.overall_reliability.total_evaluations, 'evaluation')}${failedTasks > 0 ? `, ${formatCount(failedTasks)} failed` : ''}`
                  : '')
              }
              open={open.has('evaluations')}
              onToggle={() => toggle('evaluations')}
            >
              <EvaluationDetails
                key={selected.id}
                benchmark={selected}
                testCases={testCases}
                isMock={current?.is_mock ?? false}
              />
            </AccordionSection>

            <AccordionSection
              id="recommendation"
              level={3}
              title="Recommendation"
              summary={loadingSummary ?? verdict?.headline}
              badge={verdict ? <span className={`vchip vchip--${verdict.kind}`}>{verdict.word}</span> : undefined}
              open={open.has('recommendation')}
              onToggle={() => toggle('recommendation')}
            >
              {current && verdict ? (
                <RecommendationSection
                  report={current}
                  models={models}
                  verdict={verdict}
                  target={target}
                  onTarget={setTarget}
                />
              ) : (
                <SectionLoading />
              )}
            </AccordionSection>
          </>
        )}
      </section>
    </div>
  )
}

function SectionLoading() {
  return (
    <div className="acc-body">
      <Loading label="Reading the results…" />
    </div>
  )
}
