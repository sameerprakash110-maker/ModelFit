import { useId, useState } from 'react'
import { SectionHead } from '../../../components/landing/SectionHead.tsx'
import { scoreConfigurations } from '../../../utils/exampleScore.ts'
import type { ConfigurationResult, Thresholds, Weights } from '../../../utils/exampleScore.ts'
import { formatUnitRupees } from '../../../utils/format.ts'

/*
  ILLUSTRATIVE DEMO DATA.
  Three made-up configurations on two made-up workloads, written to teach how
  a result table is read. None of these numbers were measured, no real model
  is named, and the page labels them as illustrative wherever they appear.
*/

const DEFAULT_WEIGHTS: Weights = { success: 40, quality: 30, cost: 20, speed: 10 }

const CONFIGURATIONS = {
  a: { id: 'a', name: 'Configuration A', description: 'A small, low-priced model' },
  b: { id: 'b', name: 'Configuration B', description: 'A mid-sized model' },
  c: { id: 'c', name: 'Configuration C', description: 'A large, high-priced model' },
}

interface ExampleWorkload {
  id: string
  label: string
  summary: string
  thresholds: Thresholds
  results: ConfigurationResult[]
  notes: string[]
}

const WORKLOADS: ExampleWorkload[] = [
  {
    id: 'tickets',
    label: 'Classifying support tickets',
    summary: 'Short, structured answers at high volume.',
    thresholds: { minSuccess: 90, minQuality: 80 },
    results: [
      { ...CONFIGURATIONS.a, success: 96, quality: 91, latencyP95: 0.9, costPerSuccess: 0.42 },
      { ...CONFIGURATIONS.b, success: 97, quality: 93, latencyP95: 1.8, costPerSuccess: 1.1 },
      { ...CONFIGURATIONS.c, success: 98, quality: 95, latencyP95: 3.2, costPerSuccess: 3.4 },
    ],
    notes: [
      'All three clear the minimum success rate and quality score, so all three are compared.',
      'C is the most accurate, but only by two points, and it costs eight times as much per successful task as A.',
      'With success and quality this close, cost and speed decide it. A is the best fit.',
    ],
  },
  {
    id: 'contracts',
    label: 'Summarising contracts',
    summary: 'Long, open-ended answers where a mistake is expensive.',
    thresholds: { minSuccess: 85, minQuality: 75 },
    results: [
      { ...CONFIGURATIONS.a, success: 71, quality: 68, latencyP95: 2.1, costPerSuccess: 1.95 },
      { ...CONFIGURATIONS.b, success: 90, quality: 84, latencyP95: 4, costPerSuccess: 2.6 },
      { ...CONFIGURATIONS.c, success: 96, quality: 93, latencyP95: 9, costPerSuccess: 4.2 },
    ],
    notes: [
      'A is the cheapest per successful task and is ruled out anyway. It succeeds on 71% of tasks, under the 85% minimum.',
      'C scores highest on success and quality. It also costs 62% more per successful task than B and takes more than twice as long.',
      "Under the default weights B is the best fit. C's lead in quality isn't large enough to outweigh its cost and its wait.",
    ],
  },
]

type MetricKey = 'success' | 'quality' | 'latencyP95' | 'costPerSuccess'

const COLUMNS: { key: MetricKey; label: string; higherIsBetter: boolean; format: (value: number) => string }[] = [
  { key: 'success', label: 'Task success', higherIsBetter: true, format: (value) => `${value}%` },
  { key: 'quality', label: 'Quality', higherIsBetter: true, format: (value) => `${value} / 100` },
  { key: 'latencyP95', label: 'Latency, P95', higherIsBetter: false, format: (value) => `${value.toFixed(1)} s` },
  { key: 'costPerSuccess', label: 'Cost per successful task', higherIsBetter: false, format: formatUnitRupees },
]

export function ReadingABenchmark() {
  const groupName = useId()
  const [workloadId, setWorkloadId] = useState(WORKLOADS[0].id)
  const workload = WORKLOADS.find((item) => item.id === workloadId) ?? WORKLOADS[0]
  const scored = scoreConfigurations(workload.results, DEFAULT_WEIGHTS, workload.thresholds)

  const bestInColumn = (key: MetricKey, higherIsBetter: boolean) => {
    const values = workload.results.map((result) => result[key])
    return higherIsBetter ? Math.max(...values) : Math.min(...values)
  }

  return (
    <section id="reading" className="reading">
      <div className="wrap">
        <SectionHead title="How to read a benchmark">
          The same three configurations, tried on two different workloads. Switch between them and watch the best fit
          change. No model is the best at everything.
        </SectionHead>

        <div className="reading-bar">
          <fieldset className="segmented segmented--light">
            <legend>Example workload</legend>
            <div className="segmented-options">
              {WORKLOADS.map((item) => (
                <label key={item.id}>
                  <input
                    type="radio"
                    name={groupName}
                    value={item.id}
                    checked={item.id === workloadId}
                    onChange={() => setWorkloadId(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="demo-flag">Illustrative demo data</p>
        </div>

        <div className="reading-grid" aria-live="polite">
          <div>
            <table className="results">
              <caption>
                {workload.summary} Minimums for this workload: {workload.thresholds.minSuccess}% task success and a
                quality score of {workload.thresholds.minQuality}.
              </caption>
              <thead>
                <tr>
                  <td />
                  {COLUMNS.map((column) => (
                    <th key={column.key} scope="col">
                      {column.label}
                    </th>
                  ))}
                  <th scope="col">Overall score</th>
                </tr>
              </thead>
              <tbody>
                {scored.map((result) => (
                  <tr
                    key={result.id}
                    className={result.isBestFit ? 'is-best' : result.ruledOutBy ? 'is-ruled-out' : undefined}
                  >
                    <th scope="row">
                      <span className="results-name">{result.name}</span>
                      <span className="results-description">{result.description}</span>
                      {result.isBestFit && <span className="results-stamp results-stamp--best">Best fit</span>}
                      {result.ruledOutBy && (
                        <span className="results-stamp results-stamp--out">
                          Ruled out: below minimum {result.ruledOutBy === 'success' ? 'success' : 'quality'}
                        </span>
                      )}
                    </th>
                    {COLUMNS.map((column) => {
                      const isBest = result[column.key] === bestInColumn(column.key, column.higherIsBetter)
                      return (
                        <td key={column.key} data-label={column.label}>
                          <span className={isBest ? 'results-top' : undefined}>{column.format(result[column.key])}</span>
                          {isBest && <span className="visually-hidden"> (best in this column)</span>}
                        </td>
                      )
                    })}
                    <td data-label="Overall score" className="results-overall">
                      {result.overall === null ? 'Not scored' : result.overall.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="reading-footnote">
              Every number in this table is made up for the example. Highlighted values are the best in their column.
              The overall score uses the default weights, with cost and speed scored against the best configuration
              that clears the minimums.
            </p>
          </div>

          <div className="reading-notes">
            <h3 className="h3">What to notice</h3>
            <ol>
              {workload.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}
