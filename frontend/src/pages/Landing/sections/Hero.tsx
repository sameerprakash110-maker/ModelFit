import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { HeroMeasure } from '../../../components/landing/HeroMeasure.tsx'
import { TapeRibbon } from '../../../components/landing/TapeRibbon.tsx'

/*
  The first screen, sized to fit it: the headline, a band where a length of
  measuring tape runs (and curls into a loop beside the headline), the pitch
  with its two actions, and the trap in one picture.
*/
export function Hero() {
  const hero = useRef<HTMLElement>(null)
  const headline = useRef<HTMLHeadingElement>(null)
  const band = useRef<HTMLDivElement>(null)

  return (
    <section ref={hero} className="hero" aria-labelledby="hero-headline">
      <TapeRibbon heroRef={hero} headlineRef={headline} bandRef={band} />
      <div className="wrap hero-inner">
        <h1 ref={headline} id="hero-headline" className="hero-headline">
          Stop buying AI models off the rack.
        </h1>

        {/* The tape runs through this gap, so it never sits behind the words. */}
        <div ref={band} className="hero-band" aria-hidden="true" />

        <div className="hero-foot">
          <div className="hero-pitch">
            <p className="hero-lede">
              Public benchmarks are one size fits all. ModelFit runs your own tasks through every model you're
              considering and tells you what each one really costs per successful task.
            </p>
            <div className="hero-actions">
              <Link to="/signup" className="btn">
                Run your first benchmark
              </Link>
              <a href="#fitting" className="stitch-link">
                See how it works
              </a>
            </div>
          </div>
          <HeroMeasure />
        </div>
      </div>
    </section>
  )
}
