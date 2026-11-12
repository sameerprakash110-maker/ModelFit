import { Info } from 'lucide-react'
import { useId } from 'react'
import { Disclosure } from '../../../components/lab/Accordion.tsx'
import { FittingTape } from '../../../components/lab/charts/FittingTape.tsx'
import { SimulatedTag } from '../../../components/lab/ui.tsx'
import type { BenchmarkReport, TargetCategory } from '../../../services/api.ts'
import { MIN_QUALITY, MIN_SUCCESS_RATE, TARGETS } from '../../../utils/benchmark.ts'
import type { ModelView, Verdict } from '../../../utils/benchmark.ts'
import { formatCount, formatMs, formatPercent, formatRupees, formatUnitRupees } from '../../../utils/format.ts'

/**
 * The recommendation first, in words; the reasons, trade-offs and next step
 * beneath it; the measured evidence folded away until asked for.
 */
export function RecommendationSection({
  report,
  models,
  verdict,
  target,
  onTarget,
}: {
  report: BenchmarkReport
  models: ModelView[]
  verdict: Verdict
  target: TargetCategory
  onTarget: (target: TargetCategory) => void
}) {
  const id = useId()
  const { pick, reference, findings } = verdict
  const gains = findings.filter((f) => f.direction === 'gain')
  const losses = findings.filter((f) => f.direction === 'loss')
  const same = findings.filter((f) => f.direction === 'same')

  return (
    <div className="acc-body">
      <fieldset className="target-picker">
        <legend>Optimise for</legend>
        <div className="target-row">
          {TARGETS.map((t) => (
            <label key={t.value}>
              <input
                type="radio"
                name={`${id}-target`}
                checked={target === t.value}
                onChange={() => onTarget(t.value)}
              />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={`rec rec--${verdict.kind}`}>
        <p className="rec-word">
          {verdict.word}
          {report.is_mock && <SimulatedTag />}
        </p>
        <p className="rec-headline">{verdict.headline}</p>
        <p className="rec-because">{verdict.because}</p>
      </div>

      <div className="rec-cols">
        <section className="rec-col" aria-labelledby={`${id}-reasons`}>
          <h4 id={`${id}-reasons`} className="rec-col-title">
            {pick ? 'Key reasons' : 'Why there is no pick'}
          </h4>
          {pick ? (
            <ul className="rec-list">
              {reference ? (
                gains.length > 0 || same.length > 0 ? (
                  [...gains, ...same].map((f) => <li key={f.metric}>{f.text}</li>)
                ) : (
                  <li>It cleared the quality and reliability bar; see the trade-offs for how it compares.</li>
                )
              ) : (
                <>
                  <li>Quality: {pick.quality === null ? 'not scored' : `${pick.quality.toFixed(1)}/10`}</li>
                  <li>Answered {formatPercent(pick.successRate)} of tasks</li>
                  {pick.latencyP50 !== null && <li>Typical response in {formatMs(pick.latencyP50)}</li>}
                  {pick.costPerSuccess !== null && <li>{formatUnitRupees(pick.costPerSuccess)} per successful task</li>}
                </>
              )}
            </ul>
          ) : verdict.ruledOut.length > 0 ? (
            <ul className="rec-list">
              {verdict.ruledOut.map((r) => (
                <li key={r.name}>
                  <strong>{r.name}:</strong> {r.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rec-text">No model met the bar in this run.</p>
          )}
        </section>

        <section className="rec-col" aria-labelledby={`${id}-trade`}>
          <h4 id={`${id}-trade`} className="rec-col-title">
            Trade-offs
          </h4>
          {!pick ? (
            <p className="rec-text">None to weigh until a model clears the bar.</p>
          ) : !reference ? (
            <p className="rec-text">
              No model to compare against. Mark the model you use today in your next benchmark to see exactly what
              you’d gain or give up.
            </p>
          ) : losses.length > 0 ? (
            <ul className="rec-list rec-list--loss">
              {losses.map((f) => (
                <li key={f.metric}>{f.text}</li>
              ))}
            </ul>
          ) : (
            <p className="rec-text">
              None. {pick.name} is at least as good as {reference.name} ({verdict.referenceLabel}) on every measured
              metric.
            </p>
          )}
        </section>

        <section className="rec-col" aria-labelledby={`${id}-next`}>
          <h4 id={`${id}-next`} className="rec-col-title">
            Suggested next step
          </h4>
          <ul className="rec-list">
            {nextSteps(verdict, models).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </section>
      </div>

      {verdict.cautions.length > 0 && (
        <ul className="cautions">
          {verdict.cautions.map((c) => (
            <li key={c}>
              <Info aria-hidden="true" />
              {c}
            </li>
          ))}
        </ul>
      )}

      <Disclosure
        title="Performance evidence"
        summary={pick ? 'Where each model measured, and the monthly cost' : 'Why each model was ruled out'}
      >
        <div className="fold-body">
          {pick && (
            <>
              <h4 className="rec-col-title">
                {pick.name}
                {reference ? ` against ${reference.name} (${verdict.referenceLabel})` : ' on each measure'}
              </h4>
              <FittingTape
                models={models}
                pick={pick}
                reference={reference}
                referenceLabel={verdict.referenceLabel}
                findings={findings}
              />
            </>
          )}
          {verdict.monthly && pick && (
            <p className="rec-text">
              At {formatCount(verdict.monthly.volume)} requests a month, {pick.name} would cost about{' '}
              <strong>{formatRupees(verdict.monthly.pick)}</strong>
              {verdict.monthly.savings > 0 ? (
                <>
                  , saving {formatRupees(verdict.monthly.savings)} ({verdict.monthly.savingsPct}%) against{' '}
                  {verdict.monthly.against === 'baseline' ? 'the model you use today' : 'the most expensive model tested'}{' '}
                  ({formatRupees(verdict.monthly.reference)}).
                </>
              ) : (
                '.'
              )}{' '}
              <span className="muted">Change the monthly volume on the full results page.</span>
            </p>
          )}
          {pick && verdict.ruledOut.length > 0 && (
            <>
              <h4 className="rec-col-title">Ruled out</h4>
              <ul className="rec-list">
                {verdict.ruledOut.map((r) => (
                  <li key={r.name}>
                    <strong>{r.name}:</strong> {r.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
          {!pick && (
            <p className="rec-text">
              To be recommended, a model needs a quality score of at least {MIN_QUALITY}/10, close to the best score, and
              at least {Math.round(MIN_SUCCESS_RATE * 100)}% of its tasks answered.
            </p>
          )}
        </div>
      </Disclosure>
    </div>
  )
}

/** What to do with this result. Advice only; every claim it rests on is measured above. */
function nextSteps(verdict: Verdict, models: ModelView[]): string[] {
  const pick = verdict.pick
  const baseline = models.find((m) => m.isBaseline)
  switch (verdict.kind) {
    case 'switch':
      return [
        `Try ${pick?.name} on a small share of real traffic, then move over from ${baseline?.name} if it holds up.`,
      ]
    case 'stay':
      return [`Keep ${pick?.name}. Benchmark again when your prompt changes or a new model is worth testing.`]
    case 'best':
      return [
        `Adopt ${pick?.name}.`,
        'Next time, mark the model you use today, so the comparison shows what you’d gain or give up.',
      ]
    default: {
      const steps: string[] = []
      if (models.every((m) => m.quality === null)) {
        steps.push('Run again with answer scoring on, so quality can be measured.')
      }
      if (models.some((m) => m.calls > 0 && m.successRate < MIN_SUCCESS_RATE)) {
        steps.push('Check the failed tasks under Evaluation details; a model that fails too often is ruled out.')
      }
      steps.push('Add more test cases from your real workload. Five or more give steadier scores.')
      steps.push('Include a stronger model in the next benchmark.')
      return steps
    }
  }
}
