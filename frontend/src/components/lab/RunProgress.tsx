import { useEffect, useState } from 'react'
import { api } from '../../services/api.ts'
import type { Evaluation } from '../../services/api.ts'
import { formatCount } from '../../utils/format.ts'
import { ErrorNote } from './ui.tsx'

/**
 * A run in progress. Progress is real: the backend saves each call as it finishes,
 * and this view counts them every couple of seconds.
 */
export function RunProgress({
  benchmarkId,
  models,
  totalCalls,
  startedAt,
  ownRun,
  onRecover,
}: {
  benchmarkId: string
  models: string[]
  totalCalls: number
  startedAt: number | null
  ownRun: boolean
  onRecover: () => Promise<void>
}) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [recoverError, setRecoverError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = () =>
      api
        .listEvaluations(benchmarkId)
        .then((list) => !cancelled && setEvaluations(list))
        .catch(() => {
          // Keep the last count; the next poll may succeed.
        })
    poll()
    const timer = window.setInterval(() => {
      poll()
      setNow(Date.now())
    }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [benchmarkId])

  const done = evaluations.length
  const failed = evaluations.filter((e) => e.status === 'failed').length
  const pct = totalCalls > 0 ? Math.min(100, (done / totalCalls) * 100) : 0
  const perModelTotal = models.length ? totalCalls / models.length : 0
  const elapsed = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : null

  const onClick = async () => {
    setRecoverError(null)
    try {
      await onRecover()
    } catch (err) {
      setRecoverError(err instanceof Error ? err.message : 'Could not close out the run.')
    }
  }

  return (
    <section className="progress" aria-labelledby="progress-title">
      <div className="progress-head">
        <h2 id="progress-title" className="section-title">
          Running your benchmark
        </h2>
        <p className="progress-count" role="status" aria-live="polite">
          <strong>{formatCount(done)}</strong> of {formatCount(totalCalls)} calls finished
          {failed > 0 && `, ${formatCount(failed)} failed`}
          {elapsed !== null && <span className="progress-time"> after {formatElapsed(elapsed)}</span>}
        </p>
      </div>

      <div
        className="progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalCalls}
        aria-valuenow={done}
        aria-label="Calls finished"
      >
        <span style={{ width: `${pct}%` }} />
      </div>

      <ul className="progress-models">
        {models.map((name) => {
          const mine = evaluations.filter((e) => e.model_name === name)
          const mineFailed = mine.filter((e) => e.status === 'failed').length
          return (
            <li key={name}>
              <span className="progress-model-name">{name}</span>
              <span className="progress-mini" aria-hidden="true">
                <span style={{ width: `${perModelTotal ? (mine.length / perModelTotal) * 100 : 0}%` }} />
              </span>
              <span className="progress-model-count">
                {formatCount(mine.length)} of {formatCount(perModelTotal)}
                {mineFailed > 0 && <span className="bad">, {mineFailed} failed</span>}
              </span>
            </li>
          )
        })}
      </ul>

      <p className="hint">
        {ownRun
          ? 'Each call includes the model answering and, if scoring is on, the judge reading the answer. Results open here when the last call finishes. You can keep using other pages of the lab meanwhile.'
          : 'This benchmark was started elsewhere. This page checks back every few seconds and shows results when it finishes.'}
      </p>

      {!ownRun && (
        <div className="stuck">
          <p>
            Not moving for several minutes? If the backend restarted mid-run, the run can't finish on its own.{' '}
            <button type="button" className="btn-text" onClick={onClick}>
              Close it out with the results saved so far
            </button>
          </p>
          {recoverError && <ErrorNote>{recoverError}</ErrorNote>}
        </div>
      )}
    </section>
  )
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}
