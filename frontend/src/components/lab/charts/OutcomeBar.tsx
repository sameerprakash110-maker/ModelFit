import { formatCount } from '../../../utils/format.ts'

/**
 * How every call in a run ended, as one whole split into parts: answered and scored,
 * answered but not scored, failed. A thin segmented bar with the counts written beside it.
 */
export function OutcomeBar({ scored, unscored, failed }: { scored: number; unscored: number; failed: number }) {
  const total = scored + unscored + failed
  if (total === 0) return null
  const parts = [
    { key: 'scored', label: 'Answered and scored', value: scored },
    { key: 'unscored', label: 'Answered, not scored', value: unscored },
    { key: 'failed', label: 'Failed', value: failed },
  ].filter((p) => p.value > 0)

  return (
    <div className="outcome">
      <div
        className="outcome-bar"
        role="img"
        aria-label={parts.map((p) => `${p.label}: ${p.value} of ${total}`).join('. ')}
      >
        {parts.map((p) => (
          <span key={p.key} className={`outcome-seg outcome-seg--${p.key}`} style={{ flexGrow: p.value }} />
        ))}
      </div>
      <ul className="outcome-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className={`outcome-key outcome-seg--${p.key}`} aria-hidden="true" />
            <strong>{formatCount(p.value)}</strong> {p.label.toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  )
}
