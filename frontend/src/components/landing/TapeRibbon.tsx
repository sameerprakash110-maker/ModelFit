import { useEffect, useId, useRef } from 'react'
import type { RefObject } from 'react'

/*
  The hero's measuring tape. A ribbon of tailor's tape unrolls across the page,
  curls into a loop in the open space beside the headline, sways toward the
  pointer like loose fabric, and feeds along its own length as you scroll.

  One path drives everything: the tape, the tick marks (dashed strokes the full
  width of the tape, partly covered so they only show at the edges) and the
  numbers (text set along the path). Decoration only: hidden from assistive
  technology, and still when reduced motion is on.
*/

const MINOR = 8 // px between small ticks (a millimetre)
const MAJOR = 40 // px between long ticks
const LABEL = 80 // px between numbers (a centimetre)

interface Geometry {
  w: number
  h: number
  /** Tape width. */
  t: number
  /** Vertical centre of the band the tape runs along. */
  by: number
  /** Right edge of the headline text. */
  rx: number
}

interface Sway {
  x: number
  y: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The tape's centre line for the current layout and sway. */
function tapePath({ w, t, by, rx }: Geometry, sway: Sway, breath: number): string {
  const free = w - rx
  // Loop scale: as big as the space beside the headline allows. The loop rises about 1.95 × d above the
  // band (its raised base included), and needs room for half the tape's width plus the sway on top of that.
  const d = Math.min(free * 0.42, (by - t * 1.15 - 14) / 1.95, 118)
  const start = `M ${-4 * t} ${by + t * 0.25}`
  const wy = by + breath

  if (d < 46) {
    // No room for a loop (narrow screens): a soft double wave across the band.
    return [
      start,
      `C ${w * 0.18} ${wy - t * 1.3 + sway.y * 0.5}, ${w * 0.32} ${wy + t * 1.1}, ${w * 0.5 + sway.x * 0.4} ${wy}`,
      `S ${w * 0.82} ${wy + t * 1.2 + sway.y * 0.5}, ${w + 4 * t} ${wy - t * 0.4}`,
    ].join(' ')
  }

  // The loop sits centred in the free space; A and B are where the tape enters and leaves it.
  const ax = rx + (free - 1.7 * d) / 2 + 0.35 * d + sway.x * 0.35
  const bx = ax + d
  // The loop's base sits a little above the band, so the tape never dips into what is below it.
  const ly = by - 0.15 * d + sway.y * 0.2
  const p1 = [ax + 2.2 * d + sway.x, ly - 2.4 * d + sway.y]
  const p2 = [ax - 1.2 * d + sway.x, ly - 2.4 * d + sway.y]
  // Control points either side of A and B, on the loop's own tangents, keep the tape smooth through the joins.
  const inA = [ax - 0.5 * d, ly + 0.55 * d]
  const outB = [bx + 0.45 * d, ly + 0.5 * d]

  return [
    start,
    `C ${ax * 0.4} ${wy - t * 1.6 + sway.y * 0.4}, ${inA[0]} ${inA[1]}, ${ax} ${ly}`,
    `C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${bx} ${ly}`,
    `C ${outB[0]} ${outB[1]}, ${w - 0.4 * d} ${by - 0.1 * d}, ${w + 4 * t} ${by - 0.3 * d}`,
  ].join(' ')
}

export function TapeRibbon({
  heroRef,
  headlineRef,
  bandRef,
}: {
  heroRef: RefObject<HTMLElement | null>
  headlineRef: RefObject<HTMLElement | null>
  bandRef: RefObject<HTMLElement | null>
}) {
  const uid = useId().replace(/:/g, '')
  const pathId = `tape-path-${uid}`
  const maskId = `tape-mask-${uid}`
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    const hero = heroRef.current
    const headline = headlineRef.current
    const band = bandRef.current
    if (!svg || !hero || !headline || !band) return

    const path = svg.querySelector<SVGPathElement>(`#${pathId}`)!
    const reveal = svg.querySelector<SVGUseElement>('.tape-reveal')!
    const mask = svg.querySelector<SVGMaskElement>(`#${maskId}`)!
    const minor = svg.querySelector<SVGUseElement>('.tape-ticks--minor')!
    const major = svg.querySelector<SVGUseElement>('.tape-ticks--major')!
    const numbers = svg.querySelector<SVGGElement>('.tape-numbers')!
    const layers = [...svg.querySelectorAll<SVGUseElement>('[data-width]')]
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let geo: Geometry = { w: 0, h: 0, t: 30, by: 0, rx: 0 }
    let labels: { el: SVGTextPathElement; text: string }[] = []
    const sway = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }
    const born = performance.now()
    let frame = 0
    let visible = true
    let unrolled = reduced

    const measure = () => {
      const box = hero.getBoundingClientRect()
      const bandBox = band.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(headline)
      const right = Math.max(...[...range.getClientRects()].map((r) => r.right), box.left)
      const w = box.width
      const t = clamp(w * 0.021, 22, 38)
      geo = { w, h: box.height, t, by: bandBox.top - box.top + bandBox.height / 2, rx: right - box.left }

      svg.setAttribute('viewBox', `0 0 ${w} ${geo.h}`)
      mask.setAttribute('x', String(-w))
      mask.setAttribute('y', String(-geo.h))
      mask.setAttribute('width', String(w * 3))
      mask.setAttribute('height', String(geo.h * 3))
      for (const layer of layers) layer.style.strokeWidth = `${t * Number(layer.dataset.width)}px`
      reveal.style.strokeWidth = `${t * 2}px`
      numbers.style.fontSize = `${t * 0.34}px`
    }

    const ensureLabels = (length: number) => {
      const needed = Math.ceil(length / LABEL) + 2
      while (labels.length < needed) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        const tp = document.createElementNS('http://www.w3.org/2000/svg', 'textPath')
        tp.setAttribute('href', `#${pathId}`)
        text.appendChild(tp)
        numbers.appendChild(text)
        labels.push({ el: tp, text: '' })
      }
      labels.forEach((label, i) => (label.el.parentElement!.style.display = i < needed ? '' : 'none'))
    }

    const draw = (now: number) => {
      const elapsed = now - born
      // Settle toward the pointer like fabric, with a slow breath when the pointer is still.
      sway.x += (target.x - sway.x) * 0.06
      sway.y += (target.y - sway.y) * 0.06
      const breath = reduced ? 0 : Math.sin(elapsed / 1300) * geo.t * 0.18
      path.setAttribute('d', tapePath(geo, reduced ? { x: 0, y: 0 } : sway, breath))
      const length = path.getTotalLength()

      // Unroll from the left on arrival.
      const p = unrolled ? 1 : Math.min(1, Math.max(0, (elapsed - 250) / 1700))
      const eased = 1 - Math.pow(1 - p, 3)
      if (p >= 1) unrolled = true
      reveal.style.strokeDasharray = `${length * eased} ${length + 10}`

      // Feed the tape along its length as the page scrolls, plus a slow drift.
      const feed = reduced ? 0 : window.scrollY * 0.6 + elapsed * 0.01
      minor.style.strokeDashoffset = `${-feed}`
      major.style.strokeDashoffset = `${-feed}`

      ensureLabels(length)
      const shift = ((feed % LABEL) + LABEL) % LABEL
      const passed = Math.floor(feed / LABEL)
      labels.forEach((label, i) => {
        const at = i * LABEL + shift
        label.el.setAttribute('startOffset', String(at))
        const text = String((((i - passed) % 150) + 150) % 150)
        if (text !== label.text) {
          label.el.textContent = text
          label.text = text
        }
      })
    }

    const loop = (now: number) => {
      draw(now)
      frame = visible && !reduced ? requestAnimationFrame(loop) : 0
    }
    const start = () => {
      if (!frame && !reduced) frame = requestAnimationFrame(loop)
    }

    const onPointer = (event: PointerEvent) => {
      const box = hero.getBoundingClientRect()
      const nx = clamp((event.clientX - (box.left + box.width / 2)) / (box.width / 2), -1, 1)
      const ny = clamp((event.clientY - (box.top + box.height / 2)) / (box.height / 2), -1, 1)
      target.x = nx * geo.t * 0.9
      target.y = ny * geo.t * 0.7
    }

    const resize = new ResizeObserver(() => {
      measure()
      draw(performance.now())
    })
    resize.observe(hero)
    resize.observe(headline)
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
    })
    seen.observe(hero)

    // Webfonts change the headline's width once they load.
    let disposed = false
    void document.fonts.ready.then(() => {
      if (disposed) return
      measure()
      draw(performance.now())
    })

    measure()
    draw(performance.now())
    if (!reduced) {
      window.addEventListener('pointermove', onPointer, { passive: true })
      start()
    }

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      // Remove the numbers this run added, so a remount starts from an empty tape.
      numbers.replaceChildren()
      labels = []
      resize.disconnect()
      seen.disconnect()
      window.removeEventListener('pointermove', onPointer)
    }
  }, [heroRef, headlineRef, bandRef, pathId, maskId])

  return (
    <svg ref={svgRef} className="tape-ribbon" aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <defs>
        <path id={pathId} />
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <use href={`#${pathId}`} className="tape-reveal" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <use href={`#${pathId}`} className="tape-shadow" data-width="1" />
        <use href={`#${pathId}`} className="tape-edge" data-width="1.06" />
        <use href={`#${pathId}`} className="tape-body" data-width="1" />
        <use
          href={`#${pathId}`}
          className="tape-ticks tape-ticks--minor"
          data-width="1"
          strokeDasharray={`1.2 ${MINOR - 1.2}`}
        />
        <use href={`#${pathId}`} className="tape-cover" data-width="0.6" />
        <use
          href={`#${pathId}`}
          className="tape-ticks tape-ticks--major"
          data-width="1"
          strokeDasharray={`1.8 ${MAJOR - 1.8}`}
        />
        <use href={`#${pathId}`} className="tape-cover" data-width="0.34" />
        <g className="tape-numbers" />
      </g>
    </svg>
  )
}
