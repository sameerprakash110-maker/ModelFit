import { Check, X } from 'lucide-react'
import type { ModelView } from '../../utils/benchmark.ts'
import { formatCount, formatMs, formatPercent, formatUnitRupees } from '../../utils/format.ts'
import { ModelName } from './ui.tsx'

/** Every measured number for every model in one place. Also the table view of each chart above it. */
export function ComparisonTable({ models, isMock }: { models: ModelView[]; isMock: boolean }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="All numbers by model (scrolls sideways)">
      <table className="table compare-table">
        <caption className="visually-hidden">Every metric for every model in this benchmark</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col" className="numcol">
              Quality
              <span className="th-unit">avg score /10{isMock ? ', placeholder' : ''}</span>
            </th>
            <th scope="col" className="numcol">
              Answered
              <span className="th-unit">of all calls</span>
            </th>
            <th scope="col" className="numcol">
              Typical speed
              <span className="th-unit">median</span>
            </th>
            <th scope="col" className="numcol">
              Slowest 5%
              <span className="th-unit">p95</span>
            </th>
            <th scope="col" className="numcol">
              Cost per answer
              <span className="th-unit">₹, successful</span>
            </th>
            <th scope="col" className="numcol">
              Tokens per call
              <span className="th-unit">in / out</span>
            </th>
            <th scope="col">Can be recommended?</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.name} className={m.role === 'recommended' ? 'is-pick' : undefined}>
              <th scope="row">
                <ModelName name={m.name} role={m.role} isBaseline={m.isBaseline} provider={m.provider} />
              </th>
              <td className="numcol">
                {m.quality === null ? (
                  <span className="muted">Not scored</span>
                ) : (
                  <>
                    {m.quality.toFixed(1)}
                    {m.qualityMin !== null && m.qualityMax !== null && m.qualityMax - m.qualityMin >= 0.1 && (
                      <span className="cell-sub">
                        range {m.qualityMin.toFixed(1)}–{m.qualityMax.toFixed(1)}
                      </span>
                    )}
                  </>
                )}
              </td>
              <td className="numcol">
                {m.calls === 0 ? (
                  '—'
                ) : (
                  <>
                    {formatPercent(m.successRate)}
                    <span className="cell-sub">
                      {formatCount(m.successes)} of {formatCount(m.calls)}
                    </span>
                  </>
                )}
              </td>
              <td className="numcol">{m.latencyP50 === null ? '—' : formatMs(m.latencyP50)}</td>
              <td className="numcol">{m.latencyP95 === null ? '—' : formatMs(m.latencyP95)}</td>
              <td className="numcol">{m.costPerSuccess === null ? '—' : formatUnitRupees(m.costPerSuccess)}</td>
              <td className="numcol">
                {formatCount(m.avgInputTokens)} / {formatCount(m.avgOutputTokens)}
              </td>
              <td className="eligibility">
                {m.eligible ? (
                  <span className="yes">
                    <Check aria-hidden="true" /> Yes
                  </span>
                ) : (
                  <span className="no">
                    <X aria-hidden="true" /> {m.ineligibleReason ?? 'No'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
