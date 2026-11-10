import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { fitLines } from '../utils/fitText.ts'
import type { FitOptions, FitResult } from '../utils/fitText.ts'

/**
 * Fits `texts` to the width of the element in `ref` and refits whenever
 * that element or the window is resized. Returns null until the display
 * font has loaded, so nothing is measured against a fallback face.
 */
export function useFittedLines(
  ref: RefObject<HTMLElement | null>,
  texts: string[],
  options: FitOptions,
  getMaxSize?: () => number,
): FitResult | null {
  const [fit, setFit] = useState<FitResult | null>(null)
  const latest = useRef({ texts, options, getMaxSize })
  const key = texts.join('\n')

  // Declared before the measuring effect so it always reads current inputs.
  useEffect(() => {
    latest.current = { texts, options, getMaxSize }
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let cancelled = false
    let fontReady = false
    let frame = 0

    const run = () => {
      frame = 0
      if (cancelled || !fontReady) return
      const target = el.clientWidth
      if (!target) return
      const { texts: t, options: o, getMaxSize: cap } = latest.current
      setFit(fitLines(t, target, { ...o, maxSize: cap ? cap() : o.maxSize }))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run)
    }

    const { options: o } = latest.current
    const primaryFamily = o.family.split(',')[0].trim()
    const whenLoaded = () => {
      fontReady = true
      schedule()
    }
    document.fonts.load(`${o.weight} 100px ${primaryFamily}`).then(whenLoaded, whenLoaded)

    const observer = new ResizeObserver(schedule)
    observer.observe(el)
    window.addEventListener('resize', schedule)

    return () => {
      cancelled = true
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [ref, key])

  return fit
}
