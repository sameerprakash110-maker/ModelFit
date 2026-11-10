/*
  Sewing-pattern pieces, drawn the way they are printed on pattern paper:
  a cut line, a dashed seam line inside it, and a grainline arrow.
*/

interface Shape {
  outline: string
  /** Grainline as x1 y1 x2 y2. */
  grain: [number, number, number, number]
  /** Where the step number sits. */
  number: [number, number]
}

const SHAPES: Record<string, Shape> = {
  bodice: {
    outline:
      'M58 16 C76 36 124 36 142 16 L186 42 L166 82 C154 86 152 100 160 114 L160 186 L40 186 L40 114 C48 100 46 86 34 82 L14 42 Z',
    grain: [128, 70, 128, 160],
    number: [84, 138],
  },
  sleeve: {
    outline: 'M14 92 C46 6 154 6 186 92 L160 186 L40 186 Z',
    grain: [136, 70, 136, 160],
    number: [88, 140],
  },
  skirt: {
    outline: 'M66 16 L134 16 L184 170 C132 192 68 192 16 170 Z',
    grain: [130, 60, 130, 150],
    number: [88, 140],
  },
  yoke: {
    outline: 'M16 58 C70 34 130 34 184 58 L172 156 C122 138 78 138 28 156 Z',
    grain: [142, 66, 142, 126],
    number: [84, 116],
  },
  pocket: {
    outline: 'M36 22 L164 22 L164 126 L100 182 L36 126 Z',
    grain: [136, 44, 136, 116],
    number: [84, 118],
  },
}

export type PatternShape = keyof typeof SHAPES

interface PatternPieceProps {
  shape: PatternShape
  step: number
  className?: string
}

export function PatternPiece({ shape, step, className = '' }: PatternPieceProps) {
  const { outline, grain, number } = SHAPES[shape]
  const [x1, y1, x2, y2] = grain
  const vertical = x1 === x2
  const arrowheads = vertical
    ? `M${x1 - 5} ${y1 + 8} L${x1} ${y1} L${x1 + 5} ${y1 + 8} M${x2 - 5} ${y2 - 8} L${x2} ${y2} L${x2 + 5} ${y2 - 8}`
    : `M${x1 + 8} ${y1 - 5} L${x1} ${y1} L${x1 + 8} ${y1 + 5} M${x2 - 8} ${y2 - 5} L${x2} ${y2} L${x2 - 8} ${y2 + 5}`

  return (
    <svg className={`pattern-piece ${className}`} viewBox="0 0 200 200" aria-hidden="true">
      <path className="pattern-cut" d={outline} />
      <path className="pattern-seam" d={outline} />
      <path className="pattern-grain" d={`M${x1} ${y1} L${x2} ${y2} ${arrowheads}`} />
      <text className="pattern-number" x={number[0]} y={number[1]} textAnchor="middle">
        {step}
      </text>
    </svg>
  )
}
