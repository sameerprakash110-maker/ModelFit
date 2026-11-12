import { useEffect, useState } from 'react'
import type { Finding, MetricKey, ModelView } from '../../../utils/benchmark.ts'
import { formatMs, formatPercent, formatUnitRupees } from '../../../utils/format.ts'

const METRICS: {
  key: MetricKey
  label: string
  help: string
  value: (m: ModelView) => number | null
  better: 'higher' | 'lower'
  format: (v: number) => string
}[] = [
  { key: 'quality', label: 'Quality', help: 'judge score, 0–10', value: (m) => m.quality, better: 'higher', format: (v) => `${v.toFixed(1)}/10` },
  { key: 'cost', label: 'Cost', help: 'per successful answer', value: (m) => m.costPerSuccess, better: 'lower', format: formatUnitRupees },
  { key: 'speed', label: 'Speed', help: 'typical response time', value: (m) => m.latencyP50, better: 'lower', format: formatMs },
  { key: 'reliability', label: 'Reliability', help: 'calls answered', value: (m) => (m.calls > 0 ? m.successRate : null), better: 'higher', format: (v) => formatPercent(v) },
]

/**
 * The evidence behind a verdict, drawn as a row of measuring tapes, one per metric.
 * Every tape runs worse → better left to right, so "further right" always means
 * "better" whatever the unit. All models sit on each tape: the recommendation is
 * the filled dot, the model used today the ring, the rest small grey ticks.
 */
export function FittingTape({
  models,
  pick,
  reference,
  referenceLabel,
  findings,
}: {
  models: ModelView[]
  pick: ModelView
  reference: ModelView | null
  referenceLabel: string | null
  findings: Finding[]
}) {
  // One orchestrated moment: markers slide from the middle of the tape to where they measured.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="tapes">
      <p className="tapes-how">
        Each tape runs from the worst model tested on the left to the best on the right, whatever the unit.
      </p>
      <div className="tapes-key" aria-hidden="true">
        <span>
          <span className="tape-dot tape-dot--pick" /> {pick.name}
        </span>
        {reference && (
          <span>
            <span className="tape-dot tape-dot--ref" /> {reference.name} ({referenceLabel})
          </span>
        )}
        {models.length > (reference ? 2 : 1) && (
          <span>
            <span className="tape-tick-key" /> other models
          </span>
        )}
      </div>
      <ul className="tapes-list">
        {METRICS.map((metric) => {
          const values = models.map((m) => metric.value(m)).filter((v): v is number => v !== null)
          const pickValue = metric.value(pick)
          if (pickValue === null || values.length === 0) {
            return (
              <li key={metric.key} className="tape-row">
                <div className="tape-text">
                  <p className="tape-label">
                    {metric.label} <span className="tape-help">{metric.help}</span>
                  </p>
                  <p className="tape-finding">Not measured for {pick.name}.</p>
                </div>
              </li>
            )
          }
          const lo = Math.min(...values)
          const hi = Math.max(...values)
          const position = (v: number) => {
            if (hi === lo) return 50
            const t = metric.better === 'higher' ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)
            return 6 + t * 88
          }
          const at = (v: number) => (settled ? position(v) : 50)
          const refValue = reference ? metric.value(reference) : null
          const finding = findings.find((f) => f.metric === metric.key)
          const others = models.filter((m) => m !== pick && m !== reference && metric.value(m) !== null)

          return (
            <li key={metric.key} className="tape-row">
              <div className="tape-text">
                <p className="tape-label">
                  {metric.label} <span className="tape-help">{metric.help}</span>
                </p>
                <p className={`tape-finding${finding ? ` is-${finding.direction}` : ''}`}>
                  {finding
                    ? finding.text
                    : hi === lo
                      ? `All models measured the same: ${metric.format(pickValue)}.`
                      : `${metric.format(pickValue)}`}
                </p>
              </div>
              <div
                className="fit-scale"
                role="img"
                aria-label={`${metric.label}: ${pick.name} ${metric.format(pickValue)}${
                  reference && refValue !== null ? `, ${reference.name} ${metric.format(refValue)}` : ''
                }. Range across models ${metric.format(metric.better === 'higher' ? lo : hi)} (worst) to ${metric.format(
                  metric.better === 'higher' ? hi : lo,
                )} (best).`}
              >
                <span className="tape-strip" aria-hidden="true" />
                {others.map((m) => (
                  <span
                    key={m.name}
                    className="tape-other"
                    style={{ left: `${at(metric.value(m) as number)}%` }}
                    aria-hidden="true"
                  />
                ))}
                {reference && refValue !== null && (
                  <span className="tape-mark tape-mark--ref" style={{ left: `${at(refValue)}%` }} aria-hidden="true">
                    <span className="tape-dot tape-dot--ref" />
                    <span className="tape-val tape-val--below">{metric.format(refValue)}</span>
                  </span>
                )}
                <span className="tape-mark tape-mark--pick" style={{ left: `${at(pickValue)}%` }} aria-hidden="true">
                  <span className="tape-val tape-val--above">{metric.format(pickValue)}</span>
                  <span className="tape-dot tape-dot--pick" />
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
