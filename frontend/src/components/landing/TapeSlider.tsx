import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { TapeStrip } from './TapeStrip.tsx'

const PPU = 14

interface TapeSliderProps {
  /** Id of the element that labels this control. */
  labelledBy: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  valueText: (value: number) => string
  /** A flag pinned to the tape at a value, for example a break-even point. */
  marker?: { value: number; label: string } | null
}

/**
 * A slider you operate by pulling a measuring tape under a fixed needle.
 * Drag with a pointer, or use the arrow, Page and Home/End keys.
 */
export function TapeSlider({ labelledBy, value, min, max, onChange, valueText, marker }: TapeSliderProps) {
  const drag = useRef<{ x: number; value: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  // The printed scale starts on a multiple of ten so the numbering lines up.
  const scaleStart = Math.floor(min / 10) * 10
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)))

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, value }
    setDragging(true)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    // Pulling the tape to the left brings higher numbers under the needle.
    const next = clamp(drag.current.value - (event.clientX - drag.current.x) / PPU)
    if (next !== value) onChange(next)
  }

  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 10,
      PageDown: -10,
    }
    let next: number | null = null
    if (event.key in steps) next = clamp(value + steps[event.key])
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    if (next === null) return
    event.preventDefault()
    if (next !== value) onChange(next)
  }

  const markerInRange = marker && marker.value >= scaleStart && marker.value <= max

  return (
    <div
      className={`tape-slider${dragging ? ' is-dragging' : ''}`}
      role="slider"
      tabIndex={0}
      aria-labelledby={labelledBy}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText(value)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <div
        className="tape-slider-strip"
        style={{ transform: `translate3d(${-(value - scaleStart) * PPU}px, 0, 0)` }}
      >
        <TapeStrip units={max - scaleStart} ppu={PPU} start={scaleStart} />
        {markerInRange && (
          <span className="tape-marker" style={{ left: (marker.value - scaleStart) * PPU }} aria-hidden="true">
            <span>{marker.label}</span>
          </span>
        )}
      </div>
      <span className="tape-needle" aria-hidden="true" />
    </div>
  )
}
