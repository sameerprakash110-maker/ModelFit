import { useMemo, useState } from 'react'
import type { ModelView } from '../../../utils/benchmark.ts'
import { formatMs, formatPercent, formatUnitRupees } from '../../../utils/format.ts'
import { useWidth } from '../../../hooks/useWidth.ts'

const HEIGHT = 340
const PAD = { top: 28, right: 24, bottom: 52, left: 52 }
const CHAR_W = 6.6 // approx. width of one label character at 12px

type Point = { model: ModelView; x: number; y: number; cost: number; quality: number }

/** Nice tick values for a rupee axis, linear or log. */
function costTicks(min: number, max: number, log: boolean): number[] {
  if (log) {
    const ticks: number[] = []
    for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) ticks.push(10 ** e)
    return ticks
  }
  const span = max - min || max || 1
  const step = 10 ** Math.floor(Math.log10(span / 4))
  const nice = [1, 2, 5, 10].map((m) => m * step).find((s) => span / s <= 5) ?? step * 10
  const ticks: number[] = []
  for (let t = Math.floor(min / nice) * nice; t <= max + nice * 0.001; t += nice) ticks.push(Number(t.toPrecision(6)))
  return ticks
}

/**
 * Quality against cost per successful answer, one dot per model, each labelled by name.
 * Top-left is the place to be: high quality for little money.
 */
export function QualityCostMap({ models }: { models: ModelView[] }) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<string | null>(null)

  const points = useMemo(
    () =>
      models.filter((m) => m.quality !== null && m.costPerSuccess !== null && m.costPerSuccess > 0) as (ModelView & {
        quality: number
        costPerSuccess: number
      })[],
    [models],
  )

  if (points.length === 0) return null

  const costs = points.map((p) => p.costPerSuccess)
  const minCost = Math.min(...costs)
  const maxCost = Math.max(...costs)
  const log = maxCost / minCost > 10
  const xTicks = log
    ? costTicks(minCost, maxCost, true)
    : costTicks(Math.max(0, minCost - (maxCost - minCost) * 0.15), maxCost * 1.08, false)
  const xMin = log ? xTicks[0] : Math.min(xTicks[0], 0)
  const xMax = xTicks[xTicks.length - 1] === xMin ? xMin * 10 || 1 : xTicks[xTicks.length - 1]

  const qualities = points.map((p) => p.quality)
  const yMin = Math.max(0, Math.floor(Math.min(...qualities) - 1))
  const yMax = 10
  const yTicks = Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i).filter(
    (t, _, all) => all.length <= 6 || t % 2 === 0,
  )

  const plotW = Math.max(120, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const sx = (v: number) =>
    PAD.left +
    (log ? (Math.log10(v) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin)) : (v - xMin) / (xMax - xMin)) * plotW
  const sy = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH

  const placed: Point[] = points.map((m) => ({
    model: m,
    x: sx(m.costPerSuccess),
    y: sy(m.quality),
    cost: m.costPerSuccess,
    quality: m.quality,
  }))

  // Label placement: try right, left, above, below; take the first spot that collides with nothing.
  const boxes: { x: number; y: number; w: number; h: number }[] = placed.map((p) => ({ x: p.x - 7, y: p.y - 7, w: 14, h: 14 }))
  const overlaps = (b: { x: number; y: number; w: number; h: number }) =>
    boxes.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y)
  const labels = [...placed]
    .sort((a, b) => Number(b.model.role !== 'other') - Number(a.model.role !== 'other'))
    .map((p) => {
      const w = p.model.name.length * CHAR_W
      const h = 14
      const options = [
        { x: p.x + 11, y: p.y - h / 2, anchor: 'start' as const },
        { x: p.x - 11 - w, y: p.y - h / 2, anchor: 'start' as const },
        { x: p.x - w / 2, y: p.y - 12 - h, anchor: 'start' as const },
        { x: p.x - w / 2, y: p.y + 12, anchor: 'start' as const },
      ].map((o) => ({ ...o, x: Math.min(Math.max(o.x, PAD.left + 2), PAD.left + plotW - w) }))
      const spot = options.find((o) => !overlaps({ x: o.x, y: o.y, w, h })) ?? null
      if (spot) boxes.push({ x: spot.x, y: spot.y, w, h })
      return { name: p.model.name, spot }
    })
  const labelFor = new Map(labels.map((l) => [l.name, l.spot]))

  const activePoint = placed.find((p) => p.model.name === active) ?? null

  return (
    <div ref={ref} className="map" onPointerLeave={() => setActive(null)}>
      <svg
        width={width}
        height={HEIGHT}
        role="group"
        aria-label="Quality against cost per successful answer, one point per model"
        className="map-svg"
      >
        {/* Grid and axes: hairlines, recessive. */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={PAD.left - 10} y={sy(t)} dy="0.35em" textAnchor="end" className="tick">
              {t}
            </text>
          </g>
        ))}
        {thin(xTicks.filter((t) => t >= xMin && t <= xMax), sx, 64)
          .map((t) => (
            <g key={`x${t}`}>
              <line x1={sx(t)} x2={sx(t)} y1={PAD.top} y2={PAD.top + plotH} className="grid" />
              <text x={sx(t)} y={PAD.top + plotH + 18} textAnchor="middle" className="tick">
                {t === 0 ? '₹0' : formatUnitRupees(t)}
              </text>
            </g>
          ))}
        <line x1={PAD.left} x2={PAD.left + plotW} y1={PAD.top + plotH} y2={PAD.top + plotH} className="axis" />
        <text x={PAD.left + plotW / 2} y={HEIGHT - 8} textAnchor="middle" className="axis-title">
          Cost per successful answer{log ? ' (log scale)' : ''}
        </text>
        <text
          transform={`translate(14 ${PAD.top + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
          className="axis-title"
        >
          Quality (0–10)
        </text>
        <text x={PAD.left + 8} y={PAD.top - 10} className="map-hint">
          Better: higher quality, lower cost ↖
        </text>

        {/* Points: grey context first, then used today, then the recommendation on top. */}
        {[...placed]
          .sort((a, b) => rank(a.model) - rank(b.model))
          .map((p) => {
            const spot = labelFor.get(p.model.name)
            const description = `${p.model.name}: quality ${p.quality.toFixed(1)} out of 10, ${formatUnitRupees(
              p.cost,
            )} per successful answer`
            return (
              <g
                key={p.model.name}
                className={`pt pt--${p.model.role}${p.model.isBaseline ? ' pt--baseline' : ''}${
                  active === p.model.name ? ' is-active' : ''
                }`}
                tabIndex={0}
                role="img"
                aria-label={description}
                onPointerEnter={() => setActive(p.model.name)}
                onFocus={() => setActive(p.model.name)}
                onBlur={() => setActive(null)}
              >
                <circle cx={p.x} cy={p.y} r={14} className="pt-hit" />
                <circle cx={p.x} cy={p.y} r={p.model.role === 'other' ? 5 : 7} className="pt-dot" />
                {spot && (
                  <text x={spot.x} y={spot.y + 11} className={`pt-label${p.model.role !== 'other' ? ' is-strong' : ''}`}>
                    {p.model.name}
                  </text>
                )}
              </g>
            )
          })}
      </svg>

      {activePoint && (
        <div
          className="tip"
          role="presentation"
          style={{
            left: Math.min(activePoint.x + 14, width - 220),
            top: Math.max(activePoint.y - 20, 0),
          }}
        >
          <p className="tip-title">{activePoint.model.name}</p>
          <p>
            <strong>{activePoint.quality.toFixed(1)}</strong>/10 quality
          </p>
          <p>
            <strong>{formatUnitRupees(activePoint.cost)}</strong> per successful answer
          </p>
          {activePoint.model.latencyP50 !== null && (
            <p>
              <strong>{formatMs(activePoint.model.latencyP50)}</strong> typical response
            </p>
          )}
          <p>
            <strong>{formatPercent(activePoint.model.successRate)}</strong> of calls answered
          </p>
        </div>
      )}
    </div>
  )
}

/** Drop ticks until neighbouring labels are at least `gap` pixels apart. */
function thin(ticks: number[], scale: (v: number) => number, gap: number): number[] {
  for (let step = 1; step <= ticks.length; step++) {
    const kept = ticks.filter((_, i) => i % step === 0)
    if (kept.every((t, i) => i === 0 || scale(t) - scale(kept[i - 1]) >= gap)) return kept
  }
  return ticks.slice(0, 1)
}

function rank(m: ModelView) {
  return m.role === 'recommended' ? 2 : m.isBaseline ? 1 : 0
}
