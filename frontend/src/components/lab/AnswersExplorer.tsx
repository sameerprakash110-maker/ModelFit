import { useId, useMemo, useState } from 'react'
import type { Evaluation, TestCase } from '../../services/api.ts'
import type { ModelView } from '../../utils/benchmark.ts'
import { formatCount, formatMs, formatUnitRupees, usdToInr } from '../../utils/format.ts'
import { EmptyState, ModelName } from './ui.tsx'

const PAGE = 5

/**
 * What each model actually said, test case by test case. Repeated runs sit side by
 * side so consistency is visible; failed calls and unscored answers say so plainly.
 */
export function AnswersExplorer({
  evaluations,
  testCases,
  models,
  isMock,
}: {
  evaluations: Evaluation[]
  testCases: TestCase[]
  models: ModelView[]
  isMock: boolean
}) {
  const id = useId()
  const [model, setModel] = useState('')
  const [failedOnly, setFailedOnly] = useState(false)
  const [shown, setShown] = useState(PAGE)

  const failedCount = evaluations.filter((e) => e.status === 'failed').length

  const groups = useMemo(() => {
    // Oldest test case first, numbered the same way as on the project page.
    const ordered = [...testCases].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const number = new Map(ordered.map((tc, i) => [tc.id, i + 1]))
    const filtered = evaluations.filter(
      (e) => (!model || e.model_name === model) && (!failedOnly || e.status === 'failed'),
    )
    const byCase = new Map<string, Evaluation[]>()
    for (const e of filtered) {
      const key = e.test_case_id ?? 'deleted'
      byCase.set(key, [...(byCase.get(key) ?? []), e])
    }
    return [...byCase.entries()]
      .map(([caseId, evals]) => ({
        caseId,
        number: number.get(caseId) ?? null,
        testCase: testCases.find((t) => t.id === caseId) ?? null,
        byModel: models
          .map((m) => ({
            model: m,
            runs: evals.filter((e) => e.model_name === m.name).sort((a, b) => a.repeat_index - b.repeat_index),
          }))
          .filter((row) => row.runs.length > 0),
      }))
      .sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9))
  }, [evaluations, testCases, models, model, failedOnly])

  return (
    <div className="answers">
      <div className="answers-controls">
        <div className="field field--inline">
          <label htmlFor={`${id}-model`}>Model</label>
          <select
            id={`${id}-model`}
            value={model}
            onChange={(e) => {
              setModel(e.target.value)
              setShown(PAGE)
            }}
          >
            <option value="">All models</option>
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {failedCount > 0 && (
          <label className="check-inline">
            <input
              type="checkbox"
              checked={failedOnly}
              onChange={(e) => {
                setFailedOnly(e.target.checked)
                setShown(PAGE)
              }}
            />
            Only failed calls ({formatCount(failedCount)})
          </label>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No answers match these filters">
          <p>Choose “All models” or clear “Only failed calls” to see everything.</p>
        </EmptyState>
      ) : (
        <ol className="cases">
          {groups.slice(0, shown).map((group) => (
            <li key={group.caseId} className="case-card">
              <div className="case-card-head">
                <p className="case-card-num">{group.number ? `Test case ${group.number}` : 'Deleted test case'}</p>
                {group.testCase && (
                  <>
                    <p className="case-card-input">{group.testCase.input_prompt}</p>
                    <p className="case-card-good">
                      <span>A good answer:</span> {group.testCase.expected_behavior}
                    </p>
                  </>
                )}
              </div>
              <ul className="case-models">
                {group.byModel.map(({ model: m, runs }) => (
                  <li key={m.name} className="case-model">
                    <div className="case-model-row">
                      <ModelName name={m.name} role={m.role} isBaseline={m.isBaseline} />
                      <ul className="runs" aria-label={`${m.name}: ${runs.length} ${runs.length === 1 ? 'run' : 'runs'}`}>
                        {runs.map((r) => (
                          <li key={r.id} className={`run run--${runStatus(r)}`}>
                            <span className="visually-hidden">Run {r.repeat_index + 1}: </span>
                            {r.status === 'failed'
                              ? 'Failed'
                              : r.quality_score === null
                                ? 'Not scored'
                                : `${r.quality_score.toFixed(1)}/10`}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <details className="case-model-detail">
                      <summary>
                        Read {runs.length === 1 ? 'the answer' : `all ${runs.length} answers`}
                        <span className="visually-hidden"> from {m.name}</span>
                      </summary>
                      {runs.map((r) => (
                        <div key={r.id} className="answer">
                          {runs.length > 1 && <p className="answer-run">Run {r.repeat_index + 1}</p>}
                          {r.status === 'failed' ? (
                            <p className="answer-failed">
                              This call failed after {r.attempt_count}{' '}
                              {r.attempt_count === 1 ? 'attempt' : 'attempts'}. {r.judge_reasoning}
                            </p>
                          ) : (
                            <pre className="answer-text">{r.response_text || 'The model returned an empty answer.'}</pre>
                          )}
                          {r.status !== 'failed' && r.judge_reasoning && (
                            <p className="answer-judge">
                              <span>{isMock ? 'Placeholder judge:' : 'Judge:'}</span> {r.judge_reasoning}
                            </p>
                          )}
                          <p className="answer-meta">
                            Took {formatMs(r.latency_ms)}, used {formatCount(r.input_tokens)} tokens in and{' '}
                            {formatCount(r.output_tokens)} out, cost {formatUnitRupees(usdToInr(Number(r.execution_cost)))}.
                          </p>
                        </div>
                      ))}
                    </details>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {groups.length > shown && (
        <button type="button" className="btn-secondary" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, groups.length - shown)} more test cases
        </button>
      )}
    </div>
  )
}

function runStatus(e: Evaluation): 'failed' | 'unscored' | 'scored' {
  if (e.status === 'failed') return 'failed'
  return e.quality_score === null ? 'unscored' : 'scored'
}
