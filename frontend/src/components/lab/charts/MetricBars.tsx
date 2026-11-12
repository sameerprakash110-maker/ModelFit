import type { ModelView } from '../../../utils/benchmark.ts'
import { RoleMark } from '../ui.tsx'

export interface BarItem {
  model: ModelView
  value: number | null
  /** Printed at the bar tip. */
  label: string
  /** Optional second marker on the same scale, e.g. the slowest 5% of calls. */
  marker?: { value: number; label: string } | null
}

/**
 * Ranked horizontal bars, one per model, best first. Bars are thin and grow from
 * one baseline; the value is printed at the tip, so nothing needs hovering.
 * Colour shows the model's role (recommended / used today / other), not its rank.
 */
export function MetricBars({
  items,
  better,
  max,
  emptyLabel = 'Not measured',
  markerName,
}: {
  items: BarItem[]
  better: 'higher' | 'lower'
  /** Fixed top of the scale (10 for quality, 1 for rates). Defaults to the largest value. */
  max?: number
  emptyLabel?: string
  /** Name of the optional marker, for its legend line. */
  markerName?: string
}) {
  const measured = items.filter((i) => i.value !== null)
  const top = max ?? Math.max(0, ...measured.map((i) => Math.max(i.value as number, i.marker?.value ?? 0)))
  const sorted = [...items].sort((a, b) => {
    if (a.value === null) return 1
    if (b.value === null) return -1
    return better === 'higher' ? b.value - a.value : a.value - b.value
  })
  const hasMarker = items.some((i) => i.marker)

  return (
    <div className="bars">
      <ol className="bars-list">
        {sorted.map((item) => {
          const pct = item.value === null || top <= 0 ? 0 : (item.value / top) * 100
          const markerPct = item.marker && top > 0 ? (item.marker.value / top) * 100 : null
          return (
            <li key={item.model.name} className="bar-row">
              <span className="bar-name" title={item.model.name}>
                <RoleMark role={item.model.role} isBaseline={item.model.isBaseline} />
                <span>{item.model.name}</span>
              </span>
              {item.value === null ? (
                <span className="bar-empty">{emptyLabel}</span>
              ) : (
                <span className="bar-track">
                  {/* Bars scale to the track minus room reserved for the printed value. */}
                  <span
                    className={`bar-fill bar-fill--${item.model.role}`}
                    style={{ width: `calc((100% - var(--bar-label-space)) * ${Math.max(pct, 0.6) / 100})` }}
                  />
                  {markerPct !== null && (
                    <span
                      className="bar-marker"
                      style={{ left: `calc((100% - var(--bar-label-space)) * ${Math.min(markerPct, 100) / 100})` }}
                    />
                  )}
                  {/* When the marker sits past the bar's end, push the value beyond the marker. */}
                  {markerPct !== null && markerPct > pct && (
                    <span
                      aria-hidden="true"
                      style={{ width: `calc((100% - var(--bar-label-space)) * ${(Math.min(markerPct, 100) - Math.max(pct, 0.6)) / 100})`, flex: 'none' }}
                    />
                  )}
                  <span className="bar-value">
                    {item.label}
                    {item.marker && <span className="bar-value-sub"> {item.marker.label}</span>}
                  </span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {hasMarker && markerName && (
        <p className="bars-key">
          <span className="bar-marker-key" aria-hidden="true" /> {markerName}
        </p>
      )}
    </div>
  )
}
