import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeroMeasure } from '../../../components/landing/HeroMeasure.tsx'
import { ScrollTape } from '../../../components/landing/ScrollTape.tsx'
import { useFittedLines } from '../../../hooks/useFittedLines.ts'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion.ts'
import type { FitOptions } from '../../../utils/fitText.ts'

const LINES = ['Stop buying', 'AI models', 'off the rack.']
const HEADLINE_FONT: FitOptions = {
  family: '"Anybody Variable", sans-serif',
  weight: 800,
  letterSpacingEm: -0.01,
}

// Keeps three lines of headline inside a short viewport.
const maxHeadlineSize = () => window.innerHeight * 0.165

/*
  The headline arrives at one width for every line, the way an off-the-rack
  garment does, and overhangs its measure. Then each line is taken in or let
  out until all three end on the same edge.
*/
type Phase = 'loading' | 'off-the-rack' | 'fitting' | 'fitted'

export function Hero() {
  const measure = useRef<HTMLDivElement>(null)
  const fit = useFittedLines(measure, LINES, HEADLINE_FONT, maxHeadlineSize)
  const reducedMotion = usePrefersReducedMotion()
  const [stage, setStage] = useState<Exclude<Phase, 'loading'>>('off-the-rack')
  const ready = fit !== null

  useEffect(() => {
    if (!ready || reducedMotion) return
    const pull = window.setTimeout(() => setStage('fitting'), 700)
    const settle = window.setTimeout(() => setStage('fitted'), 700 + 1400)
    return () => {
      window.clearTimeout(pull)
      window.clearTimeout(settle)
    }
  }, [ready, reducedMotion])

  const phase: Phase = !ready ? 'loading' : reducedMotion ? 'fitted' : stage
  const isFitted = phase === 'fitting' || phase === 'fitted'

  return (
    <section className="hero" aria-labelledby="hero-headline">
      <div className="wrap">
        <div ref={measure} className="hero-measure">
          <div className={`hero-fit is-${phase}`} style={{ width: fit ? fit.width : undefined }}>
            <p className="dimension" aria-hidden="true">
              <span>
                {isFitted && fit
                  ? `fitted to your screen, ${Math.round(fit.width).toLocaleString('en-IN')} px`
                  : 'one size fits all'}
              </span>
            </p>
            <h1 id="hero-headline" className="hero-headline" style={{ fontSize: fit ? fit.size : undefined }}>
              {LINES.map((line, index) => (
                <span
                  key={line}
                  className="hero-line"
                  style={{
                    fontVariationSettings: `"wdth" ${isFitted && fit ? fit.wdths[index] : 100}`,
                  }}
                >
                  {line}{' '}
                </span>
              ))}
            </h1>
          </div>
        </div>

        <div className="hero-foot">
          <div className="hero-pitch">
            <p className="hero-lede">
              Public benchmarks are one size fits all. ModelFit runs your own tasks through every model you're
              considering and tells you what each one really costs per successful task.
            </p>
            <div className="hero-actions">
              <Link to="/signup" className="btn">
                Run Your First Benchmark
              </Link>
              <a href="#fitting" className="stitch-link">
                See How It Works
              </a>
            </div>
          </div>
          <HeroMeasure />
        </div>
      </div>

      <ScrollTape />
    </section>
  )
}
