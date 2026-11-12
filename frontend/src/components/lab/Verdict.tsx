import { Info } from 'lucide-react'
import type { ModelView, Verdict } from '../../utils/benchmark.ts'
import { MIN_QUALITY, MIN_SUCCESS_RATE } from '../../utils/benchmark.ts'
import { formatCount, formatRupees } from '../../utils/format.ts'
import { FittingTape } from './charts/FittingTape.tsx'
import { SimulatedTag } from './ui.tsx'

/**
 * The answer to "which model should I use?": a verdict word, one sentence on what
 * to do, why, the monthly money, and the evidence on the fitting tape.
 */
export function VerdictPanel({ verdict, models, isMock }: { verdict: Verdict; models: ModelView[]; isMock: boolean }) {
  const { pick, reference, findings, monthly } = verdict
  const losses = findings.filter((f) => f.direction === 'loss')
  const gains = findings.filter((f) => f.direction === 'gain')
  const fallback = models.find((m) => m.isFallback && m !== pick) ?? null

  return (
    <section className={`verdict verdict--${verdict.kind}`} aria-labelledby="verdict-word">
      <div className="verdict-top">
        <div className="verdict-say">
          <p className="verdict-kicker">
            Verdict{isMock && <SimulatedTag />}
          </p>
          <h2 id="verdict-word" className="verdict-word">
            {verdict.word}
          </h2>
          <p className="verdict-headline">{verdict.headline}</p>
          <p className="verdict-because">{verdict.because}</p>
        </div>

        {monthly && pick && (
          <div className="verdict-money">
            <p className="money-label">At {formatCount(monthly.volume)} requests a month</p>
            <p className="money-figure">{formatRupees(monthly.pick)}</p>
            <p className="money-sub">a month with {pick.name}</p>
            {monthly.savings > 0 ? (
              <p className="money-save">
                Saves <strong>{formatRupees(monthly.savings)}</strong> ({monthly.savingsPct}%) against{' '}
                {monthly.against === 'baseline' ? 'the model you use today' : 'the most expensive model tested'} (
                {formatRupees(monthly.reference)}).
              </p>
            ) : verdict.kind === 'switch' ? (
              <p className="money-save">
                No saving: it costs about the same or more than the model you use today ({formatRupees(monthly.reference)}
                ). The case for switching is the evidence below, not price.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {pick && (
        <div className="verdict-evidence">
          <h3 className="verdict-sub">
            The evidence{reference ? `: ${pick.name} against ${reference.name}` : ''}
          </h3>
          <FittingTape
            models={models}
            pick={pick}
            reference={reference}
            referenceLabel={verdict.referenceLabel}
            findings={findings}
          />
          {reference && (
            <p className={`tradeoff${losses.length ? ' has-loss' : ''}`}>
              {losses.length > 0 ? (
                <>
                  <strong>The trade-off:</strong> {losses.map((l) => l.text.toLowerCase()).join('; ')}.
                  {gains.length > 0 && <> In return: {gains.map((g) => g.text.toLowerCase()).join('; ')}.</>}
                </>
              ) : gains.length > 0 ? (
                <>
                  <strong>No trade-off:</strong> {pick.name} is at least as good as {reference.name} on every measured
                  metric.
                </>
              ) : (
                <>
                  <strong>Close call:</strong> {pick.name} and {reference.name} measured about the same on everything.
                </>
              )}
            </p>
          )}
          {fallback && fallback !== reference && (
            <p className="verdict-fallback">
              Backup choice if {pick.name} is unavailable: <strong>{fallback.name}</strong>.
            </p>
          )}
        </div>
      )}

      {verdict.kind === 'inconclusive' && (
        <div className="verdict-evidence">
          {verdict.ruledOut.length > 0 && (
            <>
              <h3 className="verdict-sub">Why each model was ruled out</h3>
              <ul className="ruled-out">
                {verdict.ruledOut.map((r) => (
                  <li key={r.name}>
                    <strong>{r.name}</strong>
                    <span>{r.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className="verdict-sub">How to get a verdict</h3>
          <ul className="next-steps">
            {models.every((m) => m.quality === null) && (
              <li>
                <strong>Turn scoring on.</strong> No answer was scored, so no model can be recommended. Use Run again and
                leave “Score answers with a judge model” on (under More options).
              </li>
            )}
            {models.some((m) => m.calls > 0 && m.successRate < MIN_SUCCESS_RATE) && (
              <li>
                <strong>Check the failed calls.</strong> Models that failed more than{' '}
                {Math.round((1 - MIN_SUCCESS_RATE) * 100)}% of calls are ruled out; the answers section shows why.
              </li>
            )}
            <li>Add more test cases from your real workload. Five or more gives steadier scores.</li>
            <li>Increase runs per test case, so one bad answer counts for less.</li>
            <li>
              Include a stronger model. A model must score at least {MIN_QUALITY}/10 and answer at least{' '}
              {Math.round(MIN_SUCCESS_RATE * 100)}% of calls to be recommended.
            </li>
          </ul>
        </div>
      )}

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
    </section>
  )
}
