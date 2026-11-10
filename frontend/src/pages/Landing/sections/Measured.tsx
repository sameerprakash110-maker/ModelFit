import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { SectionHead } from '../../../components/landing/SectionHead.tsx'

const MEASUREMENTS: { name: string; definition: string; more: string }[] = [
  {
    name: 'Task success rate',
    definition: 'The percentage of eligible tasks completed successfully.',
    more: 'Passed tasks divided by eligible tasks. A task passes when its output meets the expected answer or the evaluation rule set for that test case.',
  },
  {
    name: 'Quality score',
    definition: 'How good the response is, judged against predefined rules or a consistent evaluation rubric.',
    more: 'Structured tasks are checked by rules, such as valid JSON or the right category. Open-ended tasks are scored against the same rubric for every model, so the scores can be compared.',
  },
  {
    name: 'Latency',
    definition: 'The time taken to complete a task, reported as an average, P50 and P95.',
    more: 'P50 is the typical case: half of all tasks finish faster. P95 is the slow case: only 5 in 100 take longer. An average on its own hides the slow responses people notice.',
  },
  {
    name: 'Execution cost',
    definition: 'Actual provider usage costs, including retries and every execution attempt.',
    more: 'Worked out from the token usage the provider reports and the price that applies to that model, added up over every attempt, including the ones that failed.',
  },
  {
    name: 'Cost per successful task',
    definition: 'Total execution cost divided by the number of successfully completed tasks.',
    more: 'This is the number that exposes the cheaper model trap. Failed attempts still cost money, so a low price per call can turn into a high price per result.',
  },
  {
    name: 'Reliability',
    definition: 'How consistently tasks are completed, counting failures, timeouts and retries.',
    more: 'The same cases are run more than once. Reliability reflects how much the results vary between runs, and how often calls time out, error or need another attempt.',
  },
]

const FACTORS = [
  { key: 'success', name: 'Task success', tone: 'tape' },
  { key: 'quality', name: 'Quality', tone: 'white' },
  { key: 'cost', name: 'Cost efficiency', tone: 'ink' },
  { key: 'speed', name: 'Speed', tone: 'tick' },
] as const

type FactorKey = (typeof FACTORS)[number]['key']

/* Example priority settings. The first is ModelFit's default; the rest show how a company might shift it. */
const PRIORITIES: { id: string; label: string; weights: Record<FactorKey, number> }[] = [
  { id: 'default', label: 'Default', weights: { success: 40, quality: 30, cost: 20, speed: 10 } },
  { id: 'cost', label: 'Cost first', weights: { success: 30, quality: 20, cost: 40, speed: 10 } },
  { id: 'quality', label: 'Quality first', weights: { success: 30, quality: 50, cost: 10, speed: 10 } },
  { id: 'speed', label: 'Speed first', weights: { success: 30, quality: 20, cost: 10, speed: 40 } },
]

export function Measured() {
  const groupName = useId()
  const [priorityId, setPriorityId] = useState(PRIORITIES[0].id)
  const priority = PRIORITIES.find((item) => item.id === priorityId) ?? PRIORITIES[0]

  return (
    <section id="measured" className="measured">
      <div className="wrap">
        <SectionHead title="What gets measured">
          Six measurements, defined the same way for every model in every run. Open any one for the detail.
        </SectionHead>

        <div className="metrics">
          {MEASUREMENTS.map((metric) => (
            <details key={metric.name} className="metric">
              <summary>
                <h3 className="metric-name">{metric.name}</h3>
                <span className="metric-definition">{metric.definition}</span>
                <Plus className="metric-toggle" aria-hidden="true" />
              </summary>
              <p className="metric-more">{metric.more}</p>
            </details>
          ))}
        </div>

        <div className="weights">
          <div className="weights-text">
            <h3 className="h3">One overall score, weighted by your priorities</h3>
            <p>
              The overall score combines four of these measurements. The default weights suit most workloads, and
              each company can set its own.
            </p>
            <p>
              Thresholds come first. Set a minimum success rate and a minimum quality score, and any model below
              either one is ruled out before scores are compared. An unreliable model can't win just because it is
              cheap.
            </p>
          </div>

          <div className="weights-demo">
            <fieldset className="segmented">
              <legend>Example priorities</legend>
              <div className="segmented-options">
                {PRIORITIES.map((item) => (
                  <label key={item.id}>
                    <input
                      type="radio"
                      name={groupName}
                      value={item.id}
                      checked={item.id === priorityId}
                      onChange={() => setPriorityId(item.id)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="weights-bar" aria-hidden="true">
              {FACTORS.map((factor) => (
                <span key={factor.key} className={`tone-${factor.tone}`} style={{ flexGrow: priority.weights[factor.key] }} />
              ))}
            </div>
            <ul className="weights-legend" aria-live="polite">
              {FACTORS.map((factor) => (
                <li key={factor.key}>
                  <span className={`swatch tone-${factor.tone}`} aria-hidden="true" />
                  {factor.name} <strong>{priority.weights[factor.key]}%</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
