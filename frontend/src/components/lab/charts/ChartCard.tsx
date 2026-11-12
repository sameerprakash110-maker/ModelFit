import type { ReactNode } from 'react'
import type { Role } from '../../../utils/benchmark.ts'
import { RoleLegend } from '../ui.tsx'

/**
 * Frame for every chart: a title, what it shows and in which unit, a legend,
 * the chart, and the takeaway in words, so nobody has to read a chart alone.
 */
export function ChartCard({
  id,
  title,
  description,
  roles,
  takeaway,
  note,
  children,
  className = '',
}: {
  id: string
  title: string
  description: ReactNode
  roles?: Role[]
  takeaway: ReactNode
  note?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <figure className={`chart ${className}`} aria-labelledby={`${id}-title`}>
      <div className="chart-head">
        <h3 id={`${id}-title`} className="chart-title">
          {title}
        </h3>
        <p className="chart-desc">{description}</p>
        {roles && <RoleLegend roles={roles} />}
      </div>
      <div className="chart-body">{children}</div>
      <figcaption className="chart-takeaway">{takeaway}</figcaption>
      {note && <p className="chart-note">{note}</p>}
    </figure>
  )
}
