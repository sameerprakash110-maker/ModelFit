import type { CSSProperties } from 'react'
import type { Estimate } from '../../utils/trapMath.ts'
import { formatPercent, formatUnitRupees } from '../../utils/format.ts'

interface HangTagProps {
  name: string
  variant: 'current' | 'candidate'
  /** Rupees per 1,000 attempts, as advertised. */
  stickerPer1k: number | null
  estimate: Estimate | null
  maxAttempts: number | null
  /** Short stamp across the tag, such as "Costs more per result". */
  stamp?: { text: string; tone: 'bad' | 'warn' | 'good' } | null
  /** Resting tilt in degrees, so the tags don't hang like a spreadsheet. */
  tilt: number
}

/** A price tag on the rack: the advertised price, and what a successful task really comes to. */
export function HangTag({ name, variant, stickerPer1k, estimate, maxAttempts, stamp, tilt }: HangTagProps) {
  const finishing = estimate ? estimate.eventualSuccess : null

  return (
    <div className="hang" style={{ '--rest': `${tilt}deg` } as CSSProperties}>
      <div className={`tag tag--${variant}`}>
        <span className="tag-hole" aria-hidden="true" />
        <div className="tag-face">
          <h3 className="tag-name">{name}</h3>
          {stamp && <p className={`tag-stamp tag-stamp--${stamp.tone}`}>{stamp.text}</p>}

          <dl className="tag-rows">
            <div>
              <dt>Price list</dt>
              <dd className="tag-sticker">
                <s>{stickerPer1k === null ? '—' : formatUnitRupees(stickerPer1k / 1000)}</s>
                <span className="tag-unit">per attempt</span>
              </dd>
            </div>
            <div>
              <dt>Cost per successful task</dt>
              <dd className="tag-real">
                {estimate && estimate.costPerSuccess !== null ? formatUnitRupees(estimate.costPerSuccess) : '—'}
              </dd>
            </div>
          </dl>

          {finishing !== null && maxAttempts !== null && (
            <div className="tag-finish">
              <div className="tag-finish-bar" aria-hidden="true">
                <span style={{ width: `${finishing * 100}%` }} />
              </div>
              <p>
                {formatPercent(finishing, finishing > 0.999 && finishing < 1 ? 2 : 1)} of tasks succeed within{' '}
                {maxAttempts} {maxAttempts === 1 ? 'attempt' : 'attempts'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
