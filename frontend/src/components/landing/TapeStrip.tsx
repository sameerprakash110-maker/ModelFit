import type { CSSProperties } from 'react'

interface TapeStripProps {
  /** How many units the strip covers. */
  units: number
  /** Pixels per unit. Keep it a whole number so the ticks stay crisp. */
  ppu: number
  /** Value printed at the left end. Must be a multiple of 10. */
  start?: number
}

/** A length of measuring tape: a tick per unit, a number every ten. */
export function TapeStrip({ units, ppu, start = 0 }: TapeStripProps) {
  const numbers: number[] = []
  for (let value = start; value <= start + units; value += 10) numbers.push(value)

  return (
    <div className="tape" style={{ width: units * ppu + 2, '--ppu': `${ppu}px` } as CSSProperties}>
      {numbers.map((value) => (
        <span key={value} className="tape-num" style={{ left: (value - start) * ppu }}>
          {value}
        </span>
      ))}
    </div>
  )
}
