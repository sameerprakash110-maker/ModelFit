import { useEffect, useRef } from 'react'
import { SiteFooter } from '../../components/landing/SiteFooter.tsx'
import { SiteNav } from '../../components/landing/SiteNav.tsx'
import { useReveal } from '../../hooks/useReveal.ts'
import '../../styles/site.css'
import './landing.css'
import { Closing } from './sections/Closing.tsx'
import { FittingSteps } from './sections/FittingSteps.tsx'
import { Hero } from './sections/Hero.tsx'
import { Measured } from './sections/Measured.tsx'
import { ReadingABenchmark } from './sections/ReadingABenchmark.tsx'
import { TrapCalculator } from './sections/TrapCalculator.tsx'
import { Verdicts } from './sections/Verdicts.tsx'
import { WhyModelFit } from './sections/WhyModelFit.tsx'

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null)
  useReveal(root)

  // Arriving from another page with a section in the URL (for example /#trap).
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [])

  return (
    <div ref={root} className="lp">
      <a href="#main" className="skip-link">
        Skip to the content
      </a>
      <SiteNav />
      <main id="main">
        <Hero />
        <TrapCalculator />
        <WhyModelFit />
        <FittingSteps />
        <Measured />
        <ReadingABenchmark />
        <Verdicts />
        <Closing />
      </main>
      <SiteFooter />
    </div>
  )
}
