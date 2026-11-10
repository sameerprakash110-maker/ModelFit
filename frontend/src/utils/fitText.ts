/*
  Fits lines of text to one shared width by solving the variable font's
  width axis for each line, instead of scaling or letter-spacing the type.
  Every line keeps the same font size and ends on the same measure.
*/

export interface FitOptions {
  family: string
  weight: number
  letterSpacingEm?: number
  minWdth?: number
  maxWdth?: number
  /** Upper limit on the font size in px. */
  maxSize?: number
}

export interface FitResult {
  /** Font size in px shared by all lines. */
  size: number
  /** Width in px every line is fitted to. */
  width: number
  /** Width-axis value per line. */
  wdths: number[]
}

const REFERENCE_SIZE = 100
let probe: HTMLSpanElement | null = null

function getProbe(options: FitOptions): HTMLSpanElement {
  if (!probe) {
    probe = document.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    Object.assign(probe.style, {
      position: 'absolute',
      left: '-99999px',
      top: '0',
      visibility: 'hidden',
      whiteSpace: 'nowrap',
      lineHeight: '1',
      fontSize: `${REFERENCE_SIZE}px`,
    })
    document.body.appendChild(probe)
  }
  probe.style.fontFamily = options.family
  probe.style.fontWeight = String(options.weight)
  probe.style.letterSpacing = `${options.letterSpacingEm ?? 0}em`
  return probe
}

function measure(el: HTMLSpanElement, text: string, wdth: number): number {
  el.style.fontVariationSettings = `"wdth" ${wdth}`
  el.textContent = text
  return el.getBoundingClientRect().width
}

export function fitLines(texts: string[], target: number, options: FitOptions): FitResult {
  const min = options.minWdth ?? 50
  const max = options.maxWdth ?? 150
  const el = getProbe(options)

  const narrowest = texts.map((t) => measure(el, t, min))
  const widest = texts.map((t) => measure(el, t, max))
  const longestSqueezed = Math.max(...narrowest)
  const shortestStretched = Math.min(...widest)

  // Font sizes between these two bounds let every line reach the target.
  const smallest = (target * REFERENCE_SIZE) / shortestStretched
  const largest = (target * REFERENCE_SIZE) / longestSqueezed
  let size = smallest <= largest ? Math.sqrt(smallest * largest) : largest
  if (options.maxSize) size = Math.min(size, options.maxSize)

  // When the size is capped, fit to the widest measure the shortest line can still reach.
  const width = Math.min(target, (shortestStretched * size) / REFERENCE_SIZE)
  const goal = (width * REFERENCE_SIZE) / size

  const wdths = texts.map((text) => {
    let lo = min
    let hi = max
    for (let i = 0; i < 14; i += 1) {
      const mid = (lo + hi) / 2
      if (measure(el, text, mid) < goal) lo = mid
      else hi = mid
    }
    return Math.round(((lo + hi) / 2) * 10) / 10
  })

  return { size, width, wdths }
}
