import { ChevronRight } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { EmptyState, ErrorNote, Loading } from '../../../components/lab/ui.tsx'
import { useResource } from '../../../hooks/useResource.ts'
import { api } from '../../../services/api.ts'
import type { Benchmark, Evaluation, TestCase } from '../../../services/api.ts'
import { orderTestCases } from '../../../utils/benchmark.ts'
import { formatCount, formatMs, formatUnitRupees, usdToInr } from '../../../utils/format.ts'

const PAGE = 20

type Outcome = 'all' | 'scored' | 'unscored' | 'failed'

/**
 * Every evaluation in the selected run: one test case, one model, one attempt
 * at answering. Rows stay closed until you open one to read the response.
 */
export function EvaluationDetails({
  benchmark,
  testCases,
  isMock,
}: {
  benchmark: Benchmark
  testCases: TestCase[]
  isMock: boolean
}) {
  const id = useId()
  const evaluations = useResource(() => api.listEvaluations(benchmark.id), [benchmark.id])
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [outcome, setOutcome] = useState<Outcome>('all')
  const [shown, setShown] = useState(PAGE)

  const numbers = useMemo(
    () => new Map(orderTestCases(testCases).map((tc, i) => [tc.id, { number: i + 1, testCase: tc }])),
    [testCases],
  )

  if (evaluations.error && !evaluations.data) {
    return (
      <div className="acc-body">
        <ErrorNote onRetry={evaluations.reload}>{evaluations.error}</ErrorNote>
      </div>
    )
  }
  if (!evaluations.data) {
    return (
      <div className="acc-body">
        <Loading label="Loading evaluations…" />
      </div>
    )
  }

  const all = evaluations.data
  const providers = [...new Set(all.map((e) => e.provider_name))].sort()
  const models = [...new Set(all.filter((e) => !provider || e.provider_name === provider).map((e) => e.model_name))].sort()
  const filtered = all
    .filter(
      (e) =>
        (!provider || e.provider_name === provider) &&
        (!model || e.model_name === model) &&
        (outcome === 'all' || outcomeOf(e) === outcome),
    )
    .sort((a, b) => {
      const na = a.test_case_id ? (numbers.get(a.test_case_id)?.number ?? 1e9) : 1e9
      const nb = b.test_case_id ? (numbers.get(b.test_case_id)?.number ?? 1e9) : 1e9
      return na - nb || a.model_name.localeCompare(b.model_name) || a.repeat_index - b.repeat_index
    })
  const reset = () => setShown(PAGE)

  if (all.length === 0) {
    return (
      <div className="acc-body">
        <EmptyState title="No evaluations recorded">
          <p>This run has no saved answers. If it stopped early, run it again from the full results page.</p>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="acc-body">
      <div className="toolbar">
        {providers.length > 1 && (
          <div className="field field--inline">
            <label htmlFor={`${id}-provider`}>Provider</label>
            <select
              id={`${id}-provider`}
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value)
                setModel('')
                reset()
              }}
            >
              <option value="">All providers</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
        {models.length > 1 && (
          <div className="field field--inline">
            <label htmlFor={`${id}-model`}>Model</label>
            <select
              id={`${id}-model`}
              value={model}
              onChange={(e) => {
                setModel(e.target.value)
                reset()
              }}
            >
              <option value="">All models</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field field--inline">
          <label htmlFor={`${id}-outcome`}>Outcome</label>
          <select
            id={`${id}-outcome`}
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value as Outcome)
              reset()
            }}
          >
            <option value="all">All outcomes</option>
            <option value="scored">Answered and scored</option>
            <option value="unscored">Answered, not scored</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <p className="toolbar-note toolbar-end">
          {formatCount(filtered.length)} of {formatCount(all.length)}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No evaluations match these filters"
          action={
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setProvider('')
                setModel('')
                setOutcome('all')
                reset()
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <ul className="entries" aria-label="Evaluations">
          {filtered.slice(0, shown).map((e) => {
            const match = e.test_case_id ? numbers.get(e.test_case_id) : undefined
            return (
              <EvaluationEntry
                key={e.id}
                evaluation={e}
                number={match?.number ?? null}
                testCase={match?.testCase ?? null}
                repeats={benchmark.repeats}
                isMock={isMock}
              />
            )
          })}
        </ul>
      )}

      {filtered.length > shown && (
        <button type="button" className="btn-secondary btn-sm more" onClick={() => setShown((n) => n + PAGE)}>
          Show {formatCount(Math.min(PAGE, filtered.length - shown))} more
        </button>
      )}
    </div>
  )
}

function outcomeOf(e: Evaluation): Exclude<Outcome, 'all'> {
  if (e.status === 'failed') return 'failed'
  return e.quality_score === null ? 'unscored' : 'scored'
}

function EvaluationEntry({
  evaluation: e,
  number,
  testCase,
  repeats,
  isMock,
}: {
  evaluation: Evaluation
  number: number | null
  testCase: TestCase | null
  repeats: number
  isMock: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  if (open && !mounted) setMounted(true)
  const outcome = outcomeOf(e)
  const caseLabel = number ? `Test case ${number}` : 'Deleted test case'

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
          <span className="entry-title">
            {caseLabel}
            {repeats > 1 && <span className="muted">, run {e.repeat_index + 1}</span>}
          </span>
          <span className="entry-sub">
            {e.model_name} <span className="muted">({e.provider_name})</span>
          </span>
        </span>
        <span className="entry-meta">
          <span className={`run run--${outcome}`}>
            {outcome === 'failed' ? 'Failed' : outcome === 'unscored' ? 'Not scored' : `${e.quality_score?.toFixed(1)}/10`}
          </span>
        </span>
        <span className="entry-meta entry-date">{formatMs(e.latency_ms)}</span>
        <ChevronRight aria-hidden="true" className="entry-chevron" />
      </button>
      <div id={`${id}-detail`} className="entry-detail" hidden={!open}>
        {mounted && <EvaluationDetail evaluation={e} caseLabel={caseLabel} testCase={testCase} isMock={isMock} />}
      </div>
    </li>
  )
}

function EvaluationDetail({
  evaluation: e,
  caseLabel,
  testCase,
  isMock,
}: {
  evaluation: Evaluation
  caseLabel: string
  testCase: TestCase | null
  isMock: boolean
}) {
  // A failed call's reason lives on its attempts, which only the detail endpoint returns.
  const failed = e.status === 'failed'
  const detail = useResource(() => (failed ? api.getEvaluation(e.id) : Promise.resolve(null)), [e.id, failed])
  const errorMessage = detail.data?.attempts.find((a) => a.error_message)?.error_message

  return (
    <>
      <dl className="kv kv--grid">
        <div className="kv-wide">
          <dt>{caseLabel}</dt>
          <dd className="kv-text">
            {testCase ? testCase.input_prompt : <span className="muted">This test case was deleted after the run.</span>}
          </dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{e.provider_name}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{e.model_name}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd className={failed ? 'bad' : undefined}>
            {failed ? 'Failed' : 'Answered'}
            {e.attempt_count > 1 && <span className="muted"> after {e.attempt_count} attempts</span>}
          </dd>
        </div>
        <div>
          <dt>Quality score</dt>
          <dd>{e.quality_score === null ? <span className="muted">Not scored</span> : `${e.quality_score.toFixed(1)}/10`}</dd>
        </div>
        <div>
          <dt>Latency</dt>
          <dd>{formatMs(e.latency_ms)}</dd>
        </div>
        <div>
          <dt>Input tokens</dt>
          <dd>{formatCount(e.input_tokens)}</dd>
        </div>
        <div>
          <dt>Output tokens</dt>
          <dd>{formatCount(e.output_tokens)}</dd>
        </div>
        <div>
          <dt>Execution cost</dt>
          <dd>{formatUnitRupees(usdToInr(Number(e.execution_cost)))}</dd>
        </div>
      </dl>

      <div className="response">
        <p className="response-label">Model response</p>
        {failed ? (
          <p className="answer-failed">
            {detail.loading && !detail.data
              ? 'Loading the error…'
              : (errorMessage ?? e.judge_reasoning ?? 'The provider returned no error message.')}
          </p>
        ) : (
          <pre className="answer-text">{e.response_text || 'The model returned an empty answer.'}</pre>
        )}
        {!failed && e.judge_reasoning && (
          <p className="answer-judge">
            <span>{isMock ? 'Placeholder judge:' : 'Judge:'}</span> {e.judge_reasoning}
          </p>
        )}
        {testCase && (
          <p className="tc-good">
            <span>Expected behaviour:</span> {testCase.expected_behavior}
          </p>
        )}
      </div>
    </>
  )
}
