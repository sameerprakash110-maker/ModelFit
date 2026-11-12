import type { ReactNode } from 'react'
import { Disclosure } from '../../../components/lab/Accordion.tsx'
import { MetricBars } from '../../../components/lab/charts/MetricBars.tsx'
import { ComparisonTable } from '../../../components/lab/ComparisonTable.tsx'
import { Glossary } from '../../../components/lab/Glossary.tsx'
import { RoleLegend, SimulatedTag } from '../../../components/lab/ui.tsx'
import type { BenchmarkReport } from '../../../services/api.ts'
import {
  costTakeaway,
  leaderOf,
  qualityTakeaway,
  reliabilityTakeaway,
  retryTakeaway,
  speedTakeaway,
  spendTakeaway,
} from '../../../utils/benchmark.ts'
import type { ModelView, Role } from '../../../utils/benchmark.ts'
import { formatMs, formatPercent, formatUnitRupees } from '../../../utils/format.ts'

const quality = (m: ModelView) => m.quality
const success = (m: ModelView) => (m.calls > 0 ? m.successRate : null)
const speed = (m: ModelView) => m.latencyP50
const perTask = (m: ModelView) => m.costPerSuccess
const spend = (m: ModelView) => (m.calls > 0 ? m.totalCost : null)
const retries = (m: ModelView) => (m.calls > 0 ? m.retryRate : null)

/** "Highest: model-x, 8.2/10", or "Not measured". Used in closed group headers. */
function leaderText(
  models: ModelView[],
  value: (m: ModelView) => number | null,
  better: 'higher' | 'lower',
  word: string,
  format: (v: number) => string,
): string {
  const leader = leaderOf(models, value, better)
  return leader ? `${word}: ${leader.name}, ${format(leader.value)}` : 'Not measured'
}

/**
 * How the models compared: four leaders up front, then one fold per measure.
 * Each fold says what the measure means, shows it as ranked bars, and ends with
 * the takeaway in words. Only one chart is drawn per opened fold.
 */
export function ModelPerformance({ report, models }: { report: BenchmarkReport; models: ModelView[] }) {
  const roles = [...new Set<Role>([...models.map((m) => m.role), ...(models.some((m) => m.isBaseline) ? ['baseline' as Role] : [])])]
  const leaders: { label: string; leader: ReturnType<typeof leaderOf>; format: (v: number) => string }[] = [
    { label: 'Highest quality', leader: leaderOf(models, quality, 'higher'), format: (v) => `${v.toFixed(1)}/10` },
    { label: 'Most reliable', leader: leaderOf(models, success, 'higher'), format: (v) => `${formatPercent(v)} answered` },
    { label: 'Fastest', leader: leaderOf(models, speed, 'lower'), format: (v) => `${formatMs(v)} typical` },
    { label: 'Cheapest per task', leader: leaderOf(models, perTask, 'lower'), format: formatUnitRupees },
  ]

  return (
    <div className="acc-body">
      {report.is_mock && (
        <p className="hint">
          <SimulatedTag /> Simulated run: every number below is a placeholder, not a measurement.
        </p>
      )}

      <dl className="leaders" aria-label="Leaders on each measure">
        {leaders.map(({ label, leader, format }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {leader ? (
                <>
                  <span className="leader-name">{leader.name}</span>
                  <span className="leader-value">{format(leader.value)}</span>
                </>
              ) : (
                <span className="muted">Not measured</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <RoleLegend roles={roles} />

      <div className="folds">
        <MetricFold
          title="Task success rate"
          summary={leaderText(models, success, 'higher', 'Highest', formatPercent)}
          description="The share of tasks (one model answering one test case once) that returned an answer. Higher is better; below 90% rules a model out of the recommendation."
          takeaway={reliabilityTakeaway(models)}
        >
          <MetricBars
            better="higher"
            max={1}
            emptyLabel="No calls"
            items={models.map((m) => ({
              model: m,
              value: success(m),
              label: m.calls > 0 ? `${formatPercent(m.successRate)} (${m.successes}/${m.calls})` : '',
            }))}
          />
        </MetricFold>

        <MetricFold
          title="Quality score"
          summary={leaderText(models, quality, 'higher', 'Highest', (v) => `${v.toFixed(1)}/10`)}
          description="Average judge score out of 10, measured against each test case’s expected behaviour. Higher is better; differences under half a point are within normal variation."
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
        </MetricFold>

        <MetricFold
          title="Latency"
          summary={leaderText(models, speed, 'lower', 'Fastest', formatMs)}
          description="Time from sending a request to receiving the full answer. Bar: the typical (median) task. Tick: the slowest 1 in 20 tasks (p95). Shorter is better."
          takeaway={speedTakeaway(models)}
        >
          <MetricBars
            better="lower"
            emptyLabel="No answers"
            markerName="Slowest 5% of tasks (p95)"
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
        </MetricFold>

        <MetricFold
          title="Execution cost"
          summary={leaderText(models, spend, 'lower', 'Lowest', formatUnitRupees)}
          description="Everything spent on each model’s calls in this run, in rupees. It grows with the number of tasks and the length of the answers."
          takeaway={spendTakeaway(models)}
        >
          <MetricBars
            better="lower"
            emptyLabel="No calls"
            items={models.map((m) => ({
              model: m,
              value: spend(m),
              label: m.calls > 0 ? formatUnitRupees(m.totalCost) : '',
            }))}
          />
        </MetricFold>

        <MetricFold
          title="Cost per successful task"
          summary={leaderText(models, perTask, 'lower', 'Lowest', formatUnitRupees)}
          description="Total spend divided by the tasks that returned an answer, so failures count against a model. This is the number that scales with your traffic. Lower is better."
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
        </MetricFold>

        <MetricFold
          title="Reliability"
          summary={leaderText(models, retries, 'lower', 'Fewest retries', (v) => `${formatPercent(v)} retried`)}
          description="How often a call needed a retry before it answered or gave up. Retries add waiting time and hint at an unstable provider. Lower is steadier."
          takeaway={retryTakeaway(models)}
        >
          <MetricBars
            better="lower"
            max={1}
            emptyLabel="No calls"
            items={models.map((m) => ({
              model: m,
              value: retries(m),
              label:
                m.calls > 0
                  ? `${formatPercent(m.retryRate)} retried${m.failures > 0 ? `, ${m.failures} failed` : ''}`
                  : '',
            }))}
          />
        </MetricFold>

        <Disclosure title="All numbers in one table" summary="Every measure for every model, with tokens">
          <div className="fold-body">
            <ComparisonTable models={models} isMock={report.is_mock} />
            <Glossary />
          </div>
        </Disclosure>
      </div>
    </div>
  )
}

function MetricFold({
  title,
  summary,
  description,
  takeaway,
  children,
}: {
  title: string
  summary: string
  description: string
  takeaway: string
  children: ReactNode
}) {
  return (
    <Disclosure title={title} summary={summary}>
      <figure className="fold-body measure">
        <p className="measure-desc">{description}</p>
        {children}
        <figcaption className="measure-takeaway">{takeaway}</figcaption>
      </figure>
    </Disclosure>
  )
}
